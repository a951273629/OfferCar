import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('开始迁移：为 exam_sessions/interview_sessions 表添加 session_config_json 字段');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('已连接到数据库:', process.env.DATABASE_NAME);

    // exam_sessions
    const [examSessionCols] = await connection.query(
      "SHOW COLUMNS FROM exam_sessions LIKE 'session_config_json'"
    );
    if ((examSessionCols as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE exam_sessions
        ADD COLUMN session_config_json TEXT COMMENT '会话配置(JSON)' AFTER feedback
      `);
      console.log('exam_sessions.session_config_json 添加成功');
    } else {
      console.log('exam_sessions.session_config_json 已存在，跳过');
    }

    // interview_sessions
    const [interviewSessionCols] = await connection.query(
      "SHOW COLUMNS FROM interview_sessions LIKE 'session_config_json'"
    );
    if ((interviewSessionCols as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE interview_sessions
        ADD COLUMN session_config_json TEXT COMMENT '会话配置(JSON)' AFTER feedback
      `);
      console.log('interview_sessions.session_config_json 添加成功');
    } else {
      console.log('interview_sessions.session_config_json 已存在，跳过');
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


