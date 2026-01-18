/**
 * 新增每日签到表，并扩展 bills.category 枚举增加 checkin
 *
 * - 每日签到按北京时间(Asia/Shanghai) 00:00 切日
 * - 通过 daily_checkins(user_id, checkin_date) 唯一键防止重复签到
 *
 * 用法（在 web_client 下执行）：
 *   npx ts-node --project scripts/tsconfig.json scripts/production/migrate-add-daily-checkins.ts
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

function parseEnumValues(columnType: string): string[] {
  const s = String(columnType || '');
  const matches = s.match(/'([^']+)'/g) || [];
  return matches.map((m) => m.slice(1, -1));
}

async function migrate() {
  let connection: mysql.Connection | null = null;

  try {
    console.log('🚀 开始迁移：新增每日签到表 + bills.category 扩展 checkin ...\n');

    const dbName = String(process.env.DATABASE_NAME || 'ai_interview');
    connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: dbName,
    });

    console.log('✅ 数据库连接成功:', dbName);

    // 1) 创建 daily_checkins 表（幂等）
    console.log('\n步骤 1: 创建 daily_checkins 表（如不存在）...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS daily_checkins (
        id INT NOT NULL AUTO_INCREMENT,
        user_id VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        checkin_date DATE NOT NULL COMMENT '北京时间日期',
        points INT NOT NULL DEFAULT 30 COMMENT '签到奖励点数',
        created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_user_date (user_id, checkin_date),
        KEY idx_user_date (user_id, checkin_date),
        CONSTRAINT fk_daily_checkins_user_id_auth_user FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日签到记录表'
    `);
    console.log('✓ daily_checkins 表已就绪');

    // 2) 扩展 bills.category enum 增加 checkin（幂等）
    console.log('\n步骤 2: 扩展 bills.category enum 增加 checkin...');
    const [rows] = await connection.query<any[]>(
      `
        SELECT COLUMN_TYPE AS column_type, COLLATION_NAME AS collation_name, IS_NULLABLE AS is_nullable, COLUMN_COMMENT AS column_comment
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = ?
          AND TABLE_NAME = 'bills'
          AND COLUMN_NAME = 'category'
        LIMIT 1
      `,
      [dbName]
    );

    const meta = (rows || [])[0];
    if (!meta) {
      throw new Error('未找到 bills.category 列，请确认 bills 表是否存在');
    }

    const columnType = String(meta.column_type || '');
    const currentEnums = parseEnumValues(columnType);
    const hasCheckin = currentEnums.includes('checkin');
    if (hasCheckin) {
      console.log('✓ bills.category 已包含 checkin，跳过');
    } else {
      const nextEnums = [...currentEnums, 'checkin'];
      const enumSql = nextEnums.map((v) => `'${v.replace(/'/g, "\\'")}'`).join(',');
      const collationName = String(meta.collation_name || 'utf8mb4_unicode_ci');
      const columnComment = String(meta.column_comment || '交易分类');

      // 注意：MySQL enum 修改需要把完整枚举列表写回
      const alterSql = `
        ALTER TABLE bills
        MODIFY COLUMN category ENUM(${enumSql}) COLLATE ${collationName} NOT NULL COMMENT ?
      `;
      await connection.query(alterSql, [columnComment]);
      console.log('✓ bills.category 已扩展：新增 checkin');
    }

    console.log('\n🎉 迁移完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 数据库连接已关闭');
    }
  }
}

migrate();


