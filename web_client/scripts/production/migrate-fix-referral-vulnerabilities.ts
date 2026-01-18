/**
 * 修复推荐系统高危漏洞的数据库迁移脚本
 * 
 * 此脚本添加必要的索引和约束来防止：
 * 1. 佣金重复发放
 * 2. 余额变为负数
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  let connection: mysql.Connection | null = null;

  try {
    console.log('开始数据库迁移...');

    // 创建数据库连接
    connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME || 'ai_interview',
    });

    console.log('数据库连接成功');

    // 1. 添加唯一索引防止佣金重复发放
    console.log('\n步骤 1: 检查并添加佣金唯一索引...');
    
    try {
      // 先检查索引是否已存在
      const [indexes] = await connection.query(`
        SHOW INDEX FROM commissions WHERE Key_name = 'idx_unique_commission'
      `);

      if (Array.isArray(indexes) && indexes.length > 0) {
        console.log('✓ 唯一索引 idx_unique_commission 已存在，跳过');
      } else {
        // 先检查是否存在重复数据
        const [duplicates] = await connection.query(`
          SELECT order_id, user_id, level, COUNT(*) as cnt
          FROM commissions
          GROUP BY order_id, user_id, level
          HAVING cnt > 1
        `);

        if (Array.isArray(duplicates) && duplicates.length > 0) {
          console.warn(`⚠ 发现 ${duplicates.length} 组重复佣金记录，需要先清理`);
          console.log('重复记录:', duplicates);
          
          // 删除重复记录，只保留最早的一条
          for (const dup of duplicates as any[]) {
            console.log(`  清理 order_id=${dup.order_id}, user_id=${dup.user_id}, level=${dup.level}`);
            await connection.query(`
              DELETE FROM commissions
              WHERE order_id = ? AND user_id = ? AND level = ?
              AND id NOT IN (
                SELECT * FROM (
                  SELECT MIN(id) FROM commissions
                  WHERE order_id = ? AND user_id = ? AND level = ?
                ) as temp
              )
            `, [dup.order_id, dup.user_id, dup.level, dup.order_id, dup.user_id, dup.level]);
          }
          console.log('✓ 重复记录清理完成');
        }

        // 添加唯一索引
        await connection.query(`
          ALTER TABLE commissions 
          ADD UNIQUE INDEX idx_unique_commission (order_id, user_id, level)
        `);
        console.log('✓ 唯一索引 idx_unique_commission 创建成功');
      }
    } catch (error) {
      console.error('✗ 添加唯一索引失败:', error);
      throw error;
    }

    // 2. 添加余额非负约束（可选，应用层已处理）
    console.log('\n步骤 2: 检查并添加余额非负约束...');
    
    try {
      // 检查约束是否已存在
      const [constraints] = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM information_schema.TABLE_CONSTRAINTS
        WHERE TABLE_SCHEMA = ? 
        AND TABLE_NAME = 'users' 
        AND CONSTRAINT_NAME = 'chk_positive_balance'
      `, [process.env.DB_NAME || 'ai_interview']);

      if (Array.isArray(constraints) && constraints.length > 0) {
        console.log('✓ 余额非负约束 chk_positive_balance 已存在，跳过');
      } else {
        // 先检查是否有负余额
        const [negativeBalances] = await connection.query(`
          SELECT id, email, distributor_balance
          FROM users
          WHERE distributor_balance < 0
        `);

        if (Array.isArray(negativeBalances) && negativeBalances.length > 0) {
          console.warn(`⚠ 发现 ${negativeBalances.length} 个用户余额为负数，需要先修复`);
          console.log('负余额用户:', negativeBalances);
          
          // 询问是否要修复（在自动化脚本中，我们将其设为0）
          for (const user of negativeBalances as any[]) {
            console.log(`  将用户 ${user.id} (${user.email}) 的余额 ${user.distributor_balance} 重置为 0`);
            await connection.query(`
              UPDATE users SET distributor_balance = 0 WHERE id = ?
            `, [user.id]);
          }
          console.log('✓ 负余额修复完成');
        }

        // 添加约束
        await connection.query(`
          ALTER TABLE users
          ADD CONSTRAINT chk_positive_balance 
          CHECK (distributor_balance >= 0)
        `);
        console.log('✓ 余额非负约束 chk_positive_balance 创建成功');
      }
    } catch (error) {
      console.error('✗ 添加余额约束失败:', error);
      // 某些 MySQL 版本可能不支持 CHECK 约束，这里只是警告
      console.warn('注意: 如果数据库版本不支持 CHECK 约束，此错误可以忽略（应用层已处理）');
    }

    // 3. 验证迁移结果
    console.log('\n步骤 3: 验证迁移结果...');
    
    // 验证唯一索引
    const [commissionIndexes] = await connection.query(`
      SHOW INDEX FROM commissions WHERE Key_name = 'idx_unique_commission'
    `);
    console.log(`✓ 佣金表唯一索引: ${Array.isArray(commissionIndexes) ? commissionIndexes.length : 0} 个字段`);

    // 统计当前数据
    const [commissionStats] = await connection.query(`
      SELECT COUNT(*) as total FROM commissions
    `);
    console.log(`✓ 当前佣金记录数: ${(commissionStats as any[])[0]?.total || 0}`);

    const [withdrawalStats] = await connection.query(`
      SELECT status, COUNT(*) as count FROM withdrawals GROUP BY status
    `);
    console.log('✓ 提现申请状态统计:');
    for (const stat of withdrawalStats as any[]) {
      console.log(`  ${stat.status}: ${stat.count}`);
    }

    console.log('\n🎉 数据库迁移完成！');
    console.log('\n重要提示:');
    console.log('1. 佣金重复发放漏洞已修复（通过唯一索引）');
    console.log('2. 提现并发竞态已修复（通过应用层原子操作）');
    console.log('3. 提现拒绝退款已实现（需部署新的管理员审批接口）');
    console.log('4. 建议在生产环境部署前进行充分测试');

  } catch (error) {
    console.error('❌ 迁移失败:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

// 执行迁移
migrate();

