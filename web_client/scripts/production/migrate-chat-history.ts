import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：添加 chat_histories 表...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS chat_histories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        interview_id INT NOT NULL COMMENT '关联的面试 ID',
        user_id INT NOT NULL COMMENT '用户 ID',
        question TEXT NOT NULL COMMENT '用户提问内容',
        answer TEXT NOT NULL COMMENT 'AI 回答内容',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_interview_id (interview_id),
        INDEX idx_user_id (user_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    console.log('📝 执行 SQL...');
    await connection.query(createTableSQL);
    console.log('✅ chat_histories 表创建成功\n');

    // 验证表创建
    console.log('🔍 验证表结构...');
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'chat_histories'"
    );
    
    if ((tables as any[]).length > 0) {
      console.log('✅ chat_histories 表存在');
      
      // 显示表结构
      const [columns] = await connection.query(
        'DESCRIBE chat_histories'
      );
      console.log('\n📋 表结构:');
      (columns as any[]).forEach((col) => {
        console.log(`   ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
      });
    } else {
      console.error('❌ 表未创建成功');
    }

    console.log('\n🎉 迁移完成！');

  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行迁移
migrate();

