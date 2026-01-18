/**
 * 超级管理员初始化脚本
 * 
 * 用途：手动为指定用户创建超级管理员权限
 * 
 * 注意：
 * - 默认超级管理员邮箱 951273629@qq.com 会在首次登录时自动创建
 * - 此脚本用于手动添加其他超级管理员
 * 
 * 使用方法：
 * npx ts-node scripts/init-super-admin.ts <user_id>
 * npx ts-node scripts/init-super-admin.ts  (使用默认超级管理员邮箱)
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

const SUPER_ADMIN_EMAIL = '951273629@qq.com';

async function initSuperAdmin(userId?: number) {
  console.log('🚀 开始初始化超级管理员...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    let targetUserId = userId;

    // 如果没有提供用户ID，则查找默认超级管理员邮箱对应的用户
    if (!targetUserId) {
      console.log(`\n🔍 查找默认超级管理员邮箱: ${SUPER_ADMIN_EMAIL}`);
      
      const [users] = await connection.query(
        'SELECT id, email, name FROM users WHERE email = ?',
        [SUPER_ADMIN_EMAIL]
      );
      
      if (!Array.isArray(users) || users.length === 0) {
        console.error(`\n❌ 错误: 未找到邮箱为 ${SUPER_ADMIN_EMAIL} 的用户`);
        console.log('💡 请确保该用户已注册，或手动指定用户ID');
        console.log('   使用方法: npx ts-node scripts/init-super-admin.ts <user_id>');
        process.exit(1);
      }
      
      const user = (users as any[])[0];
      targetUserId = user.id;
      console.log(`✅ 找到用户: ${user.name} (ID: ${user.id})`);
    }

    // 验证用户是否存在
    console.log(`\n🔍 验证用户ID: ${targetUserId}`);
    const [users] = await connection.query(
      'SELECT id, email, name, balance FROM users WHERE id = ?',
      [targetUserId]
    );

    if (!Array.isArray(users) || users.length === 0) {
      console.error(`\n❌ 错误: 用户ID ${targetUserId} 不存在`);
      process.exit(1);
    }

    const user = (users as any[])[0];
    console.log('\n📋 用户信息:');
    console.log(`   ID: ${user.id}`);
    console.log(`   邮箱: ${user.email}`);
    console.log(`   姓名: ${user.name}`);
    console.log(`   余额: ${user.balance} 点`);

    // 检查是否已经是管理员
    const [admins] = await connection.query(
      'SELECT id, user_id, role FROM admins WHERE user_id = ?',
      [targetUserId]
    );

    if (Array.isArray(admins) && admins.length > 0) {
      const admin = (admins as any[])[0];
      console.log(`\n⚠️  该用户已是管理员，角色: ${admin.role}`);
      
      if (admin.role === 'super_admin') {
        console.log('✅ 无需重复创建');
        process.exit(0);
      } else {
        console.log('💡 提示: 可使用管理员后台界面将其升级为超级管理员');
        process.exit(0);
      }
    }

    // 创建超级管理员记录
    console.log('\n📝 正在创建超级管理员...');
    
    const [result] = await connection.query(
      'INSERT INTO admins (user_id, role) VALUES (?, ?)',
      [targetUserId, 'super_admin']
    );

    const adminId = (result as any).insertId;
    
    console.log('\n🎉 超级管理员创建成功！');
    console.log(`   管理员ID: ${adminId}`);
    console.log(`   用户ID: ${targetUserId}`);
    console.log(`   角色: super_admin`);
    console.log(`   邮箱: ${user.email}`);
    
    console.log('\n✅ 该用户现在可以访问所有管理员功能：');
    console.log('   - 管理员管理: /admin/admins');
    console.log('   - 卡密管理: /admin/card-codes');
    console.log('   - 提现审批: /admin/withdrawal/process');

  } catch (error) {
    console.error('\n❌ 初始化失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 解析命令行参数
const args = process.argv.slice(2);
const userId = args[0] ? parseInt(args[0]) : undefined;

if (args[0] && isNaN(parseInt(args[0]))) {
  console.error('\n❌ 错误: 用户ID必须是数字');
  console.log('使用方法: npx ts-node scripts/init-super-admin.ts [user_id]');
  console.log('示例: npx ts-node scripts/init-super-admin.ts 1');
  process.exit(1);
}

// 执行初始化
initSuperAdmin(userId);

