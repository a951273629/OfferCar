// WebRTC 信令服务器配置
module.exports = {
  // 服务器端口（避免与 Next.js 3000 冲突）
  PORT: process.env.SIGNALING_PORT || 3001,
  
  // CORS 配置
  CORS_ORIGIN: [
    'http://localhost:3000',  // Next.js Web 应用
    'http://127.0.0.1:3000',
    'http://localhost:*',      // Electron 应用
    'http://localhost:3010',
    'http://127.0.0.1:*',
    'https://www.offercar.cn', // 生产环境
    'https://offercar.cn'
  ],
  
  // 配对码配置
  PAIRING_CODE_LENGTH: 6,
  PAIRING_CODE_EXPIRY: 5 * 60 * 1000, // 5分钟过期
  
  // 日志级别
  LOG_LEVEL: process.env.LOG_LEVEL || 'info'
};

