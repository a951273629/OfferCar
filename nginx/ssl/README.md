# SSL 证书说明

请将您的腾讯云 SSL 证书文件放置到此目录。

## 重要说明

本项目采用 **Docker Volume 挂载** 方式管理 SSL 证书：
- ✅ 证书文件**不会**被打包到 Docker 镜像中（更安全）
- ✅ 运行时通过 Volume 将此目录挂载到 Nginx 容器的 `/etc/nginx/ssl/`
- ✅ 更新证书只需替换文件并重启容器，无需重新构建镜像
- ✅ Windows 环境下构建镜像时不需要证书文件即可成功

## 证书文件命名规范

### www.offercar.cn 主域名证书
- `offercar.cn.crt` - 证书文件（公钥）
- `offercar.cn.key` - 私钥文件

### www.docs.offercar.cn 文档子域名证书
- `docs.offercar.cn.crt` - 证书文件（公钥）
- `docs.offercar.cn.key` - 私钥文件

## 腾讯云 SSL 证书下载说明

1. 登录腾讯云控制台
2. 进入「SSL 证书管理」
3. 找到对应的域名证书
4. 下载「Nginx」格式的证书
5. 解压后会得到两个文件：
   - `域名.crt` 或 `域名_bundle.crt`
   - `域名.key`
6. 将文件重命名为上述规范并放置到此目录

## 文件权限设置

### Linux / Mac 环境

```bash
cd docker/nginx/ssl

# 设置证书文件权限
chmod 644 *.crt    # 证书文件可读
chmod 600 *.key    # 私钥文件仅所有者可读
```

### Windows 环境

Windows 下文件权限由 Docker Desktop 自动管理，无需手动设置。

## 注意事项

- 私钥文件（.key）包含敏感信息，请勿提交到 Git 仓库
- 建议将 `*.key` 和 `*.crt` 添加到 `.gitignore`
- 证书过期前请及时更新
- 如果使用通配符证书，可以为多个子域名使用同一证书

## 部署流程

### 1. 放置证书文件

将下载的证书文件放到此目录（`docker/nginx/ssl/`）：

```bash
# Windows
cd docker\nginx\ssl
# 将证书文件复制到此目录

# Linux/Mac
cd docker/nginx/ssl
# 将证书文件复制到此目录
```

### 2. 设置权限（仅 Linux/Mac）

```bash
chmod 644 *.crt
chmod 600 *.key
```

### 3. 构建 Docker 镜像

```bash
cd ../..  # 返回 docker 目录
docker-compose build
```

**注意**：此时即使 `ssl/` 目录为空或没有证书文件，构建也会成功！

### 4. 启动容器

```bash
docker-compose up -d
```

容器启动后，`docker/nginx/ssl/` 目录会自动挂载到容器内的 `/etc/nginx/ssl/`。

### 5. 验证证书挂载

```bash
# 检查证书文件是否正确挂载
docker exec offercar-nginx ls -lh /etc/nginx/ssl/

# 应该看到：
# offercar.cn.crt
# offercar.cn.key
# docs.offercar.cn.crt
# docs.offercar.cn.key
```

## 更新证书

当证书过期需要更新时：

```bash
# 1. 替换证书文件
cd docker/nginx/ssl
# 用新证书替换旧证书

# 2. 重启 Nginx 容器
docker-compose restart nginx

# 无需重新构建镜像！
```

## WebRTC 信令服务器

WebRTC 信令服务器配置为使用主域名证书（`offercar.cn.crt/key`），通过子域名 `webrtc.offercar.cn` 访问。

如果需要独立的证书，请添加：
- `webrtc.offercar.cn.crt`
- `webrtc.offercar.cn.key`

并修改 `nginx/conf.d/default.conf` 中的 WebRTC server 配置块。

