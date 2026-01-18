/**
 * users(int) -> better-auth.user(varchar) 全量迁移脚本（一次性收敛）
 *
 * 目标（以 scripts/develop/schema.sql 为真源）：
 * - 以 `user.id` 作为全局用户主键（varchar(36) / UUID）
 * - 将 legacy `users` 的业务字段迁移到 `user_profile`
 * - 将所有引用 `users.id` 的外键列迁移为引用 `user.id`
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/production/migrate-users-to-auth-user.ts
 *
 * 可选参数：
 *   --dbName <name>                目标库名（默认使用 DATABASE_NAME，否则 ai_interview）
 *   --finalize true|false          是否执行“替换列/改外键/删除旧列”（默认 true）
 *   --dropLegacyUsers true|false   是否删除旧 `users` 表（默认 false，强烈建议手动确认后再删）
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

type LegacyFK = {
  table: string;
  col: string;
  nullable: boolean;
};

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

type IndexColumnDef = {
  name: string;
  order: 'A' | 'D';
};

type IndexDef = {
  name: string;
  unique: boolean;
  columns: IndexColumnDef[];
};

const LEGACY_FKS: LegacyFK[] = [
  { table: 'admins', col: 'user_id', nullable: false },
  { table: 'bills', col: 'user_id', nullable: false },
  { table: 'card_codes', col: 'used_by', nullable: true },
  { table: 'chat_histories', col: 'user_id', nullable: false },
  { table: 'commissions', col: 'user_id', nullable: false },
  { table: 'commissions', col: 'from_user_id', nullable: false },
  { table: 'exam_chat_histories', col: 'user_id', nullable: false },
  { table: 'exams', col: 'user_id', nullable: false },
  { table: 'interviews', col: 'user_id', nullable: false },
  { table: 'knowledge_bases', col: 'user_id', nullable: true }, // NULL=官方知识库
  { table: 'orders', col: 'user_id', nullable: false },
  { table: 'withdrawals', col: 'user_id', nullable: false },
];

// 基于 scripts/develop/schema.sql 的“期望索引”（只覆盖与迁移列相关的索引）
const EXPECTED_INDEXES_BY_TABLE: Record<string, IndexDef[]> = {
  admins: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  bills: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  card_codes: [{ name: 'idx_used_by', unique: false, columns: [{ name: 'used_by', order: 'A' }] }],
  chat_histories: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  commissions: [
    { name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] },
    { name: 'idx_from_user_id', unique: false, columns: [{ name: 'from_user_id', order: 'A' }] },
  ],
  exam_chat_histories: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  exams: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  interviews: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  knowledge_bases: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  orders: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
  withdrawals: [{ name: 'idx_user_id', unique: false, columns: [{ name: 'user_id', order: 'A' }] }],
};

async function tableExists(connection: mysql.Connection, dbName: string, tableName: string) {
  const [rows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [dbName, tableName]
  );
  return Number((rows || [])[0]?.cnt || 0) > 0;
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
}) {
  const { connection, tableName, constraintNames } = params;
  for (const c of constraintNames) {
    const name = String(c || '').trim();
    if (!name || name === 'PRIMARY') continue;
    await connection.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${name}\``);
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

async function getIndexDefByName(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  indexName: string;
}): Promise<IndexDef | null> {
  const { connection, dbName, tableName, indexName } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT
       INDEX_NAME AS index_name,
       NON_UNIQUE AS non_unique,
       SEQ_IN_INDEX AS seq_in_index,
       COLUMN_NAME AS column_name,
       COLLATION AS collation
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?
     ORDER BY SEQ_IN_INDEX`,
    [dbName, tableName, indexName]
  );
  if (!rows || rows.length <= 0) return null;
  const nonUnique = Number(rows[0]?.non_unique || 0) > 0;
  const def: IndexDef = { name: indexName, unique: !nonUnique, columns: [] };
  for (const r of rows) {
    const colName = String(r.column_name || '');
    if (!colName) continue;
    const order = String(r.collation || 'A').toUpperCase() === 'D' ? 'D' : 'A';
    def.columns.push({ name: colName, order });
  }
  return def.columns.length > 0 ? def : null;
}

function normalizeIndexDef(def: IndexDef) {
  return {
    unique: !!def.unique,
    columns: def.columns.map((c) => ({ name: c.name, order: c.order === 'D' ? 'D' : 'A' })),
  };
}

function indexDefEquals(a: IndexDef, b: IndexDef) {
  const na = normalizeIndexDef(a);
  const nb = normalizeIndexDef(b);
  if (na.unique !== nb.unique) return false;
  if (na.columns.length !== nb.columns.length) return false;
  for (let i = 0; i < na.columns.length; i++) {
    const ca = na.columns[i];
    const cb = nb.columns[i];
    if (ca.name !== cb.name) return false;
    if (ca.order !== cb.order) return false;
  }
  return true;
}

function buildAddIndexSql(params: { tableName: string; def: IndexDef }) {
  const { tableName, def } = params;
  const colsSql = def.columns
    .map((c) => {
      const orderSql = c.order === 'D' ? ' DESC' : '';
      return `\`${c.name}\`${orderSql}`;
    })
    .join(', ');
  const uniqueSql = def.unique ? 'UNIQUE ' : '';
  return `ALTER TABLE \`${tableName}\` ADD ${uniqueSql}INDEX \`${def.name}\` (${colsSql})`;
}

async function ensureIndexes(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  defs: IndexDef[];
}) {
  const { connection, dbName, tableName, defs } = params;
  for (const def of defs) {
    const name = String(def.name || '').trim();
    if (!name || name === 'PRIMARY') continue;
    const existing = await getIndexDefByName({ connection, dbName, tableName, indexName: name });
    if (!existing) {
      await connection.query(buildAddIndexSql({ tableName, def }));
      continue;
    }
    if (!indexDefEquals(existing, def)) {
      throw new Error(`索引定义不一致，需要人工 double check：${tableName}.${name}`);
    }
  }
}

async function ensureAuthForeignKey(params: {
  connection: mysql.Connection;
  dbName: string;
  fk: LegacyFK;
}) {
  const { connection, dbName, fk } = params;

  const colExists = await columnExists(connection, dbName, fk.table, fk.col);
  if (!colExists) return;

  const fks = await getForeignKeysForColumn({
    connection,
    dbName,
    tableName: fk.table,
    col: fk.col,
  });
  const hasAuthFk = fks.some((x) => x.referencedTable === 'user' && x.referencedColumn === 'id');
  if (hasAuthFk) return;

  const baseName = `fk_${fk.table}_${fk.col}_auth_user`;
  let nameToUse = baseName;
  let i = 0;
  while (await constraintExists({ connection, dbName, tableName: fk.table, constraintName: nameToUse })) {
    // 同名 constraint 已存在但不是我们要的 FK，则换一个名字，避免冲突
    const [sameNameFkRows] = await connection.query<any[]>(
      `SELECT COUNT(*) AS cnt
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = ?
         AND CONSTRAINT_NAME = ?
         AND COLUMN_NAME = ?
         AND REFERENCED_TABLE_NAME = 'user'
         AND REFERENCED_COLUMN_NAME = 'id'`,
      [dbName, fk.table, nameToUse, fk.col]
    );
    const cnt = Number((sameNameFkRows || [])[0]?.cnt || 0);
    if (cnt > 0) return;
    i += 1;
    nameToUse = `${baseName}_${i}`;
    if (i > 50) throw new Error(`无法为 ${fk.table}.${fk.col} 生成可用的外键名，请人工 double check`);
  }

  const deleteRule = fk.nullable ? 'ON DELETE SET NULL' : 'ON DELETE CASCADE';
  await connection.query(
    `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${nameToUse}\` FOREIGN KEY (\`${fk.col}\`) REFERENCES \`user\` (id) ${deleteRule}`
  );
}

async function ensureBetterAuthUsersExist(connection: mysql.Connection) {
  // 将 legacy users 中存在，但 better-auth.user 中缺失的 email 批量补齐
  // emailVerified：保守设为 0（用户仍需要走 OTP/验证）
  await connection.query(`
    INSERT INTO \`user\` (id, name, email, emailVerified, image, createdAt, updatedAt)
    SELECT
      UUID(),
      u.name,
      u.email,
      0,
      NULL,
      NOW(3),
      NOW(3)
    FROM users u
    LEFT JOIN \`user\` au ON au.email = u.email
    WHERE au.id IS NULL
  `);
}

async function createTempUserMap(connection: mysql.Connection) {
  await connection.query(`
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_user_map (
      legacy_user_id INT PRIMARY KEY,
      auth_user_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      UNIQUE KEY uniq_auth_user_id (auth_user_id),
      UNIQUE KEY uniq_email (email)
    ) ENGINE=MEMORY
  `);

  // MySQL 限制：同一条 SQL 中重复引用同一张 TEMPORARY TABLE 可能触发 ER_CANT_REOPEN_TABLE
  // 这里准备一份等价的临时表，用于在 UPDATE 时作为第二次引用（例如推荐人回填）
  await connection.query(`
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_user_map_ref (
      legacy_user_id INT PRIMARY KEY,
      auth_user_id VARCHAR(36) NOT NULL,
      email VARCHAR(255) NOT NULL,
      UNIQUE KEY uniq_auth_user_id (auth_user_id),
      UNIQUE KEY uniq_email (email)
    ) ENGINE=MEMORY
  `);

  await connection.query('TRUNCATE TABLE tmp_user_map');
  await connection.query('TRUNCATE TABLE tmp_user_map_ref');

  await connection.query(`
    INSERT INTO tmp_user_map (legacy_user_id, auth_user_id, email)
    SELECT u.id, au.id, u.email
    FROM users u
    JOIN \`user\` au ON au.email = u.email
  `);

  await connection.query(`
    INSERT INTO tmp_user_map_ref (legacy_user_id, auth_user_id, email)
    SELECT legacy_user_id, auth_user_id, email
    FROM tmp_user_map
  `);
}

async function ensureUserProfileTable(connection: mysql.Connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_profile (
      auth_user_id varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      balance int NOT NULL DEFAULT '0' COMMENT '用户余额（点数）',
      referrer_auth_user_id varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐人用户ID（auth）',
      referral_code varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邀请码（用户邮箱）',
      distributor_balance decimal(10,2) DEFAULT '0.00' COMMENT '分销余额（人民币，可提现）',
      is_active tinyint(1) DEFAULT '1' COMMENT '用户状态（启用/禁用）',
      global_config_json text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '用户全局配置(JSON)',
      created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (auth_user_id),
      KEY idx_referrer_auth_user_id (referrer_auth_user_id),
      KEY idx_referral_code (referral_code),
      KEY idx_is_active (is_active),
      CONSTRAINT fk_user_profile_auth_user FOREIGN KEY (auth_user_id) REFERENCES \`user\` (id) ON DELETE CASCADE,
      CONSTRAINT fk_user_profile_referrer FOREIGN KEY (referrer_auth_user_id) REFERENCES \`user\` (id) ON DELETE SET NULL,
      CONSTRAINT chk_positive_distributor_balance CHECK ((distributor_balance >= 0))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务用户扩展表（以 better-auth.user 为主键）'
  `);
}

async function migrateUsersToUserProfile(connection: mysql.Connection) {
  // 先把业务字段写进 user_profile（不写 email/name，统一在 better-auth.user）
  await connection.query(`
    INSERT INTO user_profile (
      auth_user_id, balance, referrer_auth_user_id, referral_code,
      distributor_balance, is_active, global_config_json, created_at, updated_at
    )
    SELECT
      m.auth_user_id,
      u.balance,
      NULL,
      u.referral_code,
      u.distributor_balance,
      u.is_active,
      u.global_config_json,
      u.created_at,
      u.updated_at
    FROM users u
    JOIN tmp_user_map m ON m.legacy_user_id = u.id
    ON DUPLICATE KEY UPDATE
      balance = VALUES(balance),
      referral_code = VALUES(referral_code),
      distributor_balance = VALUES(distributor_balance),
      is_active = VALUES(is_active),
      global_config_json = VALUES(global_config_json),
      updated_at = VALUES(updated_at)
  `);

  // 再回填推荐人 auth id（需要二次 JOIN）
  await connection.query(`
    UPDATE user_profile p
    JOIN tmp_user_map m ON m.auth_user_id = p.auth_user_id
    JOIN users u ON u.id = m.legacy_user_id
    LEFT JOIN tmp_user_map_ref rm ON rm.legacy_user_id = u.referrer_id
    SET p.referrer_auth_user_id = rm.auth_user_id
    WHERE u.referrer_id IS NOT NULL
  `);
}

async function addAuthShadowColumn(params: {
  connection: mysql.Connection;
  dbName: string;
  fk: LegacyFK;
}) {
  const { connection, dbName, fk } = params;
  const shadow = `${fk.col}_auth`;
  const exists = await columnExists(connection, dbName, fk.table, shadow);
  if (exists) return;
  await connection.query(
    `ALTER TABLE \`${fk.table}\` ADD COLUMN \`${shadow}\` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL`
  );
}

async function backfillAuthShadowColumn(params: { connection: mysql.Connection; fk: LegacyFK }) {
  const { connection, fk } = params;
  const shadow = `${fk.col}_auth`;
  await connection.query(`
    UPDATE \`${fk.table}\` t
    JOIN tmp_user_map m ON t.\`${fk.col}\` = m.legacy_user_id
    SET t.\`${shadow}\` = m.auth_user_id
    WHERE t.\`${fk.col}\` IS NOT NULL
      AND (t.\`${shadow}\` IS NULL OR t.\`${shadow}\` = '')
  `);
}

async function needsLegacyUserMap(params: { connection: mysql.Connection; dbName: string }) {
  const { connection, dbName } = params;
  for (const fk of LEGACY_FKS) {
    const tExists = await tableExists(connection, dbName, fk.table);
    if (!tExists) continue;
    const cExists = await columnExists(connection, dbName, fk.table, fk.col);
    if (!cExists) continue;
    const meta = await getColumnMeta({ connection, dbName, tableName: fk.table, col: fk.col });
    if (!isAuthUserIdColumn(meta)) return true;
  }
  return false;
}

async function finalizeColumnSwap(params: {
  connection: mysql.Connection;
  dbName: string;
  fk: LegacyFK;
}) {
  const { connection, dbName, fk } = params;
  const shadow = `${fk.col}_auth`;

  const expectedForColumn = (EXPECTED_INDEXES_BY_TABLE[fk.table] || []).filter((d) =>
    d.columns.some((c) => c.name === fk.col)
  );

  const colExists = await columnExists(connection, dbName, fk.table, fk.col);
  const shadowExists = await columnExists(connection, dbName, fk.table, shadow);
  const colMeta = colExists
    ? await getColumnMeta({ connection, dbName, tableName: fk.table, col: fk.col })
    : null;
  const colIsAuth = isAuthUserIdColumn(colMeta);

  // 已完成：只补齐外键/索引，不做 destructive 操作
  if (colExists && colIsAuth) {
    await ensureAuthForeignKey({ connection, dbName, fk });
    await ensureIndexes({ connection, dbName, tableName: fk.table, defs: expectedForColumn });
    if (shadowExists) {
      console.log(`⚠️  检测到遗留 shadow 列：${fk.table}.${shadow}（已跳过删除，建议人工确认后清理）`);
    }
    return;
  }

  // 中间态：确保 shadow 存在
  if (!shadowExists) {
    if (!colExists) {
      throw new Error(`无法 finalize：${fk.table}.${fk.col} 与 ${shadow} 均不存在，请人工 double check`);
    }
    await addAuthShadowColumn({ connection, dbName, fk });
    await backfillAuthShadowColumn({ connection, fk });
  }

  // drop 该列上的所有外键（不区分引用 users/user），避免 ER_FK_COLUMN_CANNOT_DROP
  if (colExists) {
    const fks = await getForeignKeysForColumn({ connection, dbName, tableName: fk.table, col: fk.col });
    await dropForeignKeysByNames({
      connection,
      tableName: fk.table,
      constraintNames: fks.map((x) => x.constraintName),
    });
  }

  // 删除旧列（如果存在）
  if (colExists) {
    await connection.query(`ALTER TABLE \`${fk.table}\` DROP COLUMN \`${fk.col}\``);
  }

  const nullSql = fk.nullable ? 'NULL' : 'NOT NULL';
  await connection.query(
    `ALTER TABLE \`${fk.table}\` CHANGE COLUMN \`${shadow}\` \`${fk.col}\` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ${nullSql}`
  );

  await ensureAuthForeignKey({ connection, dbName, fk });
  await ensureIndexes({ connection, dbName, tableName: fk.table, defs: expectedForColumn });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const finalize = toBool(args.finalize, true);
  const dropLegacyUsers = toBool(args.dropLegacyUsers, false);
  const dbName = String(args.dbName || process.env.DATABASE_NAME || 'ai_interview');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: dbName,
  });

  console.log('开始 users(int) -> auth user(varchar) 迁移（production）');
  console.log(`- db: ${dbName}`);
  console.log(`- finalize: ${finalize}`);
  console.log(`- dropLegacyUsers: ${dropLegacyUsers}`);

  try {
    const hasAuthUser = await tableExists(connection, dbName, 'user');
    if (!hasAuthUser) {
      throw new Error('未找到 better-auth 表 user，请先执行 better-auth 初始化（或先创建 auth 表）');
    }

    const needMap = await needsLegacyUserMap({ connection, dbName });
    const hasLegacyUsers = await tableExists(connection, dbName, 'users');

    if (needMap && !hasLegacyUsers) {
      throw new Error('检测到仍有 int 用户外键列，但未找到 legacy 表 users，无法完成迁移');
    }

    // 1) 确保 better-auth.user 存在所有 legacy users 的 email（仅在需要 users 时执行）
    if (needMap) {
      await ensureBetterAuthUsersExist(connection);
      console.log('✓ better-auth.user 已补齐（如有缺失）');

      // 2) 建立临时映射（legacy_user_id -> auth_user_id）
      await createTempUserMap(connection);
      console.log('✓ tmp_user_map 已生成');
    } else {
      console.log('✓ 未检测到 int 用户外键列，跳过 tmp_user_map 生成');
    }

    // 3) 创建 user_profile 并迁移 users 业务字段（仅在存在 users 时迁移）
    await ensureUserProfileTable(connection);
    if (needMap) {
      await migrateUsersToUserProfile(connection);
      console.log('✓ user_profile 已迁移/更新');
    } else {
      console.log('✓ user_profile 已确保存在（无需从 users 迁移）');
    }

    // 4) 影子列 + 回填（仅在需要 users map 时回填）
    if (needMap) {
      for (const fk of LEGACY_FKS) {
        const tExists = await tableExists(connection, dbName, fk.table);
        if (!tExists) continue;
        const cExists = await columnExists(connection, dbName, fk.table, fk.col);
        if (!cExists) continue;
        const meta = await getColumnMeta({ connection, dbName, tableName: fk.table, col: fk.col });
        if (isAuthUserIdColumn(meta)) continue;
        await addAuthShadowColumn({ connection, dbName, fk });
        await backfillAuthShadowColumn({ connection, fk });
        console.log(`✓ backfill: ${fk.table}.${fk.col} -> ${fk.table}.${fk.col}_auth`);
      }
    }

    // 5) finalize：替换列 / 改外键（指向 user.id）
    if (finalize) {
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      for (const fk of LEGACY_FKS) {
        const tExists = await tableExists(connection, dbName, fk.table);
        if (!tExists) continue;
        await finalizeColumnSwap({ connection, dbName, fk });
        console.log(`✓ finalize: ${fk.table}.${fk.col}`);
      }
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
    }

    // 6) 可选：删除 legacy users 表（强烈建议你先人工 double check）
    if (dropLegacyUsers) {
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      await connection.query('DROP TABLE IF EXISTS `users`');
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
      console.log('⚠️  已删除 legacy 表 users');
    }

    console.log('迁移完成');
  } catch (error) {
    console.error('迁移失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();
