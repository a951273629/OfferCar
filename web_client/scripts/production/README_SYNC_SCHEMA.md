# 数据库表结构同步脚本

## 概述

`sync-schema.ts` 脚本用于从MySQL数据库自动导出所有表的CREATE TABLE语句，并同步到 `schema.sql` 文件中。

## 使用场景

当你手动执行了数据库迁移（添加表、修改字段等），但 `schema.sql` 文件没有及时更新时，可以使用此脚本自动同步最新的数据库结构。

## 使用方法

```bash
# 进入 web_client 目录
cd web_client

# 执行同步
npm run sync-schema
```

## 脚本功能

1. **连接数据库**: 使用 `.env.local` 中的配置连接到MySQL数据库
2. **获取所有表**: 使用 `SHOW TABLES` 查询所有表名
3. **导出表结构**: 对每个表执行 `SHOW CREATE TABLE` 获取完整的创建语句
4. **备份原文件**: 自动备份现有的 `schema.sql`，文件名带时间戳
5. **生成新文件**: 生成包含所有表结构的新 `schema.sql`

## 输出示例

```
🚀 开始同步数据库表结构...

✅ 已连接到数据库: ai_interview

📋 发现 15 个表

   ✓ 导出表: users
   ✓ 导出表: interviews
   ✓ 导出表: exams
   ✓ 导出表: orders
   ✓ 导出表: commissions
   ✓ 导出表: withdrawals
   ...

💾 备份原schema.sql -> schema.sql.backup.20231205_143022
✅ 新schema.sql写入成功
📄 文件大小: 25.67 KB

🎉 表结构同步完成！

📌 下一步操作:
   1. 检查生成的 schema.sql 文件
   2. 验证所有表结构是否正确
   3. 提交到版本控制前进行人工review
```

## 注意事项

### 执行前确保

- ✅ `.env.local` 中的数据库连接配置正确
- ✅ 数据库用户有读取表结构的权限
- ✅ 了解原 `schema.sql` 会被自动备份

### 执行后检查

- ✅ 验证生成的 `schema.sql` 语法正确
- ✅ 确认所有表都已导出
- ✅ 检查外键和索引定义是否完整
- ✅ 确认表注释和字段注释是否保留

### 最佳实践

1. **定期同步**: 每次手动执行数据库迁移后运行此脚本
2. **版本控制**: 提交前人工review生成的SQL，确保没有意外变更
3. **备份管理**: 定期清理 `.backup.*` 备份文件，避免占用过多空间

## 文件位置

- **脚本**: `web_client/scripts/sync-schema.ts`
- **输出**: `web_client/src/lib/db/schema.sql`
- **备份**: `web_client/src/lib/db/schema.sql.backup.YYYYMMDD_HHMMSS`

## 相关脚本

- `npm run init-db` - 使用 schema.sql 初始化数据库
- `npm run migrate:*` - 执行各种数据库迁移

## 故障排除

### 连接失败
```
❌ 连接数据库失败
```
**解决方案**: 检查 `.env.local` 中的数据库配置是否正确

### 权限不足
```
❌ Access denied for user
```
**解决方案**: 确保数据库用户有 `SHOW TABLES` 和 `SHOW CREATE TABLE` 权限

### 文件写入失败
```
❌ ENOENT: no such file or directory
```
**解决方案**: 确保 `web_client/src/lib/db/` 目录存在

