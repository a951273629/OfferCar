# 分销系统数据库迁移指南

## 概述

本迁移脚本将为OfferYang项目添加完整的分销系统支持，包括：
- 在users表中添加分销相关字段
- 创建commissions表（佣金记录）
- 创建withdrawals表（提现申请）
- 为现有用户设置邀请码（使用邮箱）

## 前置条件

1. 确保已配置 `.env.local` 文件，包含数据库连接信息：
```env
DATABASE_HOST=your_host
DATABASE_PORT=3306
DATABASE_USER=your_user
DATABASE_PASSWORD=your_password
DATABASE_NAME=ai_interview
```

2. 确保数据库服务正常运行

3. **建议在迁移前备份数据库**

## 运行迁移

### 方法一：使用 ts-node（推荐）

```bash
npm install -g ts-node
ts-node scripts/migrate-referral-system.ts
```

### 方法二：使用 tsx

```bash
npx tsx scripts/migrate-referral-system.ts
```

### 方法三：先编译再运行

```bash
npx tsc scripts/migrate-referral-system.ts
node scripts/migrate-referral-system.js
```

## 迁移内容

### 1. 修改 users 表

添加以下字段：
- `referrer_id` - 推荐人用户ID
- `referral_code` - 邀请码（用户邮箱）
- `distributor_balance` - 分销余额（人民币，可提现）

添加索引和外键约束。

### 2. 创建 commissions 表

用于记录所有佣金发放情况，包括：
- 佣金获得者
- 充值用户
- 关联订单
- 分销级别（1或2）
- 佣金金额和比例
- 状态

### 3. 创建 withdrawals 表

用于管理提现申请，包括：
- 提现金额
- 提现方式（微信/支付宝）
- 账号信息
- 审核状态
- 处理记录

### 4. 数据初始化

为所有现有用户设置 `referral_code` = `email`

## 验证迁移

迁移完成后，脚本会自动验证表结构并输出：
- users表的新字段
- commissions表的完整结构
- withdrawals表的完整结构

## 成功标志

看到以下输出表示迁移成功：

```
🚀 开始迁移：添加分销系统相关表和字段...

✅ 已连接到数据库: ai_interview

📝 步骤 1: 修改 users 表，添加分销字段...
✅ users 表字段添加成功
✅ 已为现有用户设置邀请码（邮箱）

📝 步骤 2: 创建 commissions 表...
✅ commissions 表创建成功

📝 步骤 3: 创建 withdrawals 表...
✅ withdrawals 表创建成功

🔍 验证表结构...

📋 users 表新字段:
   referrer_id (int) [MUL]
   referral_code (varchar(255)) [MUL]
   distributor_balance (decimal(10,2))

📋 commissions 表结构:
   ... (显示所有字段)

📋 withdrawals 表结构:
   ... (显示所有字段)

🎉 迁移完成！分销系统数据库已准备就绪

🔌 数据库连接已关闭
```

## 回滚（如需要）

如果需要回滚迁移，请手动执行以下SQL：

```sql
-- 删除新建的表
DROP TABLE IF EXISTS withdrawals;
DROP TABLE IF EXISTS commissions;

-- 删除users表的新字段
ALTER TABLE users 
DROP FOREIGN KEY fk_users_referrer,
DROP INDEX idx_referrer_id,
DROP INDEX idx_referral_code,
DROP COLUMN referrer_id,
DROP COLUMN referral_code,
DROP COLUMN distributor_balance;
```

**警告：回滚将删除所有分销相关数据，请谨慎操作！**

## 常见问题

### 问题1：字段已存在

如果看到"字段已存在，跳过"的提示，说明之前已经运行过迁移，这是正常的。

### 问题2：外键约束错误

确保users表存在且结构正确，特别是id字段为主键。

### 问题3：连接数据库失败

检查 `.env.local` 文件中的数据库配置是否正确。

### 问题4：权限不足

确保数据库用户有ALTER TABLE和CREATE TABLE权限。

## 下一步

迁移完成后：
1. 重启应用服务器
2. 访问 `/login?ic=test@example.com` 测试邀请功能
3. 访问 `/dashboard/referral` 查看分销中心
4. 测试充值后的佣金发放功能

## 技术支持

如有问题，请联系：951273629@163.com

