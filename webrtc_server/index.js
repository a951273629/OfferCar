// WebRTC 信令服务器入口
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const config = require('./config');
const SignalingManager = require('./signaling');

const app = express();
const httpServer = createServer(app);

// 配置 CORS
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true
}));

// Socket.IO 服务器配置
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Electron 应用和其他非浏览器客户端的 origin 为 undefined
      if (!origin) {
        console.log('[Server] 允许无 Origin 的请求（Electron 应用）');
        return callback(null, true);
      }

      // 检查是否在白名单中
      if (config.CORS_ORIGIN.includes(origin)) {
        console.log(`[Server] 允许白名单 Origin: ${origin}`);
        return callback(null, true);
      }

      // 拒绝其他来源
      console.warn(`[Server] 连接未知 Origin: ${origin}`);
      return callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 创建信令管理器
const signalingManager = new SignalingManager();

// 健康检查端点
app.get('/health', (req, res) => {
  const stats = signalingManager.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stats
  });
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log(`[Server] 客户端连接: ${socket.id}`);

  // 1. 注册配对码（客户端1 - Web 接收端）
  socket.on('register-pairing-code', (code, callback) => {
    const result = signalingManager.registerPairingCode(socket.id, code);

    if (callback) {
      callback(result);
    }
  });

  // 2. 使用配对码连接（客户端2 - Electron 发送端）
  socket.on('connect-with-code', (code, callback) => {
    const result = signalingManager.connectWithCode(socket.id, code);

    if (result.success) {
      // 通知接收端有人想连接
      io.to(result.receiverSocketId).emit('peer-connected', {
        peerSocketId: socket.id
      });
    }

    if (callback) {
      callback(result);
    }
  });

  // 3. 转发 WebRTC Offer
  socket.on('offer', (data, callback) => {
    const { offer, code } = data;
    const codeInfo = signalingManager.pairingCodes.get(code);

    if (codeInfo) {
      const receiverSocketId = codeInfo.socketId;
      console.log(`[Server] 转发 Offer: ${socket.id} → ${receiverSocketId}`);

      io.to(receiverSocketId).emit('offer', {
        offer,
        senderSocketId: socket.id
      });

      if (callback) {
        callback({ success: true });
      }
    } else {
      console.error(`[Server] ❌ 配对码不存在: ${code}`);
      if (callback) {
        callback({ success: false, error: '配对码不存在' });
      }
    }
  });

  // 4. 转发 WebRTC Answer
  socket.on('answer', (data, callback) => {
    const { answer } = data;
    const peerSocketId = signalingManager.getPeerSocketId(socket.id);

    if (peerSocketId) {
      console.log(`[Server] 转发 Answer: ${socket.id} → ${peerSocketId}`);
      io.to(peerSocketId).emit('answer', { answer });

      if (callback) {
        callback({ success: true });
      }
    } else {
      console.error(`[Server] ❌ 未找到连接对方: ${socket.id}`);
      if (callback) {
        callback({ success: false, error: '未找到连接对方' });
      }
    }
  });

  // 5. 转发 ICE Candidate
  socket.on('ice-candidate', (data) => {
    const { candidate } = data;
    const peerSocketId = signalingManager.getPeerSocketId(socket.id);

    if (peerSocketId) {
      console.log(`[Server] 转发 ICE Candidate: ${socket.id} → ${peerSocketId}`, {
        type: candidate.type,
        protocol: candidate.protocol
      });
      io.to(peerSocketId).emit('ice-candidate', { candidate });
    } else {
      console.warn(`[Server] ⚠️ 无法转发 ICE Candidate，未找到对方: ${socket.id}`);
    }
  });

  // 6. 断开连接（Socket 层面断开，但保留配对码）
  socket.on('disconnect', () => {
    console.log(`[Server] Socket 断开: ${socket.id}，保留配对码和连接映射（可能是移动端后台断开）`);
    // 不执行任何清理，保留配对码和连接映射
    // 依靠配对码过期机制（5分钟）和 manual-disconnect 事件来清理资源
    // 这样可以支持 iOS Safari 后台切换后重连
  });

  // 手动断开
  socket.on('manual-disconnect', () => {
    console.log(`[Server] 手动断开: ${socket.id}`);

    const peerSocketId = signalingManager.disconnect(socket.id);

    if (peerSocketId) {
      io.to(peerSocketId).emit('peer-disconnected');
    }
  });
});

// 错误处理
httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('\n========================================');
    console.error(`错误: 端口 ${config.PORT} 已被占用`);
    console.error('========================================');
    console.error('\n解决方案:');
    console.error(`1. 在 Windows 上查找占用进程:`);
    console.error(`   netstat -ano | findstr :${config.PORT}`);
    console.error(`   taskkill /PID <进程ID> /F`);
    console.error('\n2. 或修改 webrtc_server/config.js 使用其他端口');
    console.error(`   PORT: ${config.PORT + 1}`);
    console.error('========================================\n');
    process.exit(1);
  } else {
    console.error('服务器错误:', error);
    process.exit(1);
  }
});

// 启动服务器
httpServer.listen(config.PORT, () => {
  console.log('='.repeat(50));
  console.log(`WebRTC 信令服务器已启动`);
  console.log(`端口: ${config.PORT}`);
  console.log(`健康检查: http://localhost:${config.PORT}/health`);
  console.log('='.repeat(50));
});

// 定期清理过期的配对码（每5分钟）
setInterval(() => {
  signalingManager.cleanExpiredCodes();
}, 60 * 1000 * 5);

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭信令服务器...');
  httpServer.close(() => {
    console.log('信令服务器已关闭');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n正在关闭信令服务器...');
  httpServer.close(() => {
    console.log('信令服务器已关闭');
    process.exit(0);
  });
});

