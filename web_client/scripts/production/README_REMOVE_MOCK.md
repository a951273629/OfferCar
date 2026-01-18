# 删除 Mock 支付方式 - 数据库迁移指南

## 概述

本次迁移将从系统中完全移除 Mock 支付方式，所有支付统一使用真实支付（微信/支付宝）。

## 执行前准备

### 1. 备份数据库（强烈建议）

```bash
mysqldump -u username -p database_name > backup_before_remove_mock.sql
```

### 2. 检查现有 Mock 订单

连接到数据库并执行：

```sql
SELECT 
  COUNT(*) as total_mock_orders,
  SUM(points) as total_points,
  SUM(actual_price) as total_amount
FROM orders 
WHERE payment_method='mock';
```

## 执行迁移

### 方式 1：使用 TypeScript 迁移脚本（推荐）

```bash
# 进入项目目录
cd d:\OfferYang

# 确保已安装依赖
npm install

# 执行迁移脚本
npx tsx scripts/migrate-remove-mock-payment.ts
```

**脚本特性**：
- ✅ 自动检查现有 mock 订单
- ✅ 自动转换为 wechat
- ✅ 验证转换结果
- ✅ 修改表结构
- ✅ 完整的错误处理和日志

### 方式 2：手动执行 SQL

1. 连接到数据库
2. 逐步执行以下 SQL：

```sql
-- Step 1: 检查 mock 订单数量
SELECT COUNT(*) FROM orders WHERE payment_method='mock';

-- Step 2: 转换 mock 订单为 wechat
UPDATE orders 
SET 
  payment_method = 'wechat',
  updated_at = CURRENT_TIMESTAMP
WHERE payment_method = 'mock';

-- Step 3: 验证（应该返回 0）
SELECT COUNT(*) FROM orders WHERE payment_method='mock';

-- Step 4: 修改表结构
ALTER TABLE orders 
MODIFY COLUMN payment_method ENUM('wechat', 'alipay') NOT NULL COMMENT '支付方式';

-- Step 5: 验证表结构
DESCRIBE orders;
```

## 验证迁移结果

### 1. 检查数据库

```sql
-- 确认没有 mock 订单
SELECT COUNT(*) FROM orders WHERE payment_method='mock';
-- 期望结果：0

-- 确认表结构已更新
SHOW COLUMNS FROM orders LIKE 'payment_method';
-- 期望结果：Type 列显示 enum('wechat','alipay')
```

### 2. 检查代码

- ✅ `src/types/order.ts` - PaymentMethod 不再包含 'mock'
- ✅ `src/lib/db/schema.sql` - ENUM 不再包含 'mock'
- ✅ `src/lib/db/queries/order.ts` - 类型定义已更新
- ✅ `src/app/api/recharge/route.ts` - Mock 逻辑和 PATCH 方法已删除
- ✅ `src/components/recharge/RechargePackages.tsx` - Mock UI 已删除

### 3. 测试应用

1. 重启开发服务器
2. 选择充值套餐（包括 0.01 元测试套餐）
3. 验证只显示微信支付二维码
4. 扫码支付测试套餐（0.01 元）
5. 验证支付成功后余额正确更新

## 回滚步骤（如果需要）

如果迁移后发现问题，可以使用备份恢复：

```bash
# 恢复数据库
mysql -u username -p database_name < backup_before_remove_mock.sql

# 恢复代码（使用 git）
git checkout HEAD -- src/types/order.ts
git checkout HEAD -- src/lib/db/schema.sql
git checkout HEAD -- src/lib/db/queries/order.ts
git checkout HEAD -- src/app/api/recharge/route.ts
git checkout HEAD -- src/components/recharge/RechargePackages.tsx
```

## 注意事项

1. **开发环境测试**：
   - 保留了 id=999 的测试套餐（0.01 元）
   - 测试套餐使用真实微信支付
   - 可以用于开发环境测试完整支付流程

2. **生产环境**：
   - 在生产环境执行前，务必先在测试环境验证
   - 备份数据库
   - 选择低峰期执行迁移

3. **监控**：
   - 迁移后监控错误日志
   - 检查支付是否正常
   - 验证余额更新是否正确

## 完成清单

- [x] 创建数据库迁移脚本
- [x] 修改 schema.sql
- [x] 修改类型定义
- [x] 删除 Mock 支付逻辑
- [x] 删除 PATCH 接口
- [x] 删除前端 Mock UI
- [x] 通过 linter 检查
- [ ] 执行数据库迁移（需要数据库管理员）
- [ ] 测试真实支付流程
- [ ] 部署到生产环境

