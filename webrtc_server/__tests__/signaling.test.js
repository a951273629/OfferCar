// 信令管理器单元测试
const SignalingManager = require('../signaling');

describe('SignalingManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SignalingManager();
  });

  afterEach(() => {
    // 清理
    manager.pairingCodes.clear();
    manager.socketToPairingCode.clear();
    manager.connections.clear();
  });

  describe('生成配对码', () => {
    it('应该生成6位数字配对码', () => {
      const code = manager.generatePairingCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(code.length).toBe(6);
    });

    it('应该生成不同的配对码', () => {
      const code1 = manager.generatePairingCode();
      const code2 = manager.generatePairingCode();
      // 虽然理论上可能相同，但概率极低
      expect(code1).not.toBe(code2);
    });
  });

  describe('注册配对码', () => {
    it('应该成功注册新配对码', () => {
      const socketId = 'socket123';
      const code = '123456';

      const result = manager.registerPairingCode(socketId, code);

      expect(result.success).toBe(true);
      expect(result.code).toBe(code);
      expect(manager.pairingCodes.has(code)).toBe(true);
      expect(manager.socketToPairingCode.get(socketId)).toBe(code);
    });

    it('应该拒绝重复的配对码', () => {
      const socketId1 = 'socket123';
      const socketId2 = 'socket456';
      const code = '123456';

      manager.registerPairingCode(socketId1, code);
      const result = manager.registerPairingCode(socketId2, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('配对码已存在');
    });

    it('应该存储配对码的元数据', () => {
      const socketId = 'socket123';
      const code = '123456';

      manager.registerPairingCode(socketId, code);
      const codeInfo = manager.pairingCodes.get(code);

      expect(codeInfo.socketId).toBe(socketId);
      expect(codeInfo.role).toBe('receiver');
      expect(codeInfo.createdAt).toBeLessThanOrEqual(Date.now());
      expect(codeInfo.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('使用配对码连接', () => {
    it('应该成功连接有效的配对码', () => {
      const receiverSocketId = 'receiver123';
      const senderSocketId = 'sender456';
      const code = '123456';

      manager.registerPairingCode(receiverSocketId, code);
      const result = manager.connectWithCode(senderSocketId, code);

      expect(result.success).toBe(true);
      expect(result.receiverSocketId).toBe(receiverSocketId);
      expect(result.senderSocketId).toBe(senderSocketId);
      expect(manager.connections.get(receiverSocketId)).toBe(senderSocketId);
      expect(manager.connections.get(senderSocketId)).toBe(receiverSocketId);
    });

    it('应该拒绝不存在的配对码', () => {
      const senderSocketId = 'sender456';
      const code = '999999';

      const result = manager.connectWithCode(senderSocketId, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('配对码不存在或已过期');
    });

    it('应该拒绝过期的配对码', () => {
      const receiverSocketId = 'receiver123';
      const senderSocketId = 'sender456';
      const code = '123456';

      // 注册配对码
      manager.registerPairingCode(receiverSocketId, code);

      // 手动设置过期时间为过去
      const codeInfo = manager.pairingCodes.get(code);
      codeInfo.expiresAt = Date.now() - 1000;

      const result = manager.connectWithCode(senderSocketId, code);

      expect(result.success).toBe(false);
      expect(result.error).toBe('配对码已过期');
      expect(manager.pairingCodes.has(code)).toBe(false);
    });
  });

  describe('获取对方 Socket ID', () => {
    it('应该返回连接对方的 Socket ID', () => {
      const receiverSocketId = 'receiver123';
      const senderSocketId = 'sender456';
      const code = '123456';

      manager.registerPairingCode(receiverSocketId, code);
      manager.connectWithCode(senderSocketId, code);

      expect(manager.getPeerSocketId(receiverSocketId)).toBe(senderSocketId);
      expect(manager.getPeerSocketId(senderSocketId)).toBe(receiverSocketId);
    });

    it('应该返回 undefined 如果没有连接', () => {
      const socketId = 'socket123';
      expect(manager.getPeerSocketId(socketId)).toBeUndefined();
    });
  });

  describe('断开连接', () => {
    it('应该清理连接和配对码', () => {
      const receiverSocketId = 'receiver123';
      const senderSocketId = 'sender456';
      const code = '123456';

      manager.registerPairingCode(receiverSocketId, code);
      manager.connectWithCode(senderSocketId, code);

      const peerSocketId = manager.disconnect(receiverSocketId);

      expect(peerSocketId).toBe(senderSocketId);
      expect(manager.connections.has(receiverSocketId)).toBe(false);
      expect(manager.connections.has(senderSocketId)).toBe(false);
      expect(manager.pairingCodes.has(code)).toBe(false);
      expect(manager.socketToPairingCode.has(receiverSocketId)).toBe(false);
    });

    it('应该处理没有连接的断开', () => {
      const socketId = 'socket123';
      const peerSocketId = manager.disconnect(socketId);
      expect(peerSocketId).toBeUndefined();
    });
  });

  describe('清理过期配对码', () => {
    it('应该删除过期的配对码', () => {
      const socketId = 'socket123';
      const code = '123456';

      manager.registerPairingCode(socketId, code);

      // 手动设置过期
      const codeInfo = manager.pairingCodes.get(code);
      codeInfo.expiresAt = Date.now() - 1000;

      manager.cleanExpiredCodes();

      expect(manager.pairingCodes.has(code)).toBe(false);
      expect(manager.socketToPairingCode.has(socketId)).toBe(false);
    });

    it('应该保留未过期的配对码', () => {
      const socketId = 'socket123';
      const code = '123456';

      manager.registerPairingCode(socketId, code);
      manager.cleanExpiredCodes();

      expect(manager.pairingCodes.has(code)).toBe(true);
    });
  });

  describe('获取统计信息', () => {
    it('应该返回正确的统计信息', () => {
      const code1 = '123456';
      const code2 = '654321';

      manager.registerPairingCode('socket1', code1);
      manager.registerPairingCode('socket2', code2);
      manager.connectWithCode('socket3', code1);

      const stats = manager.getStats();

      expect(stats.activePairingCodes).toBe(2);
      expect(stats.activeConnections).toBe(1); // socket1 和 socket3 连接
    });
  });
});

