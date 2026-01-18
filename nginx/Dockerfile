FROM nginx:1.25-alpine

# 安装 curl 用于健康检查
RUN apk add --no-cache curl

# 删除默认配置
RUN rm /etc/nginx/conf.d/default.conf

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d/ /etc/nginx/conf.d/

# 创建 SSL 证书目录（空目录，证书将通过 Docker Volume 挂载）
RUN mkdir -p /etc/nginx/ssl && \
    chmod 755 /etc/nginx/ssl

# 暴露端口
EXPOSE 80 443

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

