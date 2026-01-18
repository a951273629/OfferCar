/**
 * 克隆数据库脚本：ai_interview -> dev_ai_interview（仅 BASE TABLE：表结构 + 表数据）
 *
 * 约束（按需求）：
 * - 若目标库 dev_ai_interview 已存在：直接退出并报错（不做覆盖/清空）
 * - 不迁移视图/触发器/事件/存储过程等对象
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/develop/clone-ai-interview-to-dev-ai-interview.ts
 *
 * 可选参数：
 *   --sourceDb ai_interview
 *   --targetDb dev_ai_interview
 *   --pageSize 1000
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

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
    // 自引用外键不影响建表顺序
    if (e.fromTable === e.toTable) continue;
    const s = adj.get(e.fromTable);
    if (!s) continue;
    if (s.has(e.toTable)) continue;
    s.add(e.toTable);
    indeg.set(e.toTable, Number(indeg.get(e.toTable) || 0) + 1);
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

async function databaseExists(connection: mysql.Connection, dbName: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.SCHEMATA
     WHERE SCHEMA_NAME = ?`,
    [dbName]
  );
  return Number((rows || [])[0]?.cnt || 0) > 0;
}

async function getTableColumns(connection: mysql.Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(`SHOW COLUMNS FROM \`${tableName}\``);
  return (rows || []).map((r) => String(r.Field));
}

async function getPrimaryKeyColumns(connection: mysql.Connection, tableName: string) {
  const [rows] = await connection.query<any[]>(`SHOW KEYS FROM \`${tableName}\` WHERE Key_name = 'PRIMARY'`);
  return (rows || [])
    .sort((a, b) => Number(a.Seq_in_index || 0) - Number(b.Seq_in_index || 0))
    .map((r) => String(r.Column_name));
}

async function createDatabase(params: { connection: mysql.Connection; targetDb: string }) {
  const { connection, targetDb } = params;
  await connection.query(
    `CREATE DATABASE \`${targetDb}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
}

function buildBulkInsertSQL(params: { tableName: string; columns: string[]; rowCount: number }) {
  const { tableName, columns, rowCount } = params;
  const colsSql = columns.map((c) => `\`${c}\``).join(', ');
  const oneRow = `(${columns.map(() => '?').join(', ')})`;
  const valuesSql = new Array(rowCount).fill(oneRow).join(', ');
  return `INSERT INTO \`${tableName}\` (${colsSql}) VALUES ${valuesSql}`;
}

async function cloneTableData(params: {
  sourceConn: mysql.Connection;
  targetConn: mysql.Connection;
  tableName: string;
  pageSize: number;
}) {
  const { sourceConn, targetConn, tableName, pageSize } = params;

  const columns = await getTableColumns(sourceConn, tableName);
  const primaryKey = await getPrimaryKeyColumns(sourceConn, tableName);
  const orderBy =
    primaryKey.length > 0 ? ` ORDER BY ${primaryKey.map((c) => `\`${c}\``).join(', ')}` : '';

  const [cntRows] = await sourceConn.query<any[]>(`SELECT COUNT(*) AS cnt FROM \`${tableName}\``);
  const total = Number((cntRows || [])[0]?.cnt || 0);

  let offset = 0;
  while (offset < total) {
    const [rows] = await sourceConn.query<any[]>(
      `SELECT * FROM \`${tableName}\`${orderBy} LIMIT ? OFFSET ?`,
      [pageSize, offset]
    );
    const batch = rows || [];
    if (batch.length > 0) {
      const sql = buildBulkInsertSQL({ tableName, columns, rowCount: batch.length });
      const values: any[] = [];
      for (const r of batch) {
        for (const c of columns) {
          const v = (r as any)[c];
          values.push(v === undefined ? null : v);
        }
      }
      await targetConn.query(sql, values);
    }
    offset += pageSize;
  }

  return { total };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDb = String(args.sourceDb || process.env.DATABASE_NAME || 'ai_interview');
  const targetDb = String(args.targetDb || 'dev_ai_interview');
  const pageSize = Math.max(1, Number(args.pageSize || 1000));

  if (!sourceDb || !targetDb) {
    throw new Error('sourceDb/targetDb 不能为空');
  }
  if (sourceDb === targetDb) {
    throw new Error(`sourceDb 与 targetDb 不能相同：${sourceDb}`);
  }

  const baseConn = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: sourceDb,
  });

  console.log('开始克隆数据库');
  console.log(`- sourceDb: ${sourceDb}`);
  console.log(`- targetDb: ${targetDb}`);
  console.log(`- pageSize: ${pageSize}`);

  let targetConn: mysql.Connection | null = null;

  try {
    const sourceExists = await databaseExists(baseConn, sourceDb);
    if (!sourceExists) {
      throw new Error(`源库不存在：${sourceDb}`);
    }

    const targetExists = await databaseExists(baseConn, targetDb);
    if (targetExists) {
      throw new Error(`目标库已存在，按策略退出：${targetDb}`);
    }

    await createDatabase({ connection: baseConn, targetDb });
    console.log(`✓ 已创建目标库：${targetDb}`);

    targetConn = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: targetDb,
      multipleStatements: true,
    });

    // 读取表列表
    const [tablesRows] = await baseConn.query<any[]>(
      `SELECT TABLE_NAME AS table_name
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [sourceDb]
    );
    const tables = (tablesRows || []).map((r) => String(r.table_name)).filter((t) => t);

    // 外键依赖：child(table) 引用 parent(referenced_table)
    // 建表顺序需要 parent -> child，因此这里反转边方向：parent -> child
    const [fkRows] = await baseConn.query<any[]>(
      `SELECT
         TABLE_NAME AS from_table,
         REFERENCED_TABLE_NAME AS to_table
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_SCHEMA = ?
         AND REFERENCED_TABLE_NAME IS NOT NULL`,
      [sourceDb, sourceDb]
    );
    const fkEdgesParentToChild = (fkRows || [])
      .map((r) => ({
        fromTable: String(r.to_table || ''),
        toTable: String(r.from_table || ''),
      }))
      .filter((e) => e.fromTable && e.toTable);

    const tableOrder = buildTopologicalOrder({ tables, fkEdges: fkEdgesParentToChild });
    console.log(`- tables: ${tableOrder.length}`);

    // 1) 建表（按依赖顺序）
    await targetConn.query('SET FOREIGN_KEY_CHECKS=0');

    for (const tableName of tableOrder) {
      const [createRows] = await baseConn.query<any[]>(`SHOW CREATE TABLE \`${tableName}\``);
      const createSQL = (createRows || [])[0]?.['Create Table'];
      if (typeof createSQL !== 'string' || !createSQL.trim()) {
        throw new Error(`无法导出建表语句：${tableName}`);
      }
      await targetConn.query(createSQL);
      console.log(`✓ schema: ${tableName}`);
    }

    // 2) 导数据
    for (const tableName of tableOrder) {
      await targetConn.query(`TRUNCATE TABLE \`${tableName}\``);
      await targetConn.query('START TRANSACTION');
      try {
        const { total } = await cloneTableData({
          sourceConn: baseConn,
          targetConn,
          tableName,
          pageSize,
        });
        await targetConn.query('COMMIT');
        console.log(`✓ data: ${tableName} rows=${total}`);
      } catch (e) {
        await targetConn.query('ROLLBACK');
        throw e;
      }
    }

    await targetConn.query('SET FOREIGN_KEY_CHECKS=1');

    console.log('克隆完成');
  } catch (error) {
    console.error('克隆失败:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    if (targetConn) {
      await targetConn.end();
    }
    await baseConn.end();
  }
}

main().catch((e) => {
  console.error('脚本异常退出:', e instanceof Error ? e.message : e);
  process.exitCode = 1;
});


