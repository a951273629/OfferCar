/**
 * 卡密充值系统数据库迁移脚本
 * 
 * 此脚本创建卡密充值系统所需的三个核心表：
 * 1. admins - 管理员表
 * 2. card_templates - 卡密模板表
 * 3. card_codes - 卡密表
 * 
 * 同时更新 bills 表的 category 字段以支持卡密兑换
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：创建卡密充值系统表...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // ==================== 步骤 1: 创建管理员表 ====================
    console.log('\n📝 步骤 1: 创建 admins 表...');
    
    const createAdminsSQL = `
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '关联用户ID',
        role ENUM('super_admin', 'admin') NOT NULL DEFAULT 'admin' COMMENT '管理员角色',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_id (user_id),
        INDEX idx_user_id (user_id),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='管理员表'
    `;
    
    await connection.query(createAdminsSQL);
    console.log('✅ admins 表创建成功');

    // ==================== 步骤 2: 创建卡密模板表 ====================
    console.log('\n📝 步骤 2: 创建 card_templates 表...');
    
    const createTemplatesSQL = `
      CREATE TABLE IF NOT EXISTS card_templates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '模板名称',
        points INT NOT NULL COMMENT '点数面额',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卡密模板表'
    `;
    
    await connection.query(createTemplatesSQL);
    console.log('✅ card_templates 表创建成功');

    // ==================== 步骤 3: 创建卡密表 ====================
    console.log('\n📝 步骤 3: 创建 card_codes 表...');
    
    const createCardCodesSQL = `
      CREATE TABLE IF NOT EXISTS card_codes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(32) NOT NULL UNIQUE COMMENT '卡密代码',
        points INT NOT NULL COMMENT '点数面额',
        status ENUM('active', 'used', 'expired') NOT NULL DEFAULT 'active' COMMENT '卡密状态',
        template_id INT NULL COMMENT '关联模板ID（NULL表示自定义）',
        batch_no VARCHAR(64) NULL COMMENT '批次号',
        expires_at TIMESTAMP NULL COMMENT '过期时间',
        used_by INT NULL COMMENT '使用者用户ID',
        used_at TIMESTAMP NULL COMMENT '使用时间',
        created_by INT NOT NULL COMMENT '创建者管理员ID',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES card_templates(id) ON DELETE SET NULL,
        
        UNIQUE KEY unique_code (code),
        INDEX idx_code (code),
        INDEX idx_status (status),
        INDEX idx_batch_no (batch_no),
        INDEX idx_created_by (created_by),
        INDEX idx_template_id (template_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='卡密表'
    `;
    
    await connection.query(createCardCodesSQL);
    console.log('✅ card_codes 表创建成功');

    // ==================== 步骤 4: 更新 bills 表的 category 字段 ====================
    console.log('\n📝 步骤 4: 检查并更新 bills 表的 category 字段...');
    
    try {
      // 检查 category 字段的当前定义
      const [columns] = await connection.query(
        "SHOW COLUMNS FROM bills WHERE Field = 'category'"
      );

      if (Array.isArray(columns) && columns.length > 0) {
        const column = (columns as any[])[0];
        const currentType = column.Type;

        // 检查是否已包含 card_redeem
        if (currentType.includes('card_redeem')) {
          console.log('✅ bills.category 字段已包含 card_redeem，跳过');
        } else {
          console.log('📝 更新 bills.category 字段以支持卡密兑换...');
          
          const alterBillsSQL = `
            ALTER TABLE bills 
            MODIFY COLUMN category ENUM(
              'recharge', 
              'card_redeem', 
              'voice_recognition', 
              'interview_question', 
              'exam_answer', 
              'knowledge_base'
            ) NOT NULL COMMENT '交易分类'
          `;
          
          await connection.query(alterBillsSQL);
          console.log('✅ bills.category 字段更新成功');
        }
      } else {
        console.log('⚠️  未找到 bills.category 字段');
      }
    } catch (error) {
      console.error('⚠️  更新 bills 表失败:', error);
      console.log('💡 提示: 如果 bills 表不存在，可以忽略此错误');
    }

    // ==================== 步骤 5: 验证表结构 ====================
    console.log('\n🔍 步骤 5: 验证表结构...');

    // 验证 admins 表
    const [adminsColumns] = await connection.query('DESCRIBE admins');
    console.log('\n📋 admins 表结构:');
    (adminsColumns as any[]).forEach((col) => {
      console.log(`   ${col.Field.padEnd(20)} ${col.Type.padEnd(30)} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // 验证 card_templates 表
    const [templatesColumns] = await connection.query('DESCRIBE card_templates');
    console.log('\n📋 card_templates 表结构:');
    (templatesColumns as any[]).forEach((col) => {
      console.log(`   ${col.Field.padEnd(20)} ${col.Type.padEnd(30)} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // 验证 card_codes 表
    const [codesColumns] = await connection.query('DESCRIBE card_codes');
    console.log('\n📋 card_codes 表结构:');
    (codesColumns as any[]).forEach((col) => {
      console.log(`   ${col.Field.padEnd(20)} ${col.Type.padEnd(30)} ${col.Key ? `[${col.Key}]` : ''}`);
    });

    // ==================== 步骤 6: 统计数据 ====================
    console.log('\n📊 步骤 6: 统计数据...');

    const [adminsCount] = await connection.query('SELECT COUNT(*) as count FROM admins');
    const [templatesCount] = await connection.query('SELECT COUNT(*) as count FROM card_templates');
    const [codesCount] = await connection.query('SELECT COUNT(*) as count FROM card_codes');

    console.log(`   管理员数量: ${(adminsCount as any[])[0].count}`);
    console.log(`   卡密模板数量: ${(templatesCount as any[])[0].count}`);
    console.log(`   卡密数量: ${(codesCount as any[])[0].count}`);

    // ==================== 完成 ====================
    console.log('\n🎉 迁移完成！卡密充值系统已准备就绪');
    
    console.log('\n📌 下一步操作:');
    console.log('   1. 创建超级管理员:');
    console.log('      npx ts-node scripts/init-super-admin.ts');
    console.log('   2. 使用超级管理员账号登录系统');
    console.log('   3. 访问管理后台:');
    console.log('      - 管理员管理: /admin/admins');
    console.log('      - 卡密管理: /admin/card-codes');
    console.log('   4. 用户可通过"兑换额度"功能使用卡密');

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

