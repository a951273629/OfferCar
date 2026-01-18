// 数据库迁移脚本：添加简历内容字段
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateAddResumeContent() {
  console.log('[Migrate] 开始添加简历内容字段...');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('[Migrate] 数据库连接成功');

    // 检查字段是否已存在
    console.log('[Migrate] 检查现有表结构...');
    const [existingColumns] = await connection.query('DESCRIBE interviews');
    const columnNames = (existingColumns as any[]).map((col: any) => col.Field);
    
    if (columnNames.includes('resume_content')) {
      console.log('[Migrate] ⏭️  字段 resume_content 已存在，跳过迁移');
    } else {
      // 添加 resume_content 字段到 interviews 表
      console.log('[Migrate] 添加 resume_content 字段...');
      await connection.execute(`
        ALTER TABLE interviews 
        ADD COLUMN resume_content TEXT COMMENT '简历文本内容'
        AFTER resume_url
      `);
      console.log('[Migrate] ✅ 字段 resume_content 添加成功');
    }

    // 验证表结构
    console.log('\n[Migrate] 验证表结构...');
    const [finalColumns] = await connection.query('DESCRIBE interviews');
    const resumeContentField = (finalColumns as any[]).find((col: any) => col.Field === 'resume_content');
    
    if (resumeContentField) {
      console.log('[Migrate] ✅ 验证成功: resume_content 字段已存在');
      console.log(`   类型: ${resumeContentField.Type}`);
      console.log(`   可空: ${resumeContentField.Null}`);
      console.log(`   注释: ${resumeContentField.Comment || '(无)'}`);
    } else {
      throw new Error('字段 resume_content 未找到！');
    }

    console.log('\n[Migrate] ✅ 迁移成功完成！');
  } catch (error) {
    console.error('[Migrate] ❌ 迁移失败:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

migrateAddResumeContent()
  .then(() => {
    console.log('[Migrate] 脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[Migrate] 脚本执行失败:', error);
    process.exit(1);
  });

