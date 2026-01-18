import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('开始迁移：为 exams/interviews 表添加 default_session_config_json 字段');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('已连接到数据库:', process.env.DATABASE_NAME);

    // exams
    const [examCols] = await connection.query(
      "SHOW COLUMNS FROM exams LIKE 'default_session_config_json'"
    );
    if ((examCols as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE exams
        ADD COLUMN default_session_config_json TEXT COMMENT '默认会话配置(JSON)' AFTER status
      `);
      console.log('exams.default_session_config_json 添加成功');
    } else {
      console.log('exams.default_session_config_json 已存在，跳过');
    }

    // interviews
    const [interviewCols] = await connection.query(
      "SHOW COLUMNS FROM interviews LIKE 'default_session_config_json'"
    );
    if ((interviewCols as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE interviews
        ADD COLUMN default_session_config_json TEXT COMMENT '默认会话配置(JSON)' AFTER status
      `);
      console.log('interviews.default_session_config_json 添加成功');
    } else {
      console.log('interviews.default_session_config_json 已存在，跳过');
    }
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


