// WebRTC 信令逻辑处理
const config = require('./config');

class SignalingManager {
  constructor() {
    // 配对码映射：{ '123456': { socketId: 'xxx', createdAt: Date, expiresAt: Date } }
    this.pairingCodes = new Map();
    
    // Socket ID 到配对码的反向映射
    this.socketToPairingCode = new Map();
    
    // 连接对映射：{ receiverSocketId: senderSocketId }
    this.connections = new Map();
  }

  // 生成配对码
  generatePairingCode() {
    // 生成6位随机数字
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // 注册配对码（客户端1 - Next.js Web 应用）
  registerPairingCode(socketId, code) {
    console.log(`[Signaling] 注册配对码: ${code} -> Socket ${socketId}`);
    
    // 检查配对码是否已存在
    if (this.pairingCodes.has(code)) {
      console.log(`[Signaling] ✗ 配对码已存在: ${code}`);
      return { success: false, error: '配对码已存在，请刷新重试' };
    }

    // 存储配对码（带自动过期）
    this.pairingCodes.set(code, {
      socketId,
      createdAt: Date.now(),
      expiresAt: Date.now() + config.PAIRING_CODE_EXPIRY
    });

    this.socketToPairingCode.set(socketId, code);

    console.log(`[Signaling] ✓ 配对码已注册: ${code}`);
    return { success: true, code };
  }

  // 使用配对码连接（客户端2 - Electron 应用）
  connectWithCode(senderSocketId, code) {
    const codeInfo = this.pairingCodes.get(code);

    if (!codeInfo) {
      console.log(`[Signaling] ✗ 配对码不存在: ${code}`);
      return { success: false, error: '配对码不存在或已过期' };
    }

    // 检查是否过期
    if (Date.now() > codeInfo.expiresAt) {
      this.pairingCodes.delete(code);
      this.socketToPairingCode.delete(codeInfo.socketId);
      console.log(`[Signaling] ✗ 配对码已过期: ${code}`);
      return { success: false, error: '配对码已过期' };
    }

    const receiverSocketId = codeInfo.socketId;

    // 建立连接映射
    this.connections.set(receiverSocketId, senderSocketId);
    this.connections.set(senderSocketId, receiverSocketId);

    console.log(`[Signaling] ✓ 连接建立: Sender ${senderSocketId} <-> Receiver ${receiverSocketId} (配对码: ${code})`);

    return { 
      success: true, 
      receiverSocketId,
      senderSocketId 
    };
  }

  // 获取连接对方的 Socket ID
  getPeerSocketId(socketId) {
    return this.connections.get(socketId);
  }

  // 断开连接（立即清理所有相关资源）
  disconnect(socketId) {
    console.log(`[Signaling] 断开连接: Socket ${socketId}`);
    
    const peerSocketId = this.connections.get(socketId);
    const code = this.socketToPairingCode.get(socketId);
    
    // 立即清理连接映射
    if (peerSocketId) {
      this.connections.delete(socketId);
      this.connections.delete(peerSocketId);
      console.log(`[Signaling] 连接已清理: ${socketId} <-> ${peerSocketId}`);
      
      // 清理对方的配对码映射
      const peerCode = this.socketToPairingCode.get(peerSocketId);
      if (peerCode) {
        this.pairingCodes.delete(peerCode);
        this.socketToPairingCode.delete(peerSocketId);
        console.log(`[Signaling] 对方配对码已清理: ${peerCode}`);
      }
    }
    
    // 清理自己的配对码映射
    if (code) {
      this.pairingCodes.delete(code);
      this.socketToPairingCode.delete(socketId);
      console.log(`[Signaling] 配对码已清理: ${code}`);
    }

    return peerSocketId;
  }

  // 清理过期的配对码
  cleanExpiredCodes() {
    const now = Date.now();
    const expiredCodes = [];
    
    for (const [code, info] of this.pairingCodes.entries()) {
      if (now > info.expiresAt) {
        expiredCodes.push(code);
        this.pairingCodes.delete(code);
        this.socketToPairingCode.delete(info.socketId);
      }
    }
    
    if (expiredCodes.length > 0) {
      console.log(`[Signaling] 清理了 ${expiredCodes.length} 个过期配对码:`, expiredCodes);
    }
  }

  // 获取统计信息
  getStats() {
    return {
      activePairingCodes: this.pairingCodes.size,
      activeConnections: this.connections.size / 2 // 双向映射，除以2
    };
  }
}

module.exports = SignalingManager;
