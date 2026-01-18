# 用户管理和提现管理功能

## 功能概述

新增了管理员后台的用户管理和提现管理功能，包括：

### 用户管理
- 用户列表展示（邮箱、余额、分销余额、推荐人、状态、注册时间、累计充值、订单数）
- 用户搜索（按邮箱搜索）
- 用户详情查看（基本信息、余额信息、推荐关系、消费统计）
- 启用/禁用用户账号

### 提现管理
- 提现申请列表展示
- 按状态筛选（待审核、已批准、已拒绝）
- 审批提现申请（批准/拒绝）
- 查看提现详情

## 数据库迁移

在使用新功能前，需要执行数据库迁移添加 `is_active` 字段：

```bash
cd web_client
npx ts-node scripts/migrate-add-user-status.ts
```

迁移操作：
- 在 `users` 表中添加 `is_active` BOOLEAN 字段（默认 TRUE）
- 为 `is_active` 字段添加索引
- 为所有现有用户设置启用状态

## 访问路径

管理员登录后，可以通过以下路径访问：

- 用户管理：`/admin/users`
- 提现管理：`/admin/withdrawal`

## 技术实现

### 后端 API

#### 用户管理 API
- `GET /api/admin/users` - 获取用户列表（支持分页、搜索）
- `GET /api/admin/users/:id` - 获取用户详情
- `PATCH /api/admin/users/:id` - 更新用户状态

#### 提现管理 API
- `GET /api/admin/withdrawal/list` - 获取提现申请列表（支持分页、状态筛选）
- `POST /api/admin/withdrawal/process` - 审批提现申请（已存在）

### 数据库查询

#### `src/lib/db/queries/user.ts`
- `getAllUsers()` - 获取所有用户列表（关联统计数据）
- `getUserDetailById()` - 获取用户详情（含推荐关系和消费统计）
- `updateUserStatus()` - 更新用户启用/禁用状态

#### `src/lib/db/queries/withdrawal.ts`
- `getAllWithdrawals()` - 获取所有提现申请（关联用户和处理人信息）

### 前端组件

#### 用户管理组件（`src/components/admin/`）
- `UserList.tsx` - 用户列表组件
- `UserDetailModal.tsx` - 用户详情弹窗

#### 提现管理组件（`src/components/admin/`）
- `WithdrawalList.tsx` - 提现申请列表组件
- `WithdrawalProcessModal.tsx` - 提现审批弹窗

### 页面

- `src/app/(dashboard)/admin/users/page.tsx` - 用户管理页面
- `src/app/(dashboard)/admin/withdrawal/page.tsx` - 提现管理页面

## 权限要求

所有 API 都需要管理员权限，使用 `verifyAdminAuth` 中间件验证。

## 功能特点

1. **用户管理**
   - 实时搜索用户
   - 一键启用/禁用用户账号
   - 详细的用户信息展示
   - 推荐关系可视化

2. **提现管理**
   - 状态筛选快速定位
   - 完整的提现信息展示
   - 批准/拒绝操作（拒绝需填写原因）
   - 自动退还余额（拒绝时）

3. **代码规范**
   - 遵循 Early Return 和 Guard Clauses 模式
   - 所有注释使用中文
   - 使用 Ant Design V6 组件
   - 完整的 TypeScript 类型定义

## 注意事项

1. 执行迁移前请备份数据库
2. 禁用用户不影响现有数据，仅限制登录
3. 拒绝提现会自动退还金额到用户分销余额
4. 所有操作都有审计记录（处理人、处理时间）

