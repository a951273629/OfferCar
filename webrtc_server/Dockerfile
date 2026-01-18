# ================================
# Stage 1: 依赖安装阶段
# ================================
FROM node:20-alpine AS deps

WORKDIR /app

# 复制依赖配置
COPY package.json package-lock.json ./

# 安装生产依赖
RUN npm ci --omit=dev && \
    npm cache clean --force

# ================================
# Stage 2: 运行阶段
# ================================
FROM node:20-alpine AS runner

# 安装 dumb-init
RUN apk add --no-cache dumb-init

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production \
    SIGNALING_PORT=3001

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 webrtc

# 复制依赖
COPY --from=deps --chown=webrtc:nodejs /app/node_modules ./node_modules

# 复制源代码
COPY --chown=webrtc:nodejs *.js ./
COPY --chown=webrtc:nodejs package.json ./package.json

# 切换到非 root 用户
USER webrtc

# 暴露端口
EXPOSE 3001

# 健康检查（检查 HTTP 服务器是否响应）
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 使用 dumb-init 启动应用
ENTRYPOINT ["dumb-init", "--"]

# 启动 WebRTC 信令服务器
CMD ["node", "index.js"]

