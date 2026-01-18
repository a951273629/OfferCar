import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('开始迁移：为 users 表添加 global_config_json 字段');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('已连接到数据库:', process.env.DATABASE_NAME);

    // 检查字段是否存在
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'global_config_json'"
    );

    if ((columns as any[]).length > 0) {
      console.log('字段 global_config_json 已存在，跳过');
      return;
    }

    await connection.query(`
      ALTER TABLE users
      ADD COLUMN global_config_json TEXT COMMENT '用户全局配置(JSON)' AFTER is_active
    `);

    console.log('字段 global_config_json 添加成功');
  } catch (error) {
    console.error('迁移失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('数据库连接已关闭');
  }
}

migrate();


