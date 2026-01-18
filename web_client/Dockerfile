# ================================
# Stage 1: 构建阶段
# ================================
FROM node:20-alpine AS builder

# 定义构建参数（从 docker-compose 传入）
# ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_DOCS_URL
ARG NEXT_PUBLIC_SIGNALING_SERVER_URL
ARG NEXT_PUBLIC_BETTER_AUTH_URL

# 设置为环境变量供 Next.js 构建使用  NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
ENV NEXT_PUBLIC_DOCS_URL=$NEXT_PUBLIC_DOCS_URL \
    NEXT_PUBLIC_SIGNALING_SERVER_URL=$NEXT_PUBLIC_SIGNALING_SERVER_URL \
    NEXT_PUBLIC_BETTER_AUTH_URL=$NEXT_PUBLIC_BETTER_AUTH_URL \
    ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PUPPETEER_SKIP_DOWNLOAD=1

WORKDIR /app

# 复制依赖配置文件
COPY package.json package-lock.json ./

# 安装所有依赖（包括 devDependencies）
# 使用 BuildKit 缓存加速依赖安装
RUN --mount=type=cache,target=/root/.npm \
    npm ci 
    # npm cache clean --force

# 复制源代码（包括 scripts, tsconfig.json, next.config.js 等所有文件）
COPY . .

# 构建 Next.js 应用（生成 standalone 输出）
RUN npm run build

# ================================
# Stage 2: 运行阶段
# ================================
FROM node:20-alpine AS runner

# 安装 dumb-init（用于正确处理信号）
RUN apk add --no-cache --update dumb-init || \
    (apk update && apk add --no-cache dumb-init) && \
    rm -rf /var/cache/apk/*

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# 从 builder 复制 standalone 输出（包含最小化的依赖）
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# 复制静态资源
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# 复制 public 目录
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 使用 dumb-init 启动应用（优雅处理信号）
ENTRYPOINT ["dumb-init", "--"]

# 启动 Next.js standalone 服务器
CMD ["node", "server.js"]
