import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function fix() {
  console.log('🚀 开始修复：扩展 client_downloads.download_url 字段长度...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 检查表是否存在
    const [tables] = await connection.query(
      "SHOW TABLES LIKE 'client_downloads'"
    );

    if ((tables as any[]).length === 0) {
      console.log('⚠️  client_downloads 表不存在，将创建新表...');
      
      const createTableSQL = `
        CREATE TABLE client_downloads (
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
    } else {
      console.log('📝 修改 download_url 字段长度...');
      
      await connection.query(`
        ALTER TABLE client_downloads 
        MODIFY COLUMN download_url VARCHAR(2000) NOT NULL COMMENT '下载URL（本地：/downloads/xxx.msi，外部：https://...）'
      `);
      
      console.log('✅ download_url 字段长度已扩展为 VARCHAR(2000)');
    }

    // 验证字段
    console.log('\n🔍 验证字段结构...');
    const [columns] = await connection.query(
      "SHOW FULL COLUMNS FROM client_downloads WHERE Field = 'download_url'"
    );
    
    if ((columns as any[]).length > 0) {
      const col = (columns as any[])[0];
      console.log(`\n📋 download_url 字段信息:`);
      console.log(`   类型: ${col.Type}`);
      console.log(`   注释: ${col.Comment}`);
    }

    console.log('\n🎉 修复完成！现在可以支持更长的下载链接');

  } catch (error) {
    console.error('\n❌ 修复失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行修复
fix();

