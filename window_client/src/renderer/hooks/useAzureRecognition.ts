import { useRef, useCallback } from 'react';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import {
  getAzureSpeechConfig,
  createPushAudioInputStream,
} from '../lib/azureSpeech';

export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';
  timestamp: number;
}

export interface UseAzureRecognitionResult {
  startRecognition: (onTextReceived: (message: RecognitionTextMessage) => void) => void;
  stopRecognition: () => void;
  sendAudioData: (role: 'interviewee' | 'interviewer', audioData: Int16Array) => void;
}

/**
 * Azure 双流语音识别 Hook（Electron 端）
 */
export function useAzureRecognition(): UseAzureRecognitionResult {
  const intervieweeRecognizerRef = useRef<sdk.SpeechRecognizer | null>(null);
  const interviewerRecognizerRef = useRef<sdk.SpeechRecognizer | null>(null);

  const intervieweePushStreamRef = useRef<sdk.PushAudioInputStream | null>(null);
  const interviewerPushStreamRef = useRef<sdk.PushAudioInputStream | null>(null);

  const textCallbackRef = useRef<((message: RecognitionTextMessage) => void) | null>(null);

  /**
   * 创建识别器
   */
  const createRecognizer = (
    role: 'interviewee' | 'interviewer'
  ): sdk.SpeechRecognizer => {
    console.log(`[Azure Recognition] 创建 ${role === 'interviewee' ? '面试者' : '面试官'} 识别器...`);

    const speechConfig = getAzureSpeechConfig();
    const pushStream = createPushAudioInputStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    // 保存 PushStream 引用
    if (role === 'interviewee') {
      intervieweePushStreamRef.current = pushStream;
    } else {
      interviewerPushStreamRef.current = pushStream;
    }

    // 识别中事件
    recognizer.recognizing = (_s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizingSpeech && e.result.text && textCallbackRef.current) {
        console.log(`[Azure Recognition] ${role === 'interviewee' ? '🎤' : '👔'} [recognizing] [pending]:`, e.result.text);
        
        textCallbackRef.current({
          role,
          text: e.result.text,
          type: 'recognizing',
          status: 'pending',
          timestamp: Date.now()
        });
      }
    };

    // 识别完成事件
    recognizer.recognized = (_s, e) => {
      if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text && textCallbackRef.current) {
        console.log(`[Azure Recognition] ${role === 'interviewee' ? '🎤' : '👔'} [recognized] [received]:`, e.result.text);
        
        textCallbackRef.current({
          role,
          text: e.result.text,
          type: 'recognized',
          status: 'received',
          timestamp: Date.now()
        });
      }
    };

    // 取消事件
    recognizer.canceled = (_s, e) => {
      console.error(`[Azure Recognition] ${role} 识别取消:`, sdk.CancellationReason[e.reason]);
      if (e.errorDetails) {
        console.error('[Azure Recognition] 错误详情:', e.errorDetails);
      }
    };

    return recognizer;
  };

  /**
   * 启动双流识别
   */
  const startRecognition = useCallback((onTextReceived: (message: RecognitionTextMessage) => void) => {
    console.log('═'.repeat(50));
    console.log('[Azure Recognition] 🎙️ 启动双流识别模式（Electron 端）');

    textCallbackRef.current = onTextReceived;

    // 创建面试者识别器
    const intervieweeRecognizer = createRecognizer('interviewee');
    intervieweeRecognizerRef.current = intervieweeRecognizer;
    intervieweeRecognizer.startContinuousRecognitionAsync(
      () => {
        console.log('[Azure Recognition] 🎤 面试者识别器已启动');
      },
      (error) => {
        console.error('[Azure Recognition] 面试者识别器启动失败:', error);
      }
    );

    // 创建面试官识别器
    const interviewerRecognizer = createRecognizer('interviewer');
    interviewerRecognizerRef.current = interviewerRecognizer;
    interviewerRecognizer.startContinuousRecognitionAsync(
      () => {
        console.log('[Azure Recognition] 👔 面试官识别器已启动');
        console.log('═'.repeat(50));
        console.log('[Azure Recognition] ✅ 双流识别已全部启动');
        console.log('═'.repeat(50));
      },
      (error) => {
        console.error('[Azure Recognition] 面试官识别器启动失败:', error);
      }
    );
  }, []);

  /**
   * 停止识别
   */
  const stopRecognition = useCallback(() => {
    console.log('[Azure Recognition] 停止识别');

    // 停止面试者识别器
    if (intervieweeRecognizerRef.current) {
      intervieweeRecognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          if (intervieweeRecognizerRef.current) {
            intervieweeRecognizerRef.current.close();
            intervieweeRecognizerRef.current = null;
          }
          if (intervieweePushStreamRef.current) {
            intervieweePushStreamRef.current.close();
            intervieweePushStreamRef.current = null;
          }
        },
        (error) => {
          console.error('[Azure Recognition] 面试者识别器停止失败:', error);
        }
      );
    }

    // 停止面试官识别器
    if (interviewerRecognizerRef.current) {
      interviewerRecognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          if (interviewerRecognizerRef.current) {
            interviewerRecognizerRef.current.close();
            interviewerRecognizerRef.current = null;
          }
          if (interviewerPushStreamRef.current) {
            interviewerPushStreamRef.current.close();
            interviewerPushStreamRef.current = null;
          }
        },
        (error) => {
          console.error('[Azure Recognition] 面试官识别器停止失败:', error);
        }
      );
    }

    textCallbackRef.current = null;
  }, []);

  /**
   * 发送音频数据
   */
  const sendAudioData = useCallback((role: 'interviewee' | 'interviewer', audioData: Int16Array) => {
    const pushStream = role === 'interviewee' 
      ? intervieweePushStreamRef.current 
      : interviewerPushStreamRef.current;

    if (pushStream) {
      // 将 Int16Array 转为 ArrayBuffer 并推送
      const buffer = Buffer.from(audioData.buffer);
      pushStream.write(buffer.buffer as ArrayBuffer);
    }
  }, []);

  return {
    startRecognition,
    stopRecognition,
    sendAudioData
  };
}

