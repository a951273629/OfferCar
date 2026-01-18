import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移：添加分销系统相关表和字段...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 1. 修改 users 表，添加分销相关字段
    console.log('\n📝 步骤 1: 修改 users 表，添加分销字段...');
    
    // 检查字段是否已存在
    const [columns] = await connection.query(
      "SHOW COLUMNS FROM users LIKE 'referrer_id'"
    );
    
    if ((columns as any[]).length === 0) {
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN referrer_id INT DEFAULT NULL COMMENT '推荐人用户ID',
        ADD COLUMN referral_code VARCHAR(255) DEFAULT NULL COMMENT '邀请码（用户邮箱）',
        ADD COLUMN distributor_balance DECIMAL(10, 2) DEFAULT 0 COMMENT '分销余额（人民币，可提现）',
        ADD INDEX idx_referrer_id (referrer_id),
        ADD INDEX idx_referral_code (referral_code),
        ADD CONSTRAINT fk_users_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✅ users 表字段添加成功');
      
      // 为现有用户设置 referral_code（使用邮箱）
      await connection.query(`
        UPDATE users 
        SET referral_code = email 
        WHERE referral_code IS NULL
      `);
      console.log('✅ 已为现有用户设置邀请码（邮箱）');
    } else {
      console.log('⚠️  users 表分销字段已存在，跳过');
    }

    // 2. 创建 commissions 表
    console.log('\n📝 步骤 2: 创建 commissions 表...');
    
    const createCommissionsTableSQL = `
      CREATE TABLE IF NOT EXISTS commissions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '获得佣金的用户ID',
        from_user_id INT NOT NULL COMMENT '充值用户ID',
        order_id INT NOT NULL COMMENT '关联的充值订单ID',
        level TINYINT NOT NULL COMMENT '分销级别（1=一级15%, 2=二级5%）',
        order_amount DECIMAL(10, 2) NOT NULL COMMENT '订单金额',
        commission_rate DECIMAL(5, 2) NOT NULL COMMENT '佣金比例',
        commission_amount DECIMAL(10, 2) NOT NULL COMMENT '佣金金额',
        status ENUM('pending', 'settled', 'cancelled') DEFAULT 'settled' COMMENT '佣金状态',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
        
        INDEX idx_user_created (user_id, created_at DESC),
        INDEX idx_from_user (from_user_id),
        INDEX idx_order (order_id),
        INDEX idx_level (level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='佣金记录表'
    `;
    
    await connection.query(createCommissionsTableSQL);
    console.log('✅ commissions 表创建成功');

    // 3. 创建 withdrawals 表
    console.log('\n📝 步骤 3: 创建 withdrawals 表...');
    
    const createWithdrawalsTableSQL = `
      CREATE TABLE IF NOT EXISTS withdrawals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '用户ID',
        amount DECIMAL(10, 2) NOT NULL COMMENT '提现金额',
        method ENUM('wechat', 'alipay') NOT NULL COMMENT '提现方式',
        account_info VARCHAR(255) NOT NULL COMMENT '提现账号信息',
        status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending' COMMENT '提现状态',
        reject_reason VARCHAR(500) COMMENT '拒绝原因',
        processed_by INT COMMENT '处理人ID',
        processed_at TIMESTAMP NULL COMMENT '处理时间',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        
        INDEX idx_user_created (user_id, created_at DESC),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='提现申请表'
    `;
    
    await connection.query(createWithdrawalsTableSQL);
    console.log('✅ withdrawals 表创建成功');

    // 验证表创建
    console.log('\n🔍 验证表结构...');
    
    const [usersCols] = await connection.query('DESCRIBE users');
    console.log('\n📋 users 表新字段:');
    (usersCols as any[])
      .filter(col => ['referrer_id', 'referral_code', 'distributor_balance'].includes(col.Field))
      .forEach((col) => {
        console.log(`   ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
      });

    const [commissionsCols] = await connection.query('DESCRIBE commissions');
    console.log('\n📋 commissions 表结构:');
    (commissionsCols as any[]).forEach((col) => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
    });

    const [withdrawalsCols] = await connection.query('DESCRIBE withdrawals');
    console.log('\n📋 withdrawals 表结构:');
    (withdrawalsCols as any[]).forEach((col) => {
      console.log(`   ${col.Field} (${col.Type}) ${col.Key ? `[${col.Key}]` : ''}`);
    });

    console.log('\n🎉 迁移完成！分销系统数据库已准备就绪');

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

