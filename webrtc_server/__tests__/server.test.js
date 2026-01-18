// 信令服务器集成测试
const request = require('supertest');
const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const express = require('express');
const SignalingManager = require('../signaling');

describe('WebRTC 信令服务器集成测试', () => {
  let httpServer;
  let io;
  let serverSocket;
  let clientSocket1;
  let clientSocket2;
  let signalingManager;
  const PORT = 3002; // 使用不同端口避免冲突

  beforeAll((done) => {
    const app = express();
    httpServer = createServer(app);
    
    // 创建 Socket.IO 服务器
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    signalingManager = new SignalingManager();

    // 健康检查端点
    app.get('/health', (req, res) => {
      const stats = signalingManager.getStats();
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        stats
      });
    });

    // 监听连接
    io.on('connection', (socket) => {
      serverSocket = socket;

      // 注册配对码
      socket.on('register-pairing-code', (code, callback) => {
        const result = signalingManager.registerPairingCode(socket.id, code);
        if (callback) callback(result);
      });

      // 连接配对码
      socket.on('connect-with-code', (code, callback) => {
        const result = signalingManager.connectWithCode(socket.id, code);
        if (result.success) {
          io.to(result.receiverSocketId).emit('peer-connected', {
            peerSocketId: socket.id
          });
        }
        if (callback) callback(result);
      });

      // 转发 offer
      socket.on('offer', (data, callback) => {
        const { offer, code } = data;
        const codeInfo = signalingManager.pairingCodes.get(code);
        
        if (codeInfo) {
          io.to(codeInfo.socketId).emit('offer', {
            offer,
            senderSocketId: socket.id
          });
          if (callback) callback({ success: true });
        } else {
          if (callback) callback({ success: false, error: '配对码不存在' });
        }
      });

      // 转发 answer
      socket.on('answer', (data, callback) => {
        const { answer } = data;
        const peerSocketId = signalingManager.getPeerSocketId(socket.id);
        
        if (peerSocketId) {
          io.to(peerSocketId).emit('answer', { answer });
          if (callback) callback({ success: true });
        } else {
          if (callback) callback({ success: false, error: '未找到连接对方' });
        }
      });

      // 转发 ICE candidate
      socket.on('ice-candidate', (data) => {
        const { candidate } = data;
        const peerSocketId = signalingManager.getPeerSocketId(socket.id);
        
        if (peerSocketId) {
          io.to(peerSocketId).emit('ice-candidate', { candidate });
        }
      });
    });

    httpServer.listen(PORT, done);
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    // 创建客户端连接
    clientSocket1 = Client(`http://localhost:${PORT}`);
    clientSocket1.on('connect', () => {
      clientSocket2 = Client(`http://localhost:${PORT}`);
      clientSocket2.on('connect', done);
    });
  });

  afterEach(() => {
    if (clientSocket1.connected) {
      clientSocket1.disconnect();
    }
    if (clientSocket2.connected) {
      clientSocket2.disconnect();
    }
    // 清理
    signalingManager.pairingCodes.clear();
    signalingManager.socketToPairingCode.clear();
    signalingManager.connections.clear();
  });

  describe('健康检查端点', () => {
    it('应该返回服务器状态', async () => {
      const response = await request(httpServer).get('/health');
      
      expect(response.statusCode).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.stats).toBeDefined();
    });
  });

  describe('Socket.IO 连接', () => {
    it('客户端应该能够连接到服务器', (done) => {
      expect(clientSocket1.connected).toBe(true);
      expect(clientSocket2.connected).toBe(true);
      done();
    });
  });

  describe('配对码注册流程', () => {
    it('客户端1应该能够注册配对码', (done) => {
      const code = '123456';

      clientSocket1.emit('register-pairing-code', code, (result) => {
        expect(result.success).toBe(true);
        expect(result.code).toBe(code);
        done();
      });
    });

    it('不应该允许重复注册配对码', (done) => {
      const code = '123456';

      clientSocket1.emit('register-pairing-code', code, (result1) => {
        expect(result1.success).toBe(true);

        clientSocket2.emit('register-pairing-code', code, (result2) => {
          expect(result2.success).toBe(false);
          expect(result2.error).toBe('配对码已存在');
          done();
        });
      });
    });
  });

  describe('配对码连接流程', () => {
    it('客户端2应该能够使用配对码连接', (done) => {
      const code = '123456';

      // 客户端1注册配对码
      clientSocket1.emit('register-pairing-code', code, (result1) => {
        expect(result1.success).toBe(true);

        // 客户端1监听 peer-connected
        clientSocket1.on('peer-connected', (data) => {
          expect(data.peerSocketId).toBeDefined();
          done();
        });

        // 客户端2使用配对码连接
        clientSocket2.emit('connect-with-code', code, (result2) => {
          expect(result2.success).toBe(true);
        });
      });
    });

    it('应该拒绝无效的配对码', (done) => {
      const invalidCode = '999999';

      clientSocket2.emit('connect-with-code', invalidCode, (result) => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('配对码不存在或已过期');
        done();
      });
    });
  });

  describe('WebRTC 信令消息转发', () => {
    it('应该转发 Offer 从发送端到接收端', (done) => {
      const code = '123456';
      const mockOffer = { type: 'offer', sdp: 'mock-sdp' };

      // 客户端1注册配对码
      clientSocket1.emit('register-pairing-code', code, () => {
        // 客户端1监听 offer
        clientSocket1.on('offer', (data) => {
          expect(data.offer).toEqual(mockOffer);
          expect(data.senderSocketId).toBeDefined();
          done();
        });

        // 客户端2连接并发送 offer
        clientSocket2.emit('connect-with-code', code, () => {
          clientSocket2.emit('offer', { offer: mockOffer, code });
        });
      });
    });

    it('应该转发 Answer 从接收端到发送端', (done) => {
      const code = '123456';
      const mockAnswer = { type: 'answer', sdp: 'mock-answer-sdp' };

      // 建立连接
      clientSocket1.emit('register-pairing-code', code, () => {
        clientSocket2.emit('connect-with-code', code, () => {
          // 客户端2监听 answer
          clientSocket2.on('answer', (data) => {
            expect(data.answer).toEqual(mockAnswer);
            done();
          });

          // 客户端1发送 answer
          clientSocket1.emit('answer', { answer: mockAnswer });
        });
      });
    });

    it('应该转发 ICE Candidate', (done) => {
      const code = '123456';
      const mockCandidate = { candidate: 'mock-candidate', sdpMid: '0' };

      // 建立连接
      clientSocket1.emit('register-pairing-code', code, () => {
        clientSocket2.emit('connect-with-code', code, () => {
          // 客户端2监听 ice-candidate
          clientSocket2.on('ice-candidate', (data) => {
            expect(data.candidate).toEqual(mockCandidate);
            done();
          });

          // 客户端1发送 ice-candidate
          clientSocket1.emit('ice-candidate', { candidate: mockCandidate });
        });
      });
    });
  });
});

