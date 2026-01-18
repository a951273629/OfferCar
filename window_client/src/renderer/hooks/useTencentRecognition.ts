import { useRef, useCallback } from 'react';
import type WebSocket from 'ws';
import {
  createTencentWebSocket,
  type TencentRecognitionResult,
} from '../lib/tencentSpeech';

export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';
  timestamp: number;
}

export interface UseTencentRecognitionResult {
  startRecognition: (onTextReceived: (message: RecognitionTextMessage) => void) => void;
  stopRecognition: () => void;
  sendAudioData: (role: 'interviewee' | 'interviewer', audioData: Int16Array) => void;
}

/**
 * 腾讯云双流语音识别 Hook（Electron 端）
 */
export function useTencentRecognition(): UseTencentRecognitionResult {
  const intervieweeWsRef = useRef<WebSocket | null>(null);
  const interviewerWsRef = useRef<WebSocket | null>(null);

  const intervieweeSendTimerRef = useRef<NodeJS.Timeout | null>(null);
  const interviewerSendTimerRef = useRef<NodeJS.Timeout | null>(null);

  const intervieweeBufferRef = useRef<Int16Array[]>([]);
  const interviewerBufferRef = useRef<Int16Array[]>([]);

  const textCallbackRef = useRef<((message: RecognitionTextMessage) => void) | null>(null);

  /**
   * 创建 WebSocket 并处理识别结果
   */
  const createWebSocketConnection = (role: 'interviewee' | 'interviewer'): WebSocket => {
    console.log(`[Tencent Recognition] 创建 ${role === 'interviewee' ? '面试者' : '面试官'} WebSocket...`);

    const ws = createTencentWebSocket();

    // 连接打开
    ws.on('open', () => {
      console.log(`[Tencent Recognition] ${role === 'interviewee' ? '🎤 面试者' : '👔 面试官'} WebSocket 已连接`);
    });

    // 接收消息
    ws.on('message', (data: Buffer) => {
      try {
        const result: TencentRecognitionResult = JSON.parse(data.toString());

        // 检查错误
        if (result.code !== 0) {
          console.error(`[Tencent Recognition] ${role} 识别错误 [${result.code}]:`, result.message);
          return;
        }

        // 处理识别结果
        if (result.result && result.result.voice_text_str) {
          const text = result.result.voice_text_str.trim();

          if (text && textCallbackRef.current) {
            // slice_type: 0=开始, 1=中间, 2=结束
            const type = result.result.slice_type === 2 ? 'recognized' : 'recognizing';
            const status = result.result.slice_type === 2 ? 'received' : 'pending';

            console.log(
              `[Tencent Recognition] ${role === 'interviewee' ? '🎤' : '👔'} [${type}] [${status}]:`,
              text
            );

            textCallbackRef.current({
              role,
              text,
              type,
              status,
              timestamp: Date.now()
            });
          }
        }

        // 识别完成
        if (result.final === 1) {
          console.log(`[Tencent Recognition] ${role} 识别完成`);
        }
      } catch (err) {
        console.error(`[Tencent Recognition] ${role} 解析消息失败:`, err);
      }
    });

    // 连接关闭
    ws.on('close', (code, reason) => {
      console.log(
        `[Tencent Recognition] ${role === 'interviewee' ? '🎤 面试者' : '👔 面试官'} WebSocket 已关闭`,
        `code: ${code}, reason: ${reason.toString()}`
      );
    });

    // 连接错误
    ws.on('error', (error) => {
      console.error(`[Tencent Recognition] ${role} WebSocket 错误:`, error.message);
    });

    return ws;
  };

  /**
   * 启动发送定时器
   */
  const startSendTimer = (
    role: 'interviewee' | 'interviewer',
    ws: WebSocket,
    bufferRef: React.MutableRefObject<Int16Array[]>,
    timerRef: React.MutableRefObject<NodeJS.Timeout | null>
  ) => {
    // 静音数据包（16kHz, 40ms = 640 样本）
    const silencePacket = new Int16Array(640).fill(0);

    // 每 40ms 发送一次
    timerRef.current = setInterval(() => {
      if (bufferRef.current.length > 0) {
        // 合并缓冲的数据
        const totalLength = bufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
        const mergedData = new Int16Array(totalLength);
        let offset = 0;

        for (const chunk of bufferRef.current) {
          mergedData.set(chunk, offset);
          offset += chunk.length;
        }

        // 发送真实音频数据
        if (ws.readyState === 1) {
          const audioBytes = Buffer.from(mergedData.buffer);
          ws.send(audioBytes);
        }

        // 清空缓冲区
        bufferRef.current = [];
      } else {
        // 发送静音数据包保持连接
        if (ws.readyState === 1) {
          const audioBytes = Buffer.from(silencePacket.buffer);
          ws.send(audioBytes);
        }
      }
    }, 40); // 40ms
  };

  /**
   * 启动双流识别
   */
  const startRecognition = useCallback((onTextReceived: (message: RecognitionTextMessage) => void) => {
    console.log('═'.repeat(50));
    console.log('[Tencent Recognition] 🎙️ 启动双流识别模式（Electron 端）');

    textCallbackRef.current = onTextReceived;

    // 创建面试者 WebSocket
    const intervieweeWs = createWebSocketConnection('interviewee');
    intervieweeWsRef.current = intervieweeWs;

    // 创建面试官 WebSocket
    const interviewerWs = createWebSocketConnection('interviewer');
    interviewerWsRef.current = interviewerWs;

    // 等待连接打开后启动定时器
    intervieweeWs.on('open', () => {
      console.log('[Tencent Recognition] 🎤 面试者定时器已启动');
      startSendTimer('interviewee', intervieweeWs, intervieweeBufferRef, intervieweeSendTimerRef);
    });

    interviewerWs.on('open', () => {
      console.log('[Tencent Recognition] 👔 面试官定时器已启动');
      startSendTimer('interviewer', interviewerWs, interviewerBufferRef, interviewerSendTimerRef);
      
      console.log('═'.repeat(50));
      console.log('[Tencent Recognition] ✅ 双流识别已全部启动');
      console.log('═'.repeat(50));
    });
  }, []);

  /**
   * 停止识别
   */
  const stopRecognition = useCallback(() => {
    console.log('[Tencent Recognition] 停止识别');

    // 停止定时器
    if (intervieweeSendTimerRef.current) {
      clearInterval(intervieweeSendTimerRef.current);
      intervieweeSendTimerRef.current = null;
    }

    if (interviewerSendTimerRef.current) {
      clearInterval(interviewerSendTimerRef.current);
      interviewerSendTimerRef.current = null;
    }

    // 发送结束消息并关闭
    if (intervieweeWsRef.current && intervieweeWsRef.current.readyState === 1) {
      intervieweeWsRef.current.send(JSON.stringify({ type: 'end' }));
      intervieweeWsRef.current.close();
      intervieweeWsRef.current = null;
    }

    if (interviewerWsRef.current && interviewerWsRef.current.readyState === 1) {
      interviewerWsRef.current.send(JSON.stringify({ type: 'end' }));
      interviewerWsRef.current.close();
      interviewerWsRef.current = null;
    }

    // 清空缓冲区
    intervieweeBufferRef.current = [];
    interviewerBufferRef.current = [];

    textCallbackRef.current = null;
  }, []);

  /**
   * 发送音频数据
   */
  const sendAudioData = useCallback((role: 'interviewee' | 'interviewer', audioData: Int16Array) => {
    if (role === 'interviewee') {
      intervieweeBufferRef.current.push(audioData);
    } else {
      interviewerBufferRef.current.push(audioData);
    }
  }, []);

  return {
    startRecognition,
    stopRecognition,
    sendAudioData
  };
}

