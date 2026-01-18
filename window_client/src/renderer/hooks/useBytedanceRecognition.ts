import { useRef, useCallback, useEffect } from 'react';

export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';  // pending=识别中, received=识别完成
  timestamp: number;
}

export interface UseBytedanceRecognitionResult {
  startRecognition: (onTextReceived: (message: RecognitionTextMessage) => void) => void;
  stopRecognition: () => void;
  sendAudioData: (role: 'interviewee' | 'interviewer', audioData: Int16Array) => void;
}

/**
 * 记录识别启动日志
 */
function logRecognitionStart() {
  console.log('═'.repeat(50));
  console.log('[Bytedance Recognition] 启动双流识别模式（通过 IPC）');
}

/**
 * 记录启动成功日志
 */
function logStartSuccess() {
  console.log('[Bytedance Recognition] ✓ 双流识别已启动成功');
  console.log('═'.repeat(50));
}

/**
 * 记录启动失败日志
 */
function logStartFailure(error?: string, result?: any) {
  console.error('[Bytedance Recognition] ✗ 启动识别失败');
  console.error('[Bytedance Recognition] 失败原因:', error || '未知错误');
  if (result) {
    console.error('[Bytedance Recognition] 完整响应对象:', result);
  }
  console.log('═'.repeat(50));
}

/**
 * 记录启动异常日志
 */
function logStartException(err: any) {
  console.error('[Bytedance Recognition] ✗ 启动识别异常（IPC 调用失败）:');
  console.error('[Bytedance Recognition] 异常消息:', err.message || err);
  console.error('[Bytedance Recognition] 异常堆栈:', err.stack || err);
  console.error('[Bytedance Recognition] 完整异常对象:', err);
  console.log('═'.repeat(50));
}

/**
 * 记录停止成功日志
 */
function logStopSuccess() {
  console.log('[Bytedance Recognition] ✓ 识别已停止');
}

/**
 * 记录停止失败日志
 */
function logStopFailure(error?: string) {
  console.error('[Bytedance Recognition] ✗ 停止识别失败');
  console.error('[Bytedance Recognition] 失败原因:', error || '未知错误');
}

/**
 * 记录停止异常日志
 */
function logStopException(err: any) {
  console.error('[Bytedance Recognition] ✗ 停止识别异常（IPC 调用失败）:');
  console.error('[Bytedance Recognition] 异常消息:', err.message || err);
  console.error('[Bytedance Recognition] 完整异常对象:', err);
}

/**
 * 火山引擎双流语音识别 Hook（Electron 端）
 * 
 * 通过 IPC 调用主进程的识别服务，支持自定义 WebSocket 请求头
 * 渲染进程仅负责音频数据发送和识别结果接收
 */
export function useBytedanceRecognition(): UseBytedanceRecognitionResult {
  // 文字回调引用
  const textCallbackRef = useRef<((message: RecognitionTextMessage) => void) | null>(null);
  
  // 运行状态
  const isRunningRef = useRef<boolean>(false);

  /**
   * 监听主进程发送的识别结果
   */
  useEffect(() => {
    // 注册识别结果监听器
    window.electronAPI.on.recognitionResult((message: RecognitionTextMessage) => {
      console.log(
        `[Bytedance Recognition] ${message.role === 'interviewee' ? '面试者' : '面试官'} [${message.type}]:`,
        message.text
      );

      // 调用文字回调
      if (textCallbackRef.current) {
        textCallbackRef.current(message);
      }
    });

    // 清理：移除监听器
    return () => {
      window.electronAPI.removeListener.recognitionResult();
    };
  }, []);

  /**
   * 启动双流识别
   */
  const startRecognition = useCallback(async (onTextReceived: (message: RecognitionTextMessage) => void) => {
    if (isRunningRef.current) {
      console.log('[Bytedance Recognition] 识别已在运行中');
      return;
    }

    logRecognitionStart();

    // 保存回调
    textCallbackRef.current = onTextReceived;

    try {
      // 调用主进程启动识别
      const result = await window.electronAPI.recognition.start();
      console.log('[Bytedance Recognition] 收到主进程响应:', JSON.stringify(result));
      
      if (!result.success) {
        isRunningRef.current = false;
        logStartFailure(result.error, result);
        return;
      }

      isRunningRef.current = true;
      logStartSuccess();
    } catch (err) {
      isRunningRef.current = false;
      logStartException(err);
    }
  }, []);

  /**
   * 停止识别
   */
  const stopRecognition = useCallback(async () => {
    if (!isRunningRef.current) {
      console.log('[Bytedance Recognition] 识别未在运行');
      return;
    }

    console.log('[Bytedance Recognition] 停止识别');

    // 清空回调
    textCallbackRef.current = null;

    try {
      // 调用主进程停止识别
      const result = await window.electronAPI.recognition.stop();
      console.log('[Bytedance Recognition] 收到停止响应:', JSON.stringify(result));
      
      if (!result.success) {
        logStopFailure(result.error);
        return;
      }

      isRunningRef.current = false;
      logStopSuccess();
    } catch (err) {
      logStopException(err);
    }
  }, []);

  /**
   * 发送音频数据（由音频捕获 Hook 调用）
   * 
   * 将 Int16Array 转换为普通数组通过 IPC 发送
   */
  const sendAudioData = useCallback((role: 'interviewee' | 'interviewer', audioData: Int16Array) => {
    if (!isRunningRef.current) {
      return;
    }

    // 将 Int16Array 转换为普通数组（IPC 序列化需要）
    const audioArray = Array.from(audioData);

    // 通过 IPC 发送音频数据到主进程
    window.electronAPI.recognition.sendAudio(role, audioArray)
      .catch((err) => {
        // 静默处理发送错误，避免日志刷屏
        if (err.message && !err.message.includes('not running')) {
          console.error('[Bytedance Recognition] 发送音频数据错误:', err);
        }
      });
  }, []);

  return {
    startRecognition,
    stopRecognition,
    sendAudioData
  };
}
