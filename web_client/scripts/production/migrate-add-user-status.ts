import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：添加用户状态字段...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 修改 users 表，添加 is_active 字段
    console.log('\n📝 步骤 1: 修改 users 表，添加 is_active 字段...');
    
    // 检查字段是否已存在
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'is_active'"
    );
    
    if ((columns as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN is_active BOOLEAN DEFAULT TRUE COMMENT '用户状态（启用/禁用）',
        ADD INDEX idx_is_active (is_active)
      `);
      console.log('✅ users 表 is_active 字段添加成功');
      
      // 确保所有现有用户都是启用状态
      await connection.query(`
        UPDATE users 
        SET is_active = TRUE 
        WHERE is_active IS NULL
      `);
      console.log('✅ 已为现有用户设置启用状态');
    } else {
      console.log('⚠️  users 表 is_active 字段已存在，跳过');
    }

    // 验证字段创建
    console.log('\n🔍 验证表结构...');
    
    const [usersCols] = await connection.query('DESCRIBE users');
    console.log('\n📋 users 表 is_active 字段:');
    (usersCols as any[])
      .filter(col => col.Field === 'is_active')
      .forEach((col) => {
        console.log(`   ${col.Field} (${col.Type}) Default: ${col.Default} ${col.Key ? `[${col.Key}]` : ''}`);
      });

    console.log('\n🎉 迁移完成！用户状态字段已准备就绪');

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

