# 推荐系统高危漏洞修复指南

## 概述

本次修复针对推荐系统中发现的三个高危业务逻辑漏洞：

1. **提现并发竞态条件** - 用户可能超额提现，造成资金损失
2. **提现拒绝不退款** - 提现被拒绝时资金被永久冻结
3. **佣金重复发放** - 支付回调重复触发导致平台资金损失

## 修复内容

### 1. 代码层面修复

#### 1.1 提现并发竞态修复
- **文件**: `src/lib/db/queries/referral.ts`
- **修改**: `updateDistributorBalance` 函数使用原子操作
- **原理**: 使用 `UPDATE ... WHERE distributor_balance >= ?` 确保余额充足才扣款
- **返回值**: 现在返回 `{ success, balance, error }` 结构

#### 1.2 提现拒绝退款逻辑
- **文件**: `src/app/api/admin/withdrawal/process/route.ts` (新增)
- **功能**: 管理员审批提现，拒绝时自动退还余额
- **接口**: `POST /api/admin/withdrawal/process`
- **参数**:
  ```json
  {
    "withdrawal_id": 123,
    "action": "approve" | "reject",
    "reject_reason": "原因说明（拒绝时必填）"
  }
  ```

#### 1.3 佣金重复发放防护
- **文件**: `src/lib/db/queries/referral.ts`
- **修改**: `createCommission` 使用 `INSERT IGNORE` 防止重复
- **原理**: 依赖数据库唯一索引 `idx_unique_commission (order_id, user_id, level)`
- **返回值**: 现在返回 `{ success, commissionId, error }` 结构

### 2. 数据库层面修复

#### 2.1 唯一索引
```sql
ALTER TABLE commissions 
ADD UNIQUE INDEX idx_unique_commission (order_id, user_id, level);
```
作用：防止同一订单给同一用户同一级别发放多次佣金

#### 2.2 余额非负约束（可选）
```sql
ALTER TABLE users
ADD CONSTRAINT chk_positive_balance 
CHECK (distributor_balance >= 0);
```
作用：防止余额变为负数（应用层已处理，数据库层作为额外保护）

## 部署步骤

### 步骤 1: 备份数据库
```bash
mysqldump -u root -p ai_interview > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 步骤 2: 运行数据库迁移
```bash
cd scripts
npx ts-node migrate-fix-referral-vulnerabilities.ts
```

迁移脚本会：
1. 检查并删除已存在的重复佣金记录
2. 添加唯一索引防止未来重复
3. 检查并修复负余额用户
4. 添加余额非负约束
5. 输出验证结果

### 步骤 3: 部署代码更新
```bash
# 安装依赖（如有新增）
npm install

# 构建项目
npm run build

# 重启服务
pm2 restart your-app
```

### 步骤 4: 验证修复效果
运行并发测试：
```bash
npx ts-node scripts/test-referral-concurrency.ts
```

## 测试验证

### 测试 1: 提现并发测试
同一用户同时发起多个提现请求，验证：
- ✓ 总提现金额不超过实际余额
- ✓ 所有请求都能正确处理
- ✓ 最多只有符合余额的请求成功

### 测试 2: 提现拒绝退款测试
1. 用户申请提现（余额被冻结）
2. 管理员拒绝提现
3. 验证余额已退还

### 测试 3: 佣金重复发放测试
模拟支付回调重复触发，验证：
- ✓ 同一订单只发放一次佣金
- ✓ 重复请求被正确拒绝
- ✓ 余额准确无误

## 回滚方案

如果部署后发现问题，可以按以下步骤回滚：

### 1. 回滚代码
```bash
git revert <commit-hash>
npm run build
pm2 restart your-app
```

### 2. 回滚数据库（仅在必要时）
```sql
-- 删除唯一索引
ALTER TABLE commissions DROP INDEX idx_unique_commission;

-- 删除余额约束
ALTER TABLE users DROP CHECK chk_positive_balance;
```

### 3. 恢复数据库备份（最后手段）
```bash
mysql -u root -p ai_interview < backup_YYYYMMDD_HHMMSS.sql
```

## 监控建议

部署后建议监控以下指标：

1. **提现成功率**: 应保持在正常水平，不应因修复而降低
2. **佣金发放异常**: 监控日志中的佣金发放失败记录
3. **数据库约束违反**: 监控唯一索引冲突次数
4. **余额异常**: 定期检查是否有负余额（理论上不应该出现）

## 常见问题

### Q1: 迁移脚本报错 "Duplicate entry"
A: 说明存在重复佣金记录，脚本会自动清理，只保留最早的一条。

### Q2: MySQL 版本不支持 CHECK 约束
A: 这是正常的，老版本 MySQL 不支持。应用层已做防护，可以忽略。

### Q3: 提现被卡住无法处理
A: 使用管理员审批接口处理，拒绝会自动退款。

### Q4: 如何查看重复佣金
```sql
SELECT order_id, user_id, level, COUNT(*) as cnt
FROM commissions
GROUP BY order_id, user_id, level
HAVING cnt > 1;
```

## 技术支持

如有问题，请联系技术团队或查看：
- 代码提交记录
- 测试结果
- 数据库迁移日志

