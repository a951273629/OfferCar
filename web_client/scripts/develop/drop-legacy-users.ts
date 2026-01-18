/**
 * 删除 legacy 表 `users`（dev_ai_interview 专用）
 *
 * 说明：
 * - 本脚本会强制只操作 `dev_ai_interview`，避免误删其他库
 * - 删除前会检查是否仍存在外键引用 `users`，如果存在会直接报错退出
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/develop/drop-legacy-users.ts
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const TARGET_DB_NAME = 'dev_ai_interview';

async function tableExists(connection: mysql.Connection, dbName: string, tableName: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, tableName]
  );
  return Number((rows || [])[0]?.cnt || 0) > 0;
}

async function getForeignKeysReferencingTable(params: {
  connection: mysql.Connection;
  dbName: string;
  referencedTable: string;
}) {
  const { connection, dbName, referencedTable } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT
       TABLE_NAME AS table_name,
       COLUMN_NAME AS column_name,
       CONSTRAINT_NAME AS constraint_name
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_SCHEMA = ?
       AND REFERENCED_TABLE_NAME = ?
       AND CONSTRAINT_NAME IS NOT NULL
     ORDER BY TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME`,
    [dbName, dbName, referencedTable]
  );

  return (rows || []).map((r) => ({
    table: String(r.table_name),
    column: String(r.column_name),
    constraint: String(r.constraint_name),
  }));
}

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: TARGET_DB_NAME,
  });

  console.log('🚨 即将删除 legacy 表 users（不可回滚）');
  console.log(`- DB: ${TARGET_DB_NAME}`);

  try {
    const hasUsers = await tableExists(connection, TARGET_DB_NAME, 'users');
    if (!hasUsers) {
      console.log('✓ 未找到 users 表，跳过');
      return;
    }

    const fkRefs = await getForeignKeysReferencingTable({
      connection,
      dbName: TARGET_DB_NAME,
      referencedTable: 'users',
    });

    // 允许 users 自引用外键存在（drop table 会一并删除）
    const externalRefs = fkRefs.filter((r) => r.table !== 'users');
    if (externalRefs.length > 0) {
      console.error('❌ 检测到仍有外键引用 users，禁止删除：');
      for (const r of externalRefs) {
        console.error(`- ${r.table}.${r.column} -> users (constraint: ${r.constraint})`);
      }
      console.error('\n请先完成外键迁移（将引用切换到 better-auth.user.id）后再执行删除。');
      process.exitCode = 1;
      return;
    }

    const [cntRows] = await connection.query<any[]>(`SELECT COUNT(*) AS cnt FROM \`users\``);
    const rowCount = Number((cntRows || [])[0]?.cnt || 0);
    console.log(`- users rows: ${rowCount}`);

    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    await connection.query('DROP TABLE IF EXISTS `users`');
    await connection.query('SET FOREIGN_KEY_CHECKS=1');

    const stillExists = await tableExists(connection, TARGET_DB_NAME, 'users');
    if (stillExists) {
      throw new Error('删除后仍检测到 users 表存在');
    }

    console.log('✅ 已删除 legacy 表 users');
  } catch (error) {
    console.error('❌ 删除失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();


