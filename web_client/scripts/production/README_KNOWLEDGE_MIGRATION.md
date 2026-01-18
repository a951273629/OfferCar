# 知识库功能数据库迁移指南

## 概述

本文档说明如何运行知识库功能的数据库迁移脚本。

## 前置条件

1. **MySQL 数据库**已安装并运行
2. **`.env.local` 文件**已配置（参考 `.env.local.example`）
3. **Node.js** 和 **npm** 已安装

## 环境配置

### 创建 `.env.local` 文件

复制 `.env.local.example` 并重命名为 `.env.local`，然后填写正确的数据库连接信息：

```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=your_password
DATABASE_NAME=ai_interview
```

### 验证数据库连接

确保 MySQL 服务正在运行：

```bash
# Windows
services.msc  # 查找 MySQL 服务

# Linux/Mac
sudo systemctl status mysql
# 或
mysql.server status
```

## 运行迁移

### 执行迁移脚本

```bash
npx tsx scripts/migrate-knowledge-base.ts
```

### 预期输出

```
🚀 开始迁移知识库表...

✅ 已连接到数据库: ai_interview
✅ 知识库表创建成功
✅ 面试-知识库关联表创建成功
✅ 示例官方知识库插入成功
🎉 知识库功能迁移完成！

🔌 数据库连接已关闭
```

## 常见问题

### 1. `ECONNREFUSED` 错误

**问题**: 无法连接到数据库

**解决方案**:
1. 检查 MySQL 服务是否正在运行
2. 验证 `.env.local` 中的数据库配置
3. 确认数据库主机和端口正确（默认 `localhost:3306`）
4. 检查数据库用户名和密码

### 2. 表已存在

**行为**: 脚本使用 `CREATE TABLE IF NOT EXISTS`，如果表已存在会跳过创建

**验证**: 检查数据库中是否已有 `knowledge_bases` 和 `interview_knowledge_bases` 表

### 3. 外键约束错误

**问题**: 创建关联表时出现外键约束错误

**解决方案**:
1. 确保 `users` 和 `interviews` 表已存在
2. 运行基础迁移脚本（如果还未运行）：
   ```bash
   # 运行主数据库迁移
   npx tsx scripts/init-db.ts
   ```

## 验证迁移

### 检查表结构

登录 MySQL 并验证表是否创建成功：

```sql
USE ai_interview;

-- 查看知识库表
DESCRIBE knowledge_bases;

-- 查看关联表
DESCRIBE interview_knowledge_bases;

-- 查看示例数据
SELECT * FROM knowledge_bases WHERE is_official = TRUE;
```

### 检查索引

```sql
-- 查看知识库表的索引
SHOW INDEX FROM knowledge_bases;

-- 查看关联表的索引
SHOW INDEX FROM interview_knowledge_bases;
```

## 回滚

如果需要回滚迁移（删除创建的表）：

```sql
USE ai_interview;

-- 先删除关联表（因为有外键约束）
DROP TABLE IF EXISTS interview_knowledge_bases;

-- 再删除知识库表
DROP TABLE IF EXISTS knowledge_bases;
```

## 下一步

迁移成功后：

1. **启动开发服务器**:
   ```bash
   npm run dev
   ```

2. **访问知识库页面**:
   ```
   http://localhost:3000/knowledge
   ```

3. **测试功能**:
   - 上传知识库文件
   - 创建面试并关联知识库
   - 验证 AI 是否使用知识库内容

## 相关文件

- `scripts/migrate-knowledge-base.ts` - 迁移脚本
- `src/lib/db/schema.sql` - 完整数据库结构
- `KNOWLEDGE_BASE_IMPLEMENTATION.md` - 功能实现文档

## 技术支持

如遇到问题，请检查：
1. 数据库日志
2. 迁移脚本输出
3. `.env.local` 配置
4. MySQL 错误日志

---

**版本**: 1.0.0  
**最后更新**: 2025-11-03

