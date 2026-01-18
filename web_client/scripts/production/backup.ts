/**
 * MySQL 备份脚本（schema + data）
 *
 * 设计目标：
 * - 可恢复：配套 rollback.ts 能完整恢复结构与数据
 * - 不依赖 mysqldump：纯 Node + mysql2 + JSONL
 * - 顺序正确：按外键拓扑排序导出，回滚也可按同顺序建表/写数据
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/backup.ts
 *
 * 可选参数：
 *   --outDir <dir>      备份根目录（默认：./backups/mysql）
 *   --pageSize <n>      分页大小（默认：1000）
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

type TableMeta = {
  tableName: string;
  rowCount: number;
  columns: string[];
  primaryKey: string[];
};

type BackupMeta = {
  version: 1;
  createdAt: string;
  dbName: string;
  pageSize: number;
  tableOrder: string[];
  tables: Record<string, TableMeta>;
};

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i++;
      continue;
    }
    args[key] = 'true';
  }
  return args;
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p, { recursive: true });
  }
}

function toSafeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { __type: 'date', value: value.toISOString() };
  // mysql2 可能返回 Buffer（例如 blob）
  if (Buffer.isBuffer(value)) {
    return { __type: 'buffer', value: value.toString('base64') };
  }
  if (typeof value === 'bigint') return { __type: 'bigint', value: value.toString() };
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj)) {
      out[k] = normalizeValue(obj[k]);
    }
    return out;
  }
  return value;
}

function buildTopologicalOrder(params: {
  tables: string[];
  fkEdges: Array<{ fromTable: string; toTable: string }>;
}): string[] {
  const { tables, fkEdges } = params;

  const tableSet = new Set(tables);
  const indeg = new Map<string, number>();
  const adj = new Map<string, Set<string>>();
  for (const t of tables) {
    indeg.set(t, 0);
    adj.set(t, new Set());
  }

  for (const e of fkEdges) {
    if (!tableSet.has(e.fromTable) || !tableSet.has(e.toTable)) continue;
    // 自引用外键不影响建表顺序（例如 users.referrer_id -> users.id）
    if (e.fromTable === e.toTable) continue;
    const s = adj.get(e.fromTable);
    if (!s) continue;
    if (s.has(e.toTable)) continue;
    s.add(e.toTable);
    indeg.set(e.toTable, (indeg.get(e.toTable) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [t, d] of indeg.entries()) {
    if (Number(d || 0) === 0) queue.push(t);
  }
  queue.sort();

  const out: string[] = [];
  while (queue.length > 0) {
    const t = queue.shift() as string;
    out.push(t);
    const nexts = Array.from(adj.get(t) || []);
    nexts.sort();
    for (const n of nexts) {
      const nd = Number(indeg.get(n) || 0) - 1;
      indeg.set(n, nd);
      if (nd === 0) {
        queue.push(n);
        queue.sort();
      }
    }
  }

  // 如果存在环，兜底：把剩余表按字母补上
  if (out.length !== tables.length) {
    const remain = tables.filter((t) => !out.includes(t)).sort();
    return [...out, ...remain];
  }
  return out;
}

async function getPrimaryKeyColumns(connection: mysql.Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
  return (rows || [])
    .sort((a, b) => Number(a.Seq_in_index || 0) - Number(b.Seq_in_index || 0))
    .map((r) => String(r.Column_name));
}

async function getTableColumns(connection: mysql.Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return (rows || []).map((r) => String(r.Field));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.outDir ? String(args.outDir) : path.join(process.cwd(), 'backups', 'mysql');
  const pageSize = Math.max(1, Number(args.pageSize || 1000));

  const dbName = String(process.env.DATABASE_NAME || 'ai_interview');
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: dbName,
  });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
  const backupRoot = path.join(outDir, timestamp);
  const schemaDir = path.join(backupRoot, 'schema');
  const dataDir = path.join(backupRoot, 'data');

  ensureDir(backupRoot);
  ensureDir(schemaDir);
  ensureDir(dataDir);

  console.log('🧰 MySQL 备份开始');
  console.log(`- DB: ${dbName}`);
  console.log(`- out: ${backupRoot}`);
  console.log(`- pageSize: ${pageSize}`);

  try {
    // 读取表列表
    const [tablesRows] = await connection.query<any[]>(
      `SELECT TABLE_NAME AS table_name
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [dbName]
    );
    const tables = (tablesRows || []).map((r) => String(r.table_name));

    // 读取外键依赖（from -> to）
    const [fkRows] = await connection.query<any[]>(
      `SELECT
         TABLE_NAME AS from_table,
         REFERENCED_TABLE_NAME AS to_table
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [dbName, dbName]
    );
    const fkEdges = (fkRows || [])
      .map((r) => ({
        fromTable: String(r.from_table),
        toTable: String(r.to_table),
      }))
      .filter((e) => e.fromTable && e.toTable);

    const tableOrder = buildTopologicalOrder({ tables, fkEdges });

    // 备份数据库创建语句（可选）
    const createDbSQL = [
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      `USE \`${dbName}\`;`,
      '',
    ].join('\n');
    fs.writeFileSync(path.join(schemaDir, '_database.sql'), createDbSQL, 'utf8');

    const meta: BackupMeta = {
      version: 1,
      createdAt: new Date().toISOString(),
      dbName,
      pageSize,
      tableOrder,
      tables: {},
    };

    // 备份 schema + data
    for (const tableName of tableOrder) {
      const safe = toSafeFileName(tableName);

      // schema
      const [createRows] = await connection.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
      const createSQL = (createRows || [])[0]?.['Create Table'];
      if (typeof createSQL === 'string' && createSQL.trim()) {
        fs.writeFileSync(path.join(schemaDir, `${safe}.sql`), createSQL.trim() + ';\n', 'utf8');
      } else {
        fs.writeFileSync(path.join(schemaDir, `${safe}.sql`), `-- unable to export schema for ${tableName}\n`, 'utf8');
      }

      // meta for table
      const [cntRows] = await connection.query<any[]>(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``);
      const rowCount = Number((cntRows || [])[0]?.cnt || 0);
      const columns = await getTableColumns(connection, tableName);
      const primaryKey = await getPrimaryKeyColumns(connection, tableName);

      meta.tables[tableName] = { tableName, rowCount, columns, primaryKey };

      // data
      const dataPath = path.join(dataDir, `${safe}.jsonl`);
      const ws = fs.createWriteStream(dataPath, { encoding: 'utf8' });

      const orderBy =
        primaryKey.length > 0
          ? ` ORDER BY ${primaryKey.map((c) => `\`${c}\``).join(', ')}`
          : '';

      let offset = 0;
      while (offset < rowCount) {
        const [rows] = await connection.query<any[]>(
          `SELECT * FROM \`${tableName}\`${orderBy} LIMIT ? OFFSET ?`,
          [pageSize, offset]
        );
        for (const row of rows || []) {
          ws.write(JSON.stringify(normalizeValue(row)) + '\n');
        }
        offset += pageSize;
      }

      await new Promise<void>((resolve, reject) => {
        ws.end(() => resolve());
        ws.on('error', reject);
      });

      console.log(`✓ ${tableName}: rows=${rowCount}`);
    }

    fs.writeFileSync(path.join(backupRoot, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8');

    console.log('\n✅ 备份完成');
    console.log(`- 目录: ${backupRoot}`);
  } catch (error) {
    console.error('\n❌ 备份失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();


