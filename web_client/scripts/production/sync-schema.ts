/**
 * 数据库表结构同步脚本
 * 
 * 此脚本从MySQL数据库读取所有表的CREATE TABLE语句，
 * 并同步到 schema.sql 文件
 */

import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function syncSchema() {
  console.log('🚀 开始同步数据库表结构...\n');

  const dbName = process.env.DATABASE_NAME || 'ai_interview';
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: dbName,
  });

  try {
    console.log(`✅ 已连接到数据库: ${dbName}\n`);

    // 获取所有表名
    const [tables] = await connection.query(`SHOW TABLES FROM ${dbName}`);
    const tableList = (tables as any[]).map((row) => Object.values(row)[0] as string);
    
    console.log(`📋 发现 ${tableList.length} 个表\n`);

    // 为每个表获取CREATE TABLE语句
    const createStatements: string[] = [];
    
    for (const tableName of tableList) {
      try {
        const [result] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
        const createTableSQL = (result as any[])[0]['Create Table'];
        
        // 格式化：添加注释和换行
        createStatements.push(`-- ${tableName}表`);
        createStatements.push(createTableSQL + ';');
        createStatements.push(''); // 空行分隔
        
        console.log(`   ✓ 导出表: ${tableName}`);
      } catch (error) {
        console.error(`   ✗ 导出表失败: ${tableName}`, error);
      }
    }

    // 组装完整的SQL文件内容
    const sqlContent = [
      '-- 创建数据库',
      `CREATE DATABASE IF NOT EXISTS ${dbName} DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      '',
      `USE ${dbName};`,
      '',
      ...createStatements,
    ].join('\n');

    // 备份原有的schema.sql
    // __dirname: web_client/scripts/production
    // 目标文件: web_client/src/lib/db/schema.sql
    const schemaPath = path.join(__dirname, '..', '..', 'src', 'lib', 'db', 'schema.sql');
    
    if (fs.existsSync(schemaPath)) {
      const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0];
      const backupPath = `${schemaPath}.backup.${timestamp}`;
      fs.copyFileSync(schemaPath, backupPath);
      console.log(`\n💾 备份原schema.sql -> schema.sql.backup.${timestamp}`);
    }

    // 写入新的schema.sql
    fs.mkdirSync(path.dirname(schemaPath), { recursive: true });
    fs.writeFileSync(schemaPath, sqlContent, 'utf8');
    console.log('✅ 新schema.sql写入成功');

    // 验证文件
    const stats = fs.statSync(schemaPath);
    console.log(`📄 文件大小: ${(stats.size / 1024).toFixed(2)} KB`);

    console.log('\n🎉 表结构同步完成！');
    console.log('\n📌 下一步操作:');
    console.log('   1. 检查生成的 schema.sql 文件');
    console.log('   2. 验证所有表结构是否正确');
    console.log('   3. 提交到版本控制前进行人工review');

  } catch (error) {
    console.error('\n❌ 同步失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行同步
syncSchema();

