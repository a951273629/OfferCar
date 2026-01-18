import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：添加客户端下载配置表...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 创建 client_downloads 表
    console.log('\n📝 创建 client_downloads 表...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS client_downloads (
        id INT AUTO_INCREMENT PRIMARY KEY,
        download_type ENUM('local', 'external') NOT NULL COMMENT '下载类型：local=本地文件, external=外部链接',
        download_url VARCHAR(2000) NOT NULL COMMENT '下载URL（本地：/downloads/xxx.msi，外部：https://...）',
        file_name VARCHAR(255) NOT NULL COMMENT '文件名',
        version VARCHAR(50) NOT NULL COMMENT '版本号',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否为当前激活版本',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_is_active (is_active),
        INDEX idx_created_at (created_at DESC)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户端下载配置表'
    `;
    
    await connection.query(createTableSQL);
    console.log('✅ client_downloads 表创建成功');

    // 验证表创建
    console.log('\n🔍 验证表结构...');
    
    const [columns] = await connection.query('DESCRIBE client_downloads');
    console.log('\n📋 client_downloads 表结构:');
    (columns as any[]).forEach((col) => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''} - ${col.Comment || ''}`);
    });

    console.log('\n🎉 迁移完成！客户端下载配置表已准备就绪');

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

