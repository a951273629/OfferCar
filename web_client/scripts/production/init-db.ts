import mysql from 'mysql2/promise';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function initDatabase() {
  console.log('🚀 开始初始化数据库...\n');

  const config = {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    multipleStatements: true,
    connectTimeout: 20000, // 20秒超时
  };

  console.log('📡 连接配置:');
  console.log(`   主机: ${config.host}`);
  console.log(`   端口: ${config.port}`);
  console.log(`   用户: ${config.user}`);
  console.log(`   SSL: 禁用（尝试普通连接）\n`);

  let connection;

  try {
    // 连接到 MySQL 服务器（不指定数据库）
    console.log('🔌 正在连接到远程 MySQL 服务器...');
    connection = await mysql.createConnection(config);
    console.log('✅ 成功连接到 MySQL 服务器\n');

    // 读取 SQL 文件
    const sqlFilePath = path.join(__dirname, '..', 'src', 'lib', 'db', 'schema.sql');
    console.log(`📖 读取 SQL 文件: ${sqlFilePath}`);
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ SQL 文件读取成功\n');

    // 使用改进的分割逻辑：正确处理 SQL 语句
    // 移除注释行，然后按分号分割
    const lines = sqlContent.split('\n');
    const cleanedLines = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('--')); // 移除空行和注释
    
    const cleanedSql = cleanedLines.join(' ');
    
    // 按分号分割语句
    const statements = cleanedSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`📝 共发现 ${statements.length} 条 SQL 语句\n`);
    console.log('⚙️  开始执行 SQL 语句...\n');

    // 逐条执行 SQL 语句
    let successCount = 0;
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // 提取语句类型（CREATE DATABASE, CREATE TABLE 等）
      const statementType = statement.split(/\s+/).slice(0, 3).join(' ').toUpperCase();
      
      try {
        await connection.query(statement);
        successCount++;
        
        // 简化输出，只显示关键操作
        if (statementType.includes('CREATE DATABASE')) {
          console.log(`   ✓ 创建数据库: ai_interview`);
        } else if (statementType.includes('CREATE TABLE')) {
          const tableName = statement.match(/CREATE TABLE.*?(\w+)\s*\(/i)?.[1] || '未知';
          console.log(`   ✓ 创建表: ${tableName}`);
        } else if (statementType.includes('USE')) {
          console.log(`   ✓ 切换到数据库: ai_interview`);
        }
      } catch (error) {
        console.error(`   ✗ 执行失败: ${statementType}`);
        console.error(`   错误: ${error instanceof Error ? error.message : error}`);
        console.error(`   SQL: ${statement.substring(0, 100)}...`);
        throw error;
      }
    }

    console.log(`\n✅ 成功执行 ${successCount}/${statements.length} 条 SQL 语句`);
    console.log('\n🎉 数据库初始化完成！\n');

    // 验证表是否创建成功
    console.log('🔍 验证数据库表...');
    await connection.query(`USE ${process.env.DATABASE_NAME}`);
    const [tables] = await connection.query('SHOW TABLES');
    console.log(`✅ 共创建 ${(tables as any[]).length} 个表:`);
    (tables as any[]).forEach((table) => {
      const tableName = Object.values(table)[0];
      console.log(`   - ${tableName}`);
    });

  } catch (error) {
    console.error('\n❌ 数据库初始化失败:');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 已断开数据库连接');
    }
  }
}

// 执行初始化
initDatabase();

