/**
 * users(int) -> better-auth.user(varchar) 全量迁移脚本（一次性收敛）
 *
 * ⚠️ Legacy 脚本：
 * - 仅用于历史数据迁移/修复，不作为日常流程
 * - 如果你的库已经完成迁移并准备彻底移除 legacy 表 users，请使用：
 *   scripts/develop/drop-legacy-users.ts
 *
 * 目标：
 * - 以 `better-auth.user.id` 作为全局用户主键（varchar(36) / UUID）
 * - 将旧业务表 `users` 的业务字段迁移到 `user_profile`
 * - 将所有引用 `users.id` 的外键列迁移为引用 `user.id`
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/develop/migrate-users-to-auth-user.ts
 *
 * 可选参数：
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

async function getForeignKeysReferencingTable(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  referencedTable: string;
}) {
  const { connection, dbName, tableName, referencedTable } = params;
  const [rows] = await connection.query<any[]>(
    `SELECT CONSTRAINT_NAME AS constraint_name
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ?
       AND TABLE_NAME = ?
       AND REFERENCED_TABLE_NAME = ?
       AND CONSTRAINT_NAME IS NOT NULL
     GROUP BY CONSTRAINT_NAME`,
    [dbName, tableName, referencedTable]
  );
  return (rows || []).map((r) => String(r.constraint_name)).filter((n) => n && n !== 'PRIMARY');
}

async function dropForeignKeysToUsers(params: {
  connection: mysql.Connection;
  dbName: string;
  tableName: string;
  referencedTable: string;
}) {
  const { connection, dbName, tableName, referencedTable } = params;
  const constraints = await getForeignKeysReferencingTable({
    connection,
    dbName,
    tableName,
    referencedTable,
  });
  for (const c of constraints) {
    await connection.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${c}\``);
  }
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
      auth_user_id VARCHAR(36) COLLATE utf8mb4_unicode_ci NOT NULL,
      balance INT NOT NULL DEFAULT 0 COMMENT '用户余额（点数）',
      referrer_auth_user_id VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '推荐人用户ID（auth）',
      referral_code VARCHAR(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '邀请码（用户邮箱）',
      distributor_balance DECIMAL(10,2) DEFAULT '0.00' COMMENT '分销余额（人民币，可提现）',
      is_active TINYINT(1) DEFAULT '1' COMMENT '用户状态（启用/禁用）',
      global_config_json TEXT COLLATE utf8mb4_unicode_ci COMMENT '用户全局配置(JSON)',
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
    `ALTER TABLE \`${fk.table}\` ADD COLUMN \`${shadow}\` VARCHAR(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL`
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

async function finalizeColumnSwap(params: {
  connection: mysql.Connection;
  dbName: string;
  fk: LegacyFK;
}) {
  const { connection, dbName, fk } = params;
  const shadow = `${fk.col}_auth`;

  // 1) drop 旧外键（指向 users）
  await dropForeignKeysToUsers({
    connection,
    dbName,
    tableName: fk.table,
    referencedTable: 'users',
  });

  // 2) 删除旧列，shadow 改名为原列名（并设置 nullability）
  await connection.query(`ALTER TABLE \`${fk.table}\` DROP COLUMN \`${fk.col}\``);

  const nullSql = fk.nullable ? 'NULL' : 'NOT NULL';
  await connection.query(
    `ALTER TABLE \`${fk.table}\` CHANGE COLUMN \`${shadow}\` \`${fk.col}\` VARCHAR(36) COLLATE utf8mb4_unicode_ci ${nullSql}`
  );

  // 3) 新外键指向 better-auth.user(id)
  const fkName = `fk_${fk.table}_${fk.col}_auth_user`;
  const deleteRule = fk.nullable ? 'ON DELETE SET NULL' : 'ON DELETE CASCADE';
  await connection.query(
    `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${fkName}\` FOREIGN KEY (\`${fk.col}\`) REFERENCES \`user\` (id) ${deleteRule}`
  );

  // 4) 加索引（如果已经有同名 index 会失败；这里用存在性判断）
  const idxName = `idx_${fk.col}`;
  const [idxRows] = await connection.query<any[]>(
    `SELECT COUNT(*) AS cnt
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [dbName, fk.table, idxName]
  );
  const idxExists = Number((idxRows || [])[0]?.cnt || 0) > 0;
  if (!idxExists) {
    await connection.query(`ALTER TABLE \`${fk.table}\` ADD INDEX \`${idxName}\` (\`${fk.col}\`)`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const finalize = toBool(args.finalize, true);
  const dropLegacyUsers = toBool(args.dropLegacyUsers, false);

  const dbName = String('dev_ai_interview');
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: dbName,
  });

  console.log('🚀 开始 users(int) -> auth user(varchar) 迁移');
  console.log(`- db: ${dbName}`);
  console.log(`- finalize: ${finalize}`);
  console.log(`- dropLegacyUsers: ${dropLegacyUsers}`);

  try {
    const hasLegacyUsers = await tableExists(connection, dbName, 'users');
    if (!hasLegacyUsers) {
      throw new Error('未找到 legacy 表 users，无法迁移');
    }

    const hasAuthUser = await tableExists(connection, dbName, 'user');
    if (!hasAuthUser) {
      throw new Error('未找到 better-auth 表 user，请先执行 better-auth 初始化（或先创建 auth 表）');
    }

    // 1) 确保 better-auth.user 存在所有 legacy users 的 email
    await ensureBetterAuthUsersExist(connection);
    console.log('✓ better-auth.user 已补齐（如有缺失）');

    // 2) 建立临时映射（legacy_user_id -> auth_user_id）
    await createTempUserMap(connection);
    console.log('✓ tmp_user_map 已生成');

    // 3) 创建 user_profile 并迁移 users 业务字段
    await ensureUserProfileTable(connection);
    await migrateUsersToUserProfile(connection);
    console.log('✓ user_profile 已迁移/更新');

    // 4) 影子列 + 回填
    for (const fk of LEGACY_FKS) {
      await addAuthShadowColumn({ connection, dbName, fk });
      await backfillAuthShadowColumn({ connection, fk });
      console.log(`✓ backfill: ${fk.table}.${fk.col} -> ${fk.table}.${fk.col}_auth`);
    }

    // 5) finalize：替换列 / 改外键（指向 user.id）
    if (finalize) {
      // 避免外键在过程中阻塞：统一关闭，最后再打开
      await connection.query('SET FOREIGN_KEY_CHECKS=0');
      for (const fk of LEGACY_FKS) {
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

    console.log('\n🎉 迁移完成');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

main();


