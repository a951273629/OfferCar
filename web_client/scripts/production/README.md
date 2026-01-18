# 数据库迁移与管理脚本

本目录包含数据库迁移和系统管理脚本。

## 迁移脚本

### migrate-card-system.ts

**卡密充值系统数据库迁移**

创建卡密充值系统所需的全部表结构。

#### 使用方法

```bash
npx ts-node scripts/migrate-card-system.ts
```

#### 创建的表

1. **admins** - 管理员表
   - 支持超级管理员和普通管理员
   - 关联用户表

2. **card_templates** - 卡密模板表
   - 预设固定面额模板
   - 支持启用/禁用

3. **card_codes** - 卡密表
   - 16位随机卡密代码
   - 支持批次管理
   - 支持过期时间
   - 记录使用者和使用时间

4. **bills.category** 字段更新
   - 新增 `card_redeem` 分类

#### 注意事项

- 此脚本使用 `CREATE TABLE IF NOT EXISTS`，可安全重复执行
- 执行前确保数据库配置正确（.env.local）
- 建议在初次部署时执行

---

### 其他迁移脚本

- `migrate-chat-history.ts` - 聊天历史表
- `migrate-client-download.ts` - 客户端下载配置表
- `migrate-interview-fields.ts` - 面试表字段扩展
- `migrate-fix-referral-vulnerabilities.ts` - 推荐系统漏洞修复

---

## 管理脚本

### init-super-admin.ts

**超级管理员初始化脚本**

用于手动创建超级管理员权限。

#### 前置条件

1. 已执行 `migrate-card-system.ts` 创建 admins 表
2. 目标用户已在系统中注册

#### 使用方法

```bash
# 方式1：为默认超级管理员邮箱（951273629@qq.com）创建权限
npx ts-node scripts/init-super-admin.ts

# 方式2：为指定用户ID创建超级管理员权限
npx ts-node scripts/init-super-admin.ts <user_id>
```

#### 示例

```bash
# 为用户ID为1的用户创建超级管理员权限
npx ts-node scripts/init-super-admin.ts 1
```

#### 自动模式（推荐）

默认超级管理员邮箱 `951273629@qq.com` 在首次登录时会自动创建管理员记录，无需手动执行此脚本。

#### 注意事项

1. 确保目标用户已在系统中注册
2. 每个用户只能创建一次管理员记录
3. 超级管理员可以通过后台界面管理其他管理员
4. 脚本会自动验证并防止重复创建

---

## 完整部署流程

### 首次部署卡密系统

```bash
# 1. 创建卡密系统表
npx ts-node scripts/migrate-card-system.ts

# 2. 创建超级管理员（可选，登录时会自动创建）
npx ts-node scripts/init-super-admin.ts

# 3. 启动应用
npm run dev
```

### 验证部署

1. 使用 `951273629@qq.com` 登录系统
2. 访问管理后台：
   - 管理员管理：`/admin/admins`
   - 卡密管理：`/admin/card-codes`
3. 创建卡密模板和卡密
4. 使用普通用户测试卡密兑换功能

---

## 环境要求

- Node.js >= 16
- MySQL >= 8.0
- ts-node: `npm install -g ts-node`
- 环境变量配置（.env.local）：
  ```
  DATABASE_HOST=localhost
  DATABASE_PORT=3306
  DATABASE_USER=root
  DATABASE_PASSWORD=your_password
  DATABASE_NAME=ai_interview
  ```
