/**
 * MySQL 回滚脚本（从 backup.ts 生成的备份目录恢复 schema + data）
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/rollback.ts --dir <backup_dir>
 *
 * 可选参数：
 *   --dir <dir>         备份目录（形如 ./backups/mysql/20251219_123000）
 *   --batchSize <n>     批量插入行数（默认：200）
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

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

function toSafeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, '_');
}

function denormalizeValue(value: any): any {
  if (value === null || value === undefined) return null;

  if (typeof value === 'object') {
    if (value.__type === 'date' && typeof value.value === 'string') {
      return new Date(value.value);
    }
    if (value.__type === 'buffer' && typeof value.value === 'string') {
      return Buffer.from(value.value, 'base64');
    }
    if (value.__type === 'bigint' && typeof value.value === 'string') {
      try {
        return BigInt(value.value);
      } catch {
        return value.value;
      }
    }
    if (Array.isArray(value)) return value.map(denormalizeValue);
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      out[k] = denormalizeValue(value[k]);
    }
    return out;
  }

  return value;
}

async function readJSON(filePath: string): Promise<any> {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

async function execSQLFile(connection: mysql.Connection, filePath: string): Promise<void> {
  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) return;

  // SHOW CREATE TABLE 结果通常是单条语句；这里仍允许文件里有多条语句（用 ; 分割）
  const statements = sql
    .split(/;\s*\n/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    await connection.query(stmt);
  }
}

async function restoreTableData(params: {
  connection: mysql.Connection;
  tableName: string;
  tableMeta: TableMeta;
  dataFile: string;
  batchSize: number;
}): Promise<void> {
  const { connection, tableName, tableMeta, dataFile, batchSize } = params;

  if (!fs.existsSync(dataFile)) {
    console.log(`- 跳过数据（文件不存在）: ${tableName}`);
    return;
  }

  const columns = tableMeta.columns || [];
  if (columns.length === 0) {
    console.log(`- 跳过数据（columns 为空）: ${tableName}`);
    return;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(dataFile, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const colSql = columns.map((c) => `\`${c}\``).join(', ');
  const insertSql = `INSERT INTO \`${tableName}\` (${colSql}) VALUES ?`;

  let batch: any[][] = [];
  let inserted = 0;

  const flush = async () => {
    if (batch.length === 0) return;
    await connection.query(insertSql, [batch]);
    inserted += batch.length;
    batch = [];
  };

  for await (const line of rl) {
    const trimmed = String(line).trim();
    if (!trimmed) continue;
    const obj = denormalizeValue(JSON.parse(trimmed)) as Record<string, any>;
    const row = columns.map((c) => (obj[c] === undefined ? null : obj[c]));
    batch.push(row);
    if (batch.length >= batchSize) {
      await flush();
    }
  }

  await flush();
  console.log(`✓ 恢复数据: ${tableName} inserted=${inserted}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dir = args.dir ? String(args.dir) : '';
  const batchSize = Math.max(1, Number(args.batchSize || 200));

  if (!dir) {
    console.error('❌ 缺少参数 --dir <backup_dir>');
    process.exitCode = 1;
    return;
  }

  const backupRoot = path.isAbsolute(dir) ? dir : path.join(process.cwd(), dir);
  const metaPath = path.join(backupRoot, 'meta.json');
  const schemaDir = path.join(backupRoot, 'schema');
  const dataDir = path.join(backupRoot, 'data');

  if (!fs.existsSync(metaPath)) {
    console.error(`❌ 找不到 meta.json: ${metaPath}`);
    process.exitCode = 1;
    return;
  }

  const meta = (await readJSON(metaPath)) as BackupMeta;
  const dbName = String(meta.dbName || process.env.DATABASE_NAME || 'ai_interview');

  console.log('🧯 MySQL 回滚开始');
  console.log(`- from: ${backupRoot}`);
  console.log(`- DB: ${dbName}`);
  console.log(`- batchSize: ${batchSize}`);

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    multipleStatements: false,
  });

  try {
    // 1) 确保数据库存在并切换
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${dbName}\``);

    // 2) drop 表（逆序），避免外键顺序问题
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    const reverseOrder = [...meta.tableOrder].reverse();
    for (const t of reverseOrder) {
      await connection.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
    console.log('✓ 已清理旧表');

    // 3) create 表（顺序），使用 schema/*.sql
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    for (const tableName of meta.tableOrder) {
      const safe = toSafeFileName(tableName);
      const schemaPath = path.join(schemaDir, `${safe}.sql`);
      if (!fs.existsSync(schemaPath)) {
        throw new Error(`schema 文件缺失: ${schemaPath}`);
      }
      await execSQLFile(connection, schemaPath);
      console.log(`✓ 创建表: ${tableName}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS=1');

    // 4) restore data（顺序）
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    for (const tableName of meta.tableOrder) {
      const safe = toSafeFileName(tableName);
      const dataPath = path.join(dataDir, `${safe}.jsonl`);
      const tableMeta = meta.tables[tableName];
      if (!tableMeta) {
        console.log(`- 跳过数据（meta 缺失）: ${tableName}`);
        continue;
      }
      if (Number(tableMeta.rowCount || 0) <= 0) {
        console.log(`- 跳过数据（空表）: ${tableName}`);
        continue;
      }
      await restoreTableData({
        connection,
        tableName,
        tableMeta,
        dataFile: dataPath,
        batchSize,
      });
    }
    await connection.query('SET FOREIGN_KEY_CHECKS=1');

    console.log('\n✅ 回滚完成');
  } catch (error) {
    console.error('\n❌ 回滚失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();


