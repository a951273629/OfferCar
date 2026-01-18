import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：为 interviews 表添加新字段...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 检查现有的列
    console.log('🔍 检查现有表结构...');
    const [existingColumns] = await connection.query(
      'DESCRIBE interviews'
    );
    
    const columnNames = (existingColumns as any[]).map(col => col.Field);
    console.log('📋 现有字段:', columnNames.join(', '));

    // 定义需要添加的字段
    const fieldsToAdd = [
      {
        name: 'language',
        sql: "ADD COLUMN language ENUM('zh', 'en', 'ja', 'fr', 'de') NOT NULL DEFAULT 'zh' COMMENT '语音识别和答题语言' AFTER difficulty",
        description: '语音识别和答题语言'
      },
      {
        name: 'programming_language',
        sql: "ADD COLUMN programming_language ENUM('javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'other') COMMENT '编程语言' AFTER language",
        description: '编程语言'
      },
      {
        name: 'interview_type',
        sql: "ADD COLUMN interview_type ENUM('technical', 'managerial', 'hr') NOT NULL DEFAULT 'technical' COMMENT '面试类型' AFTER programming_language",
        description: '面试类型'
      },
      {
        name: 'resume_url',
        sql: "ADD COLUMN resume_url VARCHAR(500) COMMENT '简历文件URL' AFTER interview_type",
        description: '简历文件URL'
      },
      {
        name: 'job_description',
        sql: "ADD COLUMN job_description TEXT COMMENT '招聘信息' AFTER resume_url",
        description: '招聘信息'
      }
    ];

    // 添加缺失的字段
    let addedCount = 0;
    let skippedCount = 0;

    for (const field of fieldsToAdd) {
      if (columnNames.includes(field.name)) {
        console.log(`⏭️  跳过字段 '${field.name}' (已存在)`);
        skippedCount++;
      } else {
        console.log(`➕ 添加字段 '${field.name}' (${field.description})...`);
        const alterSQL = `ALTER TABLE interviews ${field.sql}`;
        await connection.query(alterSQL);
        console.log(`✅ 字段 '${field.name}' 添加成功`);
        addedCount++;
      }
    }

    console.log('\n📊 迁移统计:');
    console.log(`   新增字段: ${addedCount}`);
    console.log(`   跳过字段: ${skippedCount}`);
    console.log(`   总计字段: ${fieldsToAdd.length}`);

    // 验证表结构
    console.log('\n🔍 验证最终表结构...');
    const [finalColumns] = await connection.query('DESCRIBE interviews');
    
    console.log('\n📋 interviews 表最终结构:');
    (finalColumns as any[]).forEach((col) => {
      const key = col.Key ? `[${col.Key}]` : '';
      const nullable = col.Null === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.Default !== null ? `DEFAULT '${col.Default}'` : '';
      console.log(`   ${col.Field.padEnd(25)} ${col.Type.padEnd(50)} ${nullable.padEnd(10)} ${defaultVal} ${key}`);
    });

    // 统计现有数据
    const [countResult] = await connection.query(
      'SELECT COUNT(*) as total FROM interviews'
    );
    const totalRecords = (countResult as any[])[0].total;
    console.log(`\n📈 interviews 表共有 ${totalRecords} 条记录`);

    if (totalRecords > 0 && addedCount > 0) {
      console.log('\n⚠️  提示: 新增字段已应用默认值到现有记录');
      console.log('   - language: zh (中文)');
      console.log('   - interview_type: technical (技术面试)');
      console.log('   - programming_language: NULL (可选)');
      console.log('   - resume_url: NULL (可选)');
      console.log('   - job_description: NULL (可选)');
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

