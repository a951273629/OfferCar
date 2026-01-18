/**
 * 清理所有 *_auth 过渡列：回填到主列并删除 *_auth 列
 *
 * 目标：
 * - 自动扫描当前库中所有形如 `*_auth` 的列
 * - 对每个 `xxx_auth`：把值回填到 `xxx`（若存在），必要时把 `xxx` 统一为 varchar(36) utf8mb4_unicode_ci
 * - 确保 `xxx` 外键引用 `user(id)`（可空列：ON DELETE SET NULL；不可空列：ON DELETE CASCADE）
 * - 最后删除 `xxx_auth` 列（以及其上可能存在的外键/索引）
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/production/migrate-drop-auth-shadow-columns.ts
 *
 * 可选参数：
 *   --dbName <name>     目标库名（默认使用 DATABASE_NAME，否则 ai_interview）
 *   --apply true|false  是否真正执行（默认 false，仅 dry-run 打印将执行的 SQL）
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

function toBool(v: unknown, fallback: boolean) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (!s) return fallback;
  if (s === 'true' || s === '1' || s === 'yes' || s === 'y') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'n') return false;
  return fallback;
}

type ColumnMeta = {
  dataType: string;
  charMaxLen: number;
  isNullable: boolean;
  collationName: string;
};

type ForeignKeyMeta = {
  constraintName: string;
  referencedTable: string;
  referencedColumn: string;
};

type AuthShadowTask = {
  tableName: string;
  authCol: string;
  baseCol: string;
};

function isAuthUserIdColumn(meta: ColumnMeta | null) {
  if (!meta) return false;
  const dt = String(meta.dataType || '').toLowerCase();
  if (dt !== 'varchar' && dt !== 'char') return false;
  const len = Number(meta.charMaxLen || 0);
  if (len < 36) return false;
  const coll = String(meta.collationName || '').toLowerCase();
  if (!coll) return false;
  return coll.includes('utf8mb4_unicode_ci');
}

async function columnExists(connection: mysql.Connection, dbName: string, tableName: string, col: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, col]
  );
  return Number((rows || [])[0]?.cnt || 0) > 0;
}

async function getColumnMeta(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  col: string;
}): Promise<ColumnMeta | null> {
  const { connection, dbName, tableName, col } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT
       DATA_TYPE AS data_type,
       CHARACTER_MAXIMUM_LENGTH AS char_max_len,
       IS_NULLABLE AS is_nullable,
       COLLATION_NAME AS collation_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?
     LIMIT 1`,
    [dbName, tableName, col]
  );
  const r = (rows || [])[0];
  if (!r) return null;
  return {
    dataType: String(r.data_type || ''),
    charMaxLen: Number(r.char_max_len || 0),
    isNullable: String(r.is_nullable || '').toUpperCase() === 'YES',
    collationName: String(r.collation_name || ''),
  };
}

async function getForeignKeysForColumn(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  col: string;
}): Promise<ForeignKeyMeta[]> {
  const { connection, dbName, tableName, col } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT
       CONSTRAINT_NAME AS constraint_name,
       REFERENCED_TABLE_NAME AS referenced_table,
       REFERENCED_COLUMN_NAME AS referenced_column
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL
       AND CONSTRAINT_NAME IS NOT NULL`,
    [dbName, tableName, col]
  );
  return (rows || [])
    .map((r) => ({
      constraintName: String(r.constraint_name || ''),
      referencedTable: String(r.referenced_table || ''),
      referencedColumn: String(r.referenced_column || ''),
    }))
    .filter((x) => x.constraintName && x.constraintName !== 'PRIMARY');
}

async function dropForeignKeysByNames(params: {
  connection: mysql.Connection;
  tableName: string;
  constraintNames: string[];
  apply: boolean;
}) {
  const { connection, tableName, constraintNames, apply } = params;
  for (const c of constraintNames) {
    const name = String(c || '').trim();
    if (!name || name === 'PRIMARY') continue;
    const sql = `ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${name}\``;
    await execMaybe({ connection, sql, apply });
  }
}

async function constraintExists(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  constraintName: string;
}) {
  const { connection, dbName, tableName, constraintName } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [dbName, tableName, constraintName]
  );
  return Number((rows || [])[0]?.cnt || 0) > 0;
}

async function listIndexesByColumn(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  col: string;
}): Promise<string[]> {
  const { connection, dbName, tableName, col } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT DISTINCT INDEX_NAME AS index_name
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND INDEX_NAME <> 'PRIMARY'`,
    [dbName, tableName, col]
  );
  return (rows || [])
    .map((r) => String(r.index_name || '').trim())
    .filter((x) => !!x);
}

async function dropIndexesByNames(params: {
  connection: mysql.Connection;
  tableName: string;
  indexNames: string[];
  apply: boolean;
}) {
  const { connection, tableName, indexNames, apply } = params;
  for (const idx of indexNames) {
    const name = String(idx || '').trim();
    if (!name || name === 'PRIMARY') continue;
    const sql = `ALTER TABLE \`${tableName}\` DROP INDEX \`${name}\``;
    await execMaybe({ connection, sql, apply });
  }
}

async function execMaybe(params: {
  connection: mysql.Connection;
  sql: string;
  values?: any[];
  apply: boolean;
}) {
  const { connection, sql, values, apply } = params;
  const v = values || [];
  if (!apply) {
    console.log(`[dry-run] ${sql}${v.length > 0 ? ` ; values=${JSON.stringify(v)}` : ''}`);
    return;
  }
  await connection.query(sql, v);
}

async function queryCount(params: { connection: mysql.Connection; sql: string; values?: any[] }) {
  const { connection, sql, values } = params;
  const [rows] = await connection.query<any[]>(sql, values || []);
  const n = Number((rows || [])[0]?.cnt || 0);
  return Number(n || 0);
}

async function ensureUserForeignKey(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  col: string;
  nullable: boolean;
  apply: boolean;
}) {
  const { connection, dbName, tableName, col, nullable, apply } = params;

  const fks = await getForeignKeysForColumn({ connection, dbName, tableName, col });
  const hasAuthFk = fks.some((x) => x.referencedTable === 'user' && x.referencedColumn === 'id');
  if (hasAuthFk) return;

  const baseName = `fk_${tableName}_${col}_auth_user`;
  let nameToUse = baseName;
  let i = 0;
  while (await constraintExists({ connection, dbName, tableName, constraintName: nameToUse })) {
    i += 1;
    nameToUse = `${baseName}_${i}`;
    if (i > 50) throw new Error(`无法为 ${tableName}.${col} 生成可用的外键名，请人工 double check`);
  }

  const deleteRule = nullable ? 'ON DELETE SET NULL' : 'ON DELETE CASCADE';
  const sql = `ALTER TABLE \`${tableName}\` ADD CONSTRAINT \`${nameToUse}\` FOREIGN KEY (\`${col}\`) REFERENCES \`user\` (id) ${deleteRule}`;
  await execMaybe({ connection, sql, apply });
}

async function discoverAuthShadowTasks(params: { connection: mysql.Connection; dbName: string }) {
  const { connection, dbName } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT TABLE_NAME AS table_name, COLUMN_NAME AS column_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ?
       AND COLUMN_NAME LIKE '%\\\\_auth' ESCAPE '\\\\'
     ORDER BY TABLE_NAME, COLUMN_NAME`,
    [dbName]
  );

  const tasks: AuthShadowTask[] = [];
  for (const r of rows || []) {
    const tableName = String(r.table_name || '').trim();
    const authCol = String(r.column_name || '').trim();
    if (!tableName || !authCol) continue;
    if (!authCol.endsWith('_auth')) continue;
    const baseCol = authCol.slice(0, -'_auth'.length);
    if (!baseCol) continue;
    if (baseCol === authCol) continue;
    tasks.push({ tableName, authCol, baseCol });
  }
  return tasks;
}

async function processTask(params: {
  connection: mysql.Connection;
  dbName: string;
  task: AuthShadowTask;
  apply: boolean;
}) {
  const { connection, dbName, task, apply } = params;
  const { tableName, authCol, baseCol } = task;

  const baseExists = await columnExists(connection, dbName, tableName, baseCol);
  if (!baseExists) {
    console.log(`⚠️  跳过：${tableName}.${authCol} -> ${baseCol}（未找到主列 ${baseCol}）`);
    return { status: 'skipped_no_base' as const };
  }

  const baseMeta = await getColumnMeta({ connection, dbName, tableName, col: baseCol });
  const authMeta = await getColumnMeta({ connection, dbName, tableName, col: authCol });
  const baseNullable = !!baseMeta?.isNullable;
  const nullSql = baseNullable ? 'NULL' : 'NOT NULL';

  // 1) 删除 baseCol 上的所有外键（避免类型变更 / 外键重建冲突）
  const baseFks = await getForeignKeysForColumn({ connection, dbName, tableName, col: baseCol });
  if (baseFks.length > 0) {
    await dropForeignKeysByNames({
      connection,
      tableName,
      constraintNames: baseFks.map((x) => x.constraintName),
      apply,
    });
  }

  // 2) 如需，将 baseCol 改为 varchar(36) utf8mb4_unicode_ci（保持可空性）
  if (!isAuthUserIdColumn(baseMeta)) {
    const sql = `ALTER TABLE \`${tableName}\` MODIFY COLUMN \`${baseCol}\` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullSql}`;
    await execMaybe({ connection, sql, apply });
  }

  // 3) 回填：authCol -> baseCol
  // dry-run 下先统计预计影响行数
  const willUpdateCnt = await queryCount({
    connection,
    sql: `SELECT COUNT(*) AS cnt
          FROM \`${tableName}\`
          WHERE \`${authCol}\` IS NOT NULL AND \`${authCol}\` <> ''
            AND (\`${baseCol}\` IS NULL OR \`${baseCol}\` = '' OR \`${baseCol}\` <> \`${authCol}\`)`,
  });

  if (willUpdateCnt > 0) {
    const sql = `UPDATE \`${tableName}\`
                 SET \`${baseCol}\` = \`${authCol}\`
                 WHERE \`${authCol}\` IS NOT NULL AND \`${authCol}\` <> ''
                   AND (\`${baseCol}\` IS NULL OR \`${baseCol}\` = '' OR \`${baseCol}\` <> \`${authCol}\`)`;
    await execMaybe({ connection, sql, apply });
  }

  // 4) 不可空列：校验是否还有空值
  if (!baseNullable) {
    const missingCnt = await queryCount({
      connection,
      sql: `SELECT COUNT(*) AS cnt
            FROM \`${tableName}\`
            WHERE \`${baseCol}\` IS NULL OR \`${baseCol}\` = ''`,
    });
    if (missingCnt > 0) {
      throw new Error(
        `检测到 ${tableName}.${baseCol} 仍存在空值（cnt=${missingCnt}），无法确保外键正确；请人工 double check`
      );
    }
  }

  // 5) 外键安全校验：baseCol 非空值必须在 user.id 中存在，否则加 FK 会失败
  const invalidRefCnt = await queryCount({
    connection,
    sql: `SELECT COUNT(*) AS cnt
          FROM \`${tableName}\` t
          LEFT JOIN \`user\` u ON u.id = t.\`${baseCol}\`
          WHERE t.\`${baseCol}\` IS NOT NULL AND t.\`${baseCol}\` <> ''
            AND u.id IS NULL`,
  });
  if (invalidRefCnt > 0) {
    throw new Error(
      `检测到 ${tableName}.${baseCol} 存在无效 user 引用（cnt=${invalidRefCnt}），请先修复数据后再继续（人工 double check）`
    );
  }

  // 6) 确保 baseCol -> user(id) 外键
  await ensureUserForeignKey({
    connection,
    dbName,
    tableName,
    col: baseCol,
    nullable: baseNullable,
    apply,
  });

  // 7) 删除 authCol 上的外键（若存在），否则 DROP COLUMN 可能失败
  const authFks = await getForeignKeysForColumn({ connection, dbName, tableName, col: authCol });
  if (authFks.length > 0) {
    await dropForeignKeysByNames({
      connection,
      tableName,
      constraintNames: authFks.map((x) => x.constraintName),
      apply,
    });
  }

  // 8) 删除 authCol 上的索引（若存在）
  const authIndexes = await listIndexesByColumn({ connection, dbName, tableName, col: authCol });
  if (authIndexes.length > 0) {
    await dropIndexesByNames({ connection, tableName, indexNames: authIndexes, apply });
  }

  // 9) 删除 authCol 列
  // 如果 authCol 已不存在，跳过（保证可重复执行）
  const authExists = await columnExists(connection, dbName, tableName, authCol);
  if (!authExists) {
    console.log(`✓ 已清理：${tableName}.${authCol}（列已不存在）`);
    return { status: 'already_dropped' as const, willUpdateCnt };
  }

  if (authMeta) {
    const sql = `ALTER TABLE \`${tableName}\` DROP COLUMN \`${authCol}\``;
    await execMaybe({ connection, sql, apply });
  } else {
    // 理论不会走到这里；保护性输出
    console.log(`⚠️  未读取到 ${tableName}.${authCol} 元信息，但列存在，仍将尝试删除`);
    const sql = `ALTER TABLE \`${tableName}\` DROP COLUMN \`${authCol}\``;
    await execMaybe({ connection, sql, apply });
  }

  console.log(`✓ 处理完成：${tableName}.${authCol} -> ${tableName}.${baseCol}（预计回填 ${willUpdateCnt} 行）`);
  return { status: 'done' as const, willUpdateCnt };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apply = toBool(args.apply, false);
  const dbName = String(args.dbName || process.env.DATABASE_NAME || 'ai_interview');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: dbName,
  });

  console.log('开始清理 *_auth 过渡列（production）');
  console.log(`- db: ${dbName}`);
  console.log(`- apply: ${apply}`);

  try {
    const tasks = await discoverAuthShadowTasks({ connection, dbName });
    console.log(`发现 *_auth 列：${tasks.length} 个`);
    if (tasks.length <= 0) {
      console.log('无 *_auth 列需要处理，退出');
      return;
    }

    const summary = {
      total: tasks.length,
      done: 0,
      alreadyDropped: 0,
      skippedNoBase: 0,
      estimatedUpdated: 0,
    };

    for (const t of tasks) {
      const res = await processTask({ connection, dbName, task: t, apply });
      summary.estimatedUpdated += Number((res as any)?.willUpdateCnt || 0);
      if ((res as any)?.status === 'done') summary.done += 1;
      if ((res as any)?.status === 'already_dropped') summary.alreadyDropped += 1;
      if ((res as any)?.status === 'skipped_no_base') summary.skippedNoBase += 1;
    }

    const remaining = await queryCount({
      connection,
      sql: `SELECT COUNT(*) AS cnt
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = ?
              AND COLUMN_NAME LIKE '%\\\\_auth' ESCAPE '\\\\'`,
      values: [dbName],
    });

    console.log('--- 汇总 ---');
    console.log(`total=${summary.total}`);
    console.log(`done=${summary.done}`);
    console.log(`alreadyDropped=${summary.alreadyDropped}`);
    console.log(`skippedNoBase=${summary.skippedNoBase}`);
    console.log(`estimatedUpdated=${summary.estimatedUpdated}`);
    console.log(`remaining_auth_columns=${remaining}`);
    console.log('完成');
  } catch (error) {
    console.error('执行失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();


