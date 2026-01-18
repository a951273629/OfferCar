import { useMemo } from 'react';
import { useBytedanceRecognition } from './useBytedanceRecognition';
import { useTencentRecognition } from './useTencentRecognition';
import { useAzureRecognition } from './useAzureRecognition';

export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';
  timestamp: number;
}

export interface UseRecognitionResult {
  startRecognition: (onTextReceived: (message: RecognitionTextMessage) => void) => void;
  stopRecognition: () => void;
  sendAudioData: (role: 'interviewee' | 'interviewer', audioData: Int16Array) => void;
}

/**
 * 统一语音识别 Hook
 * 根据环境变量 SPEECH_PROVIDER 选择语音识别服务提供商
 * - 'bytedance': 使用火山引擎大模型语音识别
 * - 'tencent': 使用腾讯云实时语音识别
 * - 'azure': 使用 Azure 语音识别
 * 
 * 默认使用火山引擎
 */
export function useRecognition(): UseRecognitionResult {
  const provider = useMemo(() => {
    const selected = process.env.SPEECH_PROVIDER || 'bytedance';
    console.log(`[Recognition] 使用语音识别服务: ${selected}`);
    return selected;
  }, []);

  // 根据 provider 选择对应的 Hook
  if (provider === 'tencent') {
    return useTencentRecognition();
  }
  
  if (provider === 'azure') {
    return useAzureRecognition();
  }
  
  // 默认使用火山引擎
  return useBytedanceRecognition();
}

