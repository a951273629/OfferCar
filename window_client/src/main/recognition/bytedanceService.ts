/**
 * 火山引擎语音识别服务（主进程）
 * 
 * 在 Node.js 环境中管理 WebSocket 连接，支持自定义请求头
 * 通过 IPC 与渲染进程通信
 */

import WebSocket from 'ws';
import pako from 'pako';
import { v4 as uuidv4 } from 'uuid';
import type { BrowserWindow } from 'electron';

// 火山引擎大模型语音识别配置
const BYTEDANCE_APP_KEY = process.env.BYTEDANCE_APP_KEY;
const BYTEDANCE_ACCESS_TOKEN = process.env.BYTEDANCE_ACCESS_TOKEN;

// WebSocket 端点（双向流式优化版本）
const BYTEDANCE_WS_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel_async';

// 协议常量定义
const ProtocolVersion = {
  V1: 0b0001,
} as const;

const MessageType = {
  CLIENT_FULL_REQUEST: 0b0001,        // 完整客户端请求
  CLIENT_AUDIO_ONLY_REQUEST: 0b0010,  // 仅音频请求
  SERVER_FULL_RESPONSE: 0b1001,       // 服务器完整响应
  SERVER_ERROR_RESPONSE: 0b1111,      // 服务器错误响应
} as const;

const MessageTypeSpecificFlags = {
  NO_SEQUENCE: 0b0000,      // 无序列号
  POS_SEQUENCE: 0b0001,     // 正序列号
  NEG_SEQUENCE: 0b0010,     // 负序列号（最后一包）
  NEG_WITH_SEQUENCE: 0b0011, // 带负序列号（最后一包）
} as const;

const SerializationType = {
  NO_SERIALIZATION: 0b0000, // 无序列化
  JSON: 0b0001,             // JSON 序列化
} as const;

const CompressionType = {
  NO_COMPRESSION: 0b0000,   // 不压缩
  GZIP: 0b0001,             // Gzip 压缩
} as const;

// 语音分句信息接口
interface UtteranceInfo {
  text: string;
  start_time: number;
  end_time: number;
  definite: boolean;  // 是否是确定分句（关键字段）
}

// 识别结果接口
interface BytedanceRecognitionResult {
  code: number;
  message?: string;
  sequence?: number;
  is_last_package?: boolean;
  result?: {
    text?: string;
    utterances?: UtteranceInfo[];  // 语音分句信息（需开启 show_utterances）
  };
}

// 识别文本消息接口（发送给渲染进程）
export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';
  timestamp: number;
}

/**
 * 火山引擎识别服务类
 */
class BytedanceRecognitionService {
  // 主窗口引用（用于发送 IPC 消息）
  private mainWindow: BrowserWindow | null = null;

  // WebSocket 连接
  private intervieweeWs: WebSocket | null = null;
  private interviewerWs: WebSocket | null = null;

  // WebSocket 连接状态标志
  private intervieweeConnected = false;
  private interviewerConnected = false;

  // 序列号
  private intervieweeSeq = 1;
  private interviewerSeq = 1;

  // 音频缓冲区
  private intervieweeBuffer: Int16Array[] = [];
  private interviewerBuffer: Int16Array[] = [];

  // 发送定时器
  private intervieweeSendTimer: NodeJS.Timeout | null = null;
  private interviewerSendTimer: NodeJS.Timeout | null = null;

  // 运行状态
  private isRunning = false;

  // 会话 ID（用于防止旧会话回调干扰新会话）
  private sessionId: string | null = null;

  /**
   * 设置主窗口引用
   */
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  /**
   * 发送识别消息到渲染进程
   */
  private sendRecognitionMessage(message: RecognitionTextMessage) {
    if (!this.mainWindow) {
      return;
    }
    this.mainWindow.webContents.send('recognition:result', message);
  }

  /**
   * 处理确定分句（definite === true）
   */
  private processDefiniteUtterances(
    utterances: UtteranceInfo[],
    role: 'interviewee' | 'interviewer'
  ): number {
    if (!this.mainWindow) {
      return 0;
    }

    const definiteUtterances = utterances.filter(
      u => u.definite === true && u.text && u.text.trim()
    );

    if (definiteUtterances.length === 0) {
      return 0;
    }

    definiteUtterances.forEach(utterance => {
      const message: RecognitionTextMessage = {
        role,
        text: utterance.text.trim(),
        type: 'recognized',
        status: 'received',
        timestamp: Date.now()
      };
      this.sendRecognitionMessage(message);
    });

    return definiteUtterances.length;
  }

  /**
   * 处理未确定文本（pending 状态）
   */
  private processPendingText(
    fullText: string,
    role: 'interviewee' | 'interviewer',
    hasDefiniteUtterances: boolean
  ) {
    if (!fullText || !fullText.trim()) {
      return;
    }

    if (hasDefiniteUtterances) {
      return;
    }

    if (!this.mainWindow) {
      return;
    }

    const message: RecognitionTextMessage = {
      role,
      text: fullText.trim(),
      type: 'recognizing',
      status: 'pending',
      timestamp: Date.now()
    };

    this.sendRecognitionMessage(message);
  }

  /**
   * 处理识别结果
   */
  private handleRecognitionResult(
    result: BytedanceRecognitionResult,
    role: 'interviewee' | 'interviewer',
    roleLabel: string
  ) {
    // 检查错误
    if (result.code !== 0 && result.code !== undefined) {
      console.error(`[BytedanceService] ${roleLabel} 识别错误 [${result.code}]:`, result.message);
      return;
    }

    // 检查是否有识别结果
    if (!result.result || !result.result.utterances) {
      return;
    }

    const utterances = result.result.utterances || [];

    // 处理确定分句
    const definiteCount = this.processDefiniteUtterances(utterances, role);

    // 处理未确定文本
    const fullText = result.result.text || '';
    this.processPendingText(fullText, role, definiteCount > 0);

    // 识别完成（整个会话结束）
    if (result.is_last_package) {
      console.log(`[BytedanceService] ${roleLabel} 会话结束（is_last_package=true）`);
    }
  }

  /**
   * 更新连接状态
   */
  private updateConnectionState(role: 'interviewee' | 'interviewer', connected: boolean) {
    if (role === 'interviewee') {
      this.intervieweeConnected = connected;
    } else {
      this.interviewerConnected = connected;
    }
    console.log(`[BytedanceService] 连接状态更新: 面试者=${this.intervieweeConnected}, 面试官=${this.interviewerConnected}`);
  }

  /**
   * 判断是否应该重置服务
   */
  private shouldResetService(currentSessionId: string | null): boolean {
    if (currentSessionId !== this.sessionId) {
      return false;
    }

    if (this.intervieweeConnected || this.interviewerConnected) {
      return false;
    }

    return true;
  }

  /**
   * 清理服务状态
   */
  private cleanupService() {
    // 停止定时器
    if (this.intervieweeSendTimer) {
      clearInterval(this.intervieweeSendTimer);
      this.intervieweeSendTimer = null;
    }
    if (this.interviewerSendTimer) {
      clearInterval(this.interviewerSendTimer);
      this.interviewerSendTimer = null;
    }

    // 清空缓冲区
    this.intervieweeBuffer = [];
    this.interviewerBuffer = [];

    // 重置连接状态标志
    this.intervieweeConnected = false;
    this.interviewerConnected = false;

    // 重置运行状态
    this.isRunning = false;
  }

  /**
   * 记录 WebSocket 关闭代码说明
   */
  private logCloseCode(code: number) {
    if (code === 1000) {
      console.log(`  - 说明: 正常关闭`);
      return;
    }

    if (code === 1001) {
      console.log(`  - 说明: 端点离开`);
      return;
    }

    if (code === 1002) {
      console.log(`  - 说明: 协议错误`);
      return;
    }

    if (code === 1006) {
      console.log(`  - 说明: 异常关闭（可能是网络问题）`);
      return;
    }

    if (code === 1008) {
      console.log(`  - 说明: 策略违规`);
      return;
    }

    if (code === 1011) {
      console.log(`  - 说明: 服务器内部错误`);
    }
  }

  /**
   * 判断是否为严重错误
   */
  private isCriticalError(error: Error): boolean {
    if (!error.message) {
      return false;
    }

    const criticalErrors = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];

    return criticalErrors.some(errorType => error.message.includes(errorType));
  }

  /**
   * 关闭 WebSocket 连接
   */
  private closeWebSocket(ws: WebSocket | null, seq: number): void {
    if (!ws) {
      return;
    }

    if (ws.readyState === WebSocket.OPEN) {
      try {
        const silencePacket = new Int16Array(3200).fill(0);
        const request = this.buildAudioOnlyRequest(seq, silencePacket, true);
        ws.send(request);
      } catch (err) {
        // 忽略发送错误
      }
    }

    ws.close();
  }

  /**
   * 构建请求头（4字节）
   */
  private buildRequestHeader(
    messageType: number,
    flags: number,
    serializationType: number,
    compressionType: number
  ): Uint8Array {
    const header = new Uint8Array(4);

    // Byte 0: 版本(4位高) + header大小(4位低，固定为1表示4字节)
    header[0] = (ProtocolVersion.V1 << 4) | 0x01;

    // Byte 1: 消息类型(4位高) + 消息类型特定标志(4位低)
    header[1] = (messageType << 4) | flags;

    // Byte 2: 序列化类型(4位高) + 压缩类型(4位低)
    header[2] = (serializationType << 4) | compressionType;

    // Byte 3: 保留字段
    header[3] = 0x00;

    return header;
  }

  /**
   * 构建完整客户端请求（Full Client Request）
   */
  private buildFullClientRequest(sequence: number): Buffer {
    const header = this.buildRequestHeader(
      MessageType.CLIENT_FULL_REQUEST,
      MessageTypeSpecificFlags.POS_SEQUENCE,
      SerializationType.JSON,
      CompressionType.GZIP
    );

    const payload = {
      user: {
        uid: 'electron_client_user',
      },
      audio: {
        format: 'pcm',
        codec: 'raw',
        rate: 16000,
        bits: 16,
        channel: 1,
      },
      request: {
        model_name: 'bigmodel',
        enable_itn: true,
        enable_punc: true,
        enable_ddc: true,
        show_utterances: true,
        result_type: 'single',  // 每次只返回当前分句结果，使 definite 能正确返回 true
        enable_nonstream: true,  // 启用流式+非流式二遍识别，使 definite 能正确返回 true
      },
    };

    const payloadJson = JSON.stringify(payload);
    const payloadBytes = Buffer.from(payloadJson, 'utf-8');
    const compressedPayload = pako.gzip(payloadBytes);

    const totalLength = header.length + 4 + 4 + compressedPayload.length;
    const request = Buffer.alloc(totalLength);

    let offset = 0;

    // 1. Header（4字节）
    request.set(header, offset);
    offset += header.length;

    // 2. Sequence（4字节，大端序）
    request.writeInt32BE(sequence, offset);
    offset += 4;

    // 3. Payload Size（4字节，大端序）
    request.writeUInt32BE(compressedPayload.length, offset);
    offset += 4;

    // 4. Compressed Payload
    request.set(compressedPayload, offset);

    return request;
  }

  /**
   * 构建仅音频请求（Audio Only Request）
   */
  private buildAudioOnlyRequest(
    sequence: number,
    audioData: Int16Array,
    isLast: boolean = false
  ): Buffer {
    const flags = isLast
      ? MessageTypeSpecificFlags.NEG_WITH_SEQUENCE
      : MessageTypeSpecificFlags.POS_SEQUENCE;

    const seq = isLast ? -sequence : sequence;

    const header = this.buildRequestHeader(
      MessageType.CLIENT_AUDIO_ONLY_REQUEST,
      flags,
      SerializationType.NO_SERIALIZATION,
      CompressionType.GZIP
    );

    // 将 Int16Array 转为 Buffer
    const audioBytes = Buffer.from(audioData.buffer, audioData.byteOffset, audioData.byteLength);
    const compressedAudio = pako.gzip(audioBytes);

    const totalLength = header.length + 4 + 4 + compressedAudio.length;
    const request = Buffer.alloc(totalLength);

    let offset = 0;

    request.set(header, offset);
    offset += header.length;

    request.writeInt32BE(seq, offset);
    offset += 4;

    request.writeUInt32BE(compressedAudio.length, offset);
    offset += 4;

    request.set(compressedAudio, offset);

    return request;
  }

  /**
   * 解析服务器响应
   */
  private parseServerResponse(data: Buffer): BytedanceRecognitionResult {
    const headerSize = (data[0] & 0x0f) * 4;
    const messageType = (data[1] >> 4) & 0x0f;
    const messageTypeFlags = data[1] & 0x0f;
    const serializationType = (data[2] >> 4) & 0x0f;
    const compressionType = data[2] & 0x0f;

    let offset = headerSize;

    const result: BytedanceRecognitionResult = {
      code: 0,
    };

    // 解析 message_type_specific_flags
    if (messageTypeFlags & 0x01) {
      result.sequence = data.readInt32BE(offset);
      offset += 4;
    }

    if (messageTypeFlags & 0x02) {
      result.is_last_package = true;
    }

    if (messageTypeFlags & 0x04) {
      offset += 4;
    }

    if (messageType === MessageType.SERVER_FULL_RESPONSE) {
      const payloadSize = data.readUInt32BE(offset);
      offset += 4;

      if (payloadSize > 0 && offset < data.length) {
        const payload = data.slice(offset, offset + payloadSize);

        let decompressedPayload: Buffer = payload;
        if (compressionType === CompressionType.GZIP) {
          try {
            decompressedPayload = Buffer.from(pako.ungzip(payload));
          } catch (err) {
            console.error('[BytedanceService] Gzip 解压失败:', err);
            result.code = -1;
            result.message = 'Gzip 解压失败';
            return result;
          }
        }

        if (serializationType === SerializationType.JSON) {
          try {
            const jsonStr = decompressedPayload.toString('utf-8');
            const jsonData = JSON.parse(jsonStr);
            Object.assign(result, jsonData);
          } catch (err) {
            console.error('[BytedanceService] JSON 解析失败:', err);
            result.code = -1;
            result.message = 'JSON 解析失败';
          }
        }
      }
    } else if (messageType === MessageType.SERVER_ERROR_RESPONSE) {
      result.code = data.readInt32BE(offset);
      offset += 4;

      const payloadSize = data.readUInt32BE(offset);
      offset += 4;

      if (payloadSize > 0 && offset < data.length) {
        const payload = data.slice(offset, offset + payloadSize);

        let decompressedPayload: Buffer = payload;
        if (compressionType === CompressionType.GZIP) {
          try {
            decompressedPayload = Buffer.from(pako.ungzip(payload));
          } catch (err) {
            console.error('[BytedanceService] 错误消息 Gzip 解压失败:', err);
          }
        }

        if (serializationType === SerializationType.JSON) {
          try {
            const jsonStr = decompressedPayload.toString('utf-8');
            const jsonData = JSON.parse(jsonStr);
            result.message = jsonData.message || jsonStr;
          } catch (err) {
            result.message = decompressedPayload.toString('utf-8');
          }
        }
      }
    }

    return result;
  }

  /**
   * 创建 WebSocket 连接
   */
  private createWebSocketConnection(role: 'interviewee' | 'interviewer'): WebSocket {
    const reqId = uuidv4();
    const roleLabel = role === 'interviewee' ? '面试者' : '面试官';

    // 捕获当前会话 ID，用于在回调中验证
    const currentSessionId = this.sessionId;

    // console.log(`[BytedanceService] 创建 ${roleLabel} WebSocket 连接...`);
    // console.log(`[BytedanceService] Request ID: ${reqId}, Session ID: ${currentSessionId}`);
    // console.log(`[BytedanceService] WebSocket URL: ${BYTEDANCE_WS_URL}`);
    // console.log(`[BytedanceService] 请求头配置:`);
    // console.log(`  - X-Api-Resource-Id: volc.bigasr.sauc.duration`);
    // console.log(`  - X-Api-Request-Id: ${reqId}`);
    // console.log(`  - X-Api-Access-Key: ${BYTEDANCE_ACCESS_TOKEN ? '已设置（长度: ' + BYTEDANCE_ACCESS_TOKEN.length + '）' : '未设置'}`);
    // console.log(`  - X-Api-App-Key: ${BYTEDANCE_APP_KEY ? '已设置（' + BYTEDANCE_APP_KEY + '）' : '未设置'}`);

    const ws = new WebSocket(BYTEDANCE_WS_URL, {
      headers: {
        'X-Api-Resource-Id': 'volc.bigasr.sauc.duration',
        'X-Api-Request-Id': reqId,
        'X-Api-Access-Key': BYTEDANCE_ACCESS_TOKEN,
        'X-Api-App-Key': BYTEDANCE_APP_KEY,
      }
    });

    // 获取对应的序列号引用
    const getSeq = () => role === 'interviewee' ? this.intervieweeSeq : this.interviewerSeq;
    const incSeq = () => {
      if (role === 'interviewee') {
        this.intervieweeSeq += 1;
      } else {
        this.interviewerSeq += 1;
      }
    };

    // 连接打开
    ws.on('open', () => {
      // 检查会话 ID 是否匹配，防止旧会话回调干扰新会话
      if (currentSessionId !== this.sessionId) {
        console.log(`[BytedanceService] ${roleLabel} WebSocket 已连接，但会话已过期，关闭连接`);
        ws.close();
        return;
      }

      console.log(`[BytedanceService] ✓ ${roleLabel} WebSocket 连接成功`);
      console.log(`[BytedanceService] ${roleLabel} WebSocket 状态: ${ws.readyState} (OPEN)`);

      // 设置连接状态标志
      if (role === 'interviewee') {
        this.intervieweeConnected = true;
      } else {
        this.interviewerConnected = true;
      }
      console.log(`[BytedanceService] 连接状态更新: 面试者=${this.intervieweeConnected}, 面试官=${this.interviewerConnected}`);

      // 发送 Full Client Request（初始化）
      try {
        const request = this.buildFullClientRequest(getSeq());
        ws.send(request);
        console.log(`[BytedanceService] ✓ ${roleLabel} 已发送初始化请求, seq: ${getSeq()}, 数据大小: ${request.length} bytes`);
        incSeq();

        // 启动发送定时器（传入会话 ID）
        this.startSendTimer(role, ws, currentSessionId);
      } catch (err) {
        console.error(`[BytedanceService] ✗ ${roleLabel} 发送初始化请求失败:`, err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`[BytedanceService] 错误详情: ${errorMsg}`);
      }
    });

    // 接收消息
    ws.on('message', (data: Buffer) => {
      // 检查会话 ID 是否匹配
      if (currentSessionId !== this.sessionId) {
        return;
      }

      try {
        const result = this.parseServerResponse(data);
        this.handleRecognitionResult(result, role, roleLabel);
      } catch (err) {
        console.error(`[BytedanceService] ${roleLabel} 解析消息失败:`, err);
      }
    });

    // 连接关闭
    ws.on('close', (code, reason) => {
      const reasonStr = reason.toString();
      console.log(`[BytedanceService] ${roleLabel} WebSocket 已关闭`);
      console.log(`  - 关闭代码: ${code}`);
      console.log(`  - 关闭原因: ${reasonStr || '无'}`);
      console.log(`  - 会话 ID: ${currentSessionId}`);

      // 记录关闭代码说明
      this.logCloseCode(code);

      // 更新连接状态
      this.updateConnectionState(role, false);

      // 检查是否需要重置服务
      if (!this.shouldResetService(currentSessionId)) {
        return;
      }

      console.log(`[BytedanceService] 两个 WebSocket 都已关闭，清理服务状态...`);
      this.cleanupService();
      console.log(`[BytedanceService] ✓ 服务状态已重置，isRunning = false`);
    });

    // 连接错误
    ws.on('error', (error) => {
      console.error(`[BytedanceService] ✗ ${roleLabel} WebSocket 错误:`);
      console.error(`  - 错误消息: ${error.message}`);
      console.error(`  - 错误类型: ${error.name}`);
      console.error(`  - 会话 ID: ${currentSessionId}`);
      console.error(`  - 完整错误对象:`, error);

      // 更新连接状态
      this.updateConnectionState(role, false);

      // 检查会话是否已过期
      if (currentSessionId !== this.sessionId) {
        return;
      }

      // 检查是否为严重错误
      if (!this.isCriticalError(error)) {
        return;
      }

      console.error(`[BytedanceService] ✗ 检测到严重网络错误，立即清理服务...`);

      // 关闭所有 WebSocket 连接
      if (this.intervieweeWs && this.intervieweeWs.readyState !== WebSocket.CLOSED) {
        this.intervieweeWs.close();
      }
      if (this.interviewerWs && this.interviewerWs.readyState !== WebSocket.CLOSED) {
        this.interviewerWs.close();
      }

      // 清理服务状态
      this.cleanupService();
      console.log(`[BytedanceService] ✓ 因严重错误已强制重置服务状态，isRunning = false`);
    });

    return ws;
  }

  /**
   * 合并缓冲区音频数据
   */
  private mergeBufferedAudio(buffer: Int16Array[]): Int16Array {
    const totalLength = buffer.reduce((sum, arr) => sum + arr.length, 0);
    const mergedData = new Int16Array(totalLength);
    let offset = 0;

    for (const chunk of buffer) {
      mergedData.set(chunk, offset);
      offset += chunk.length;
    }

    return mergedData;
  }

  /**
   * 发送缓冲的音频数据
   */
  private sendBufferedAudio(
    role: 'interviewee' | 'interviewer',
    ws: WebSocket,
    roleLabel: string
  ): boolean {
    const buffer = role === 'interviewee' ? this.intervieweeBuffer : this.interviewerBuffer;

    if (buffer.length === 0) {
      return false;
    }

    // 合并缓冲的数据
    const mergedData = this.mergeBufferedAudio(buffer);

    // 检查 WebSocket 状态
    if (ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    // 发送音频数据
    try {
      const seq = role === 'interviewee' ? this.intervieweeSeq : this.interviewerSeq;
      const request = this.buildAudioOnlyRequest(seq, mergedData, false);
      ws.send(request);

      // 增加序列号
      if (role === 'interviewee') {
        this.intervieweeSeq += 1;
      } else {
        this.interviewerSeq += 1;
      }
    } catch (err) {
      console.error(`[BytedanceService] ${roleLabel} 发送音频数据失败:`, err);
      return false;
    }

    // 清空缓冲区
    if (role === 'interviewee') {
      this.intervieweeBuffer = [];
    } else {
      this.interviewerBuffer = [];
    }

    return true;
  }

  /**
   * 启动发送定时器
   */
  private startSendTimer(role: 'interviewee' | 'interviewer', ws: WebSocket, currentSessionId: string | null) {
    const roleLabel = role === 'interviewee' ? '面试者' : '面试官';

    // 每 200ms 发送一次
    const timer = setInterval(() => {
      // 检查会话 ID 是否匹配，防止旧会话定时器继续发送
      if (currentSessionId !== this.sessionId) {
        clearInterval(timer);
        return;
      }

      this.sendBufferedAudio(role, ws, roleLabel);
    }, 200);

    // 保存定时器引用
    if (role === 'interviewee') {
      this.intervieweeSendTimer = timer;
    } else {
      this.interviewerSendTimer = timer;
    }

    console.log(`[BytedanceService] ${roleLabel} 发送定时器已启动`);
  }

  /**
   * 启动识别
   */
  startRecognition(): { success: boolean; error?: string } {
    try {
      if (this.isRunning) {
        const msg = '识别已在运行中，无法重复启动';
        console.log(`[BytedanceService] ${msg}`);
        return { success: false, error: msg };
      }

      // console.log('═'.repeat(50));
      console.log('[BytedanceService] 启动双流识别模式（主进程）');

      // 验证配置
      // console.log('[BytedanceService] 验证配置:');
      // console.log(`  - APP_KEY: ${BYTEDANCE_APP_KEY ? '已配置' : '未配置'}`);
      // console.log(`  - ACCESS_TOKEN: ${BYTEDANCE_ACCESS_TOKEN ? '已配置（长度: ' + BYTEDANCE_ACCESS_TOKEN.length + '）' : '未配置'}`);
      // console.log(`  - WebSocket URL: ${BYTEDANCE_WS_URL}`);

      if (!BYTEDANCE_APP_KEY || !BYTEDANCE_ACCESS_TOKEN) {
        const msg = '火山引擎配置缺失（APP_KEY 或 ACCESS_TOKEN 未配置）';
        console.error(`[BytedanceService] ${msg}`);
        return { success: false, error: msg };
      }

      // 生成新的会话 ID（确保旧会话的回调不会干扰新会话）
      this.sessionId = uuidv4();
      console.log(`[BytedanceService] 新会话 ID: ${this.sessionId}`);

      // 重置序列号
      this.intervieweeSeq = 1;
      this.interviewerSeq = 1;

      // 清空缓冲区
      this.intervieweeBuffer = [];
      this.interviewerBuffer = [];

      // 重置连接状态标志
      this.intervieweeConnected = false;
      this.interviewerConnected = false;

      // 创建 WebSocket 连接
      console.log('[BytedanceService] 创建双流 WebSocket 连接...');
      this.intervieweeWs = this.createWebSocketConnection('interviewee');
      this.interviewerWs = this.createWebSocketConnection('interviewer');

      this.isRunning = true;
      console.log('[BytedanceService] 双流识别已启动（WebSocket 连接中...）');
      console.log('═'.repeat(50));

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[BytedanceService] 启动识别失败，捕获异常:', errorMsg);
      console.error('[BytedanceService] 异常堆栈:', error);
      return { success: false, error: `启动异常: ${errorMsg}` };
    }
  }

  /**
   * 停止识别
   */
  stopRecognition(): { success: boolean; error?: string } {
    if (!this.isRunning) {
      const msg = '识别未在运行，无需停止';
      console.log(`[BytedanceService] ${msg}`);
      return { success: false, error: msg };
    }

    try {
      console.log('[BytedanceService] 停止识别');

      // 清除会话 ID（使旧会话的回调和定时器失效）
      const oldSessionId = this.sessionId;
      this.sessionId = null;
      console.log(`[BytedanceService] 清除会话 ID: ${oldSessionId}`);

      // 停止定时器
      if (this.intervieweeSendTimer) {
        clearInterval(this.intervieweeSendTimer);
        this.intervieweeSendTimer = null;
      }
      if (this.interviewerSendTimer) {
        clearInterval(this.interviewerSendTimer);
        this.interviewerSendTimer = null;
      }

      // 关闭 WebSocket 连接
      this.closeWebSocket(this.intervieweeWs, this.intervieweeSeq);
      this.closeWebSocket(this.interviewerWs, this.interviewerSeq);
      this.intervieweeWs = null;
      this.interviewerWs = null;

      // 清空缓冲区
      this.intervieweeBuffer = [];
      this.interviewerBuffer = [];

      // 重置连接状态标志
      this.intervieweeConnected = false;
      this.interviewerConnected = false;

      this.isRunning = false;
      console.log('[BytedanceService] 识别已停止');

      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[BytedanceService] 停止识别失败，捕获异常:', errorMsg);
      console.error('[BytedanceService] 异常堆栈:', error);
      return { success: false, error: `停止异常: ${errorMsg}` };
    }
  }

  /**
   * 发送音频数据
   */
  sendAudioData(role: 'interviewee' | 'interviewer', audioData: number[]): boolean {
    if (!this.isRunning) {
      return false;
    }

    // 将 number[] 转换为 Int16Array
    const int16Data = new Int16Array(audioData);

    if (role === 'interviewee') {
      this.intervieweeBuffer.push(int16Data);
    } else {
      this.interviewerBuffer.push(int16Data);
    }

    return true;
  }

  /**
   * 获取运行状态
   */
  getStatus(): { isRunning: boolean } {
    return { isRunning: this.isRunning };
  }
}

// 导出单例实例
export const bytedanceRecognitionService = new BytedanceRecognitionService();

