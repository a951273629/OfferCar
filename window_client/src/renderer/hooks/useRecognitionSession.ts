import { useEffect, useRef, useMemo } from 'react';
import type React from 'react';
import debounce from 'lodash/debounce';
import { useRecognition } from './useRecognition';
import { useAudioCaptureForRecognition } from './useAudioCaptureForRecognition';
import type { RecognitionTextMessage } from './useRecognition';
import type { ConnectionState } from '../types/webrtc';

interface UseRecognitionSessionParams {
  connectionState: ConnectionState;
  micStream: MediaStream | null;
  systemStream: MediaStream | null;
  sendRecognitionText?: (message: RecognitionTextMessage) => void;
  sendVolumeUpdate?: (role: 'interviewee' | 'interviewer', volume: number) => void;
  onMicVolumeUpdate?: (volume: number) => void;
  onSystemVolumeUpdate?: (volume: number) => void;
}

/**
 * 创建麦克风音频回调
 */
function createMicAudioCallback(
  isMicMutedRef: React.RefObject<boolean>,
  sendAudioData: (role: 'interviewee' | 'interviewer', audioData: Int16Array) => void
): (audioData: Int16Array) => void {
  return (audioData: Int16Array) => {
    if (isMicMutedRef.current) {
      sendAudioData('interviewee', new Int16Array(0));
      return;
    }
    sendAudioData('interviewee', audioData);
  };
}

/**
 * 创建音量更新回调
 */
function createVolumeCallback(
  role: 'interviewee' | 'interviewer',
  onVolumeUpdate: ((volume: number) => void) | undefined,
  sendVolumeUpdate: ((role: 'interviewee' | 'interviewer', volume: number) => void) | undefined
): (volume: number) => void {
  return (volume: number) => {
    if (onVolumeUpdate) {
      onVolumeUpdate(volume);
    }
    if (sendVolumeUpdate) {
      sendVolumeUpdate(role, volume);
    }
  };
}

/**
 * 禁用麦克风（如果需要）
 */
function disableMicrophoneIfNeeded(
  isMicMutedRef: React.RefObject<boolean>,
  volume: number,
  volumeThreshold: number
): boolean {
  if (volume <= volumeThreshold) {
    return false;
  }

  if (isMicMutedRef.current) {
    return false;
  }

  console.log('[RecognitionSession] 系统音频播放，禁用麦克风');
  // @ts-ignore
  isMicMutedRef.current = true;
  return true;
}

/**
 * 创建系统音频音量回调
 */
function createSystemVolumeCallback(
  isMicMutedRef: React.RefObject<boolean>,
  debouncedResumeMic: (() => void) & { cancel: () => void },
  onSystemVolumeUpdate: ((volume: number) => void) | undefined,
  sendVolumeUpdate: ((role: 'interviewee' | 'interviewer', volume: number) => void) | undefined
): (volume: number) => void {
  const volumeThreshold = 5;

  return (volume: number) => {
    // 检查是否需要禁用麦克风
    const shouldDisable = disableMicrophoneIfNeeded(isMicMutedRef, volume, volumeThreshold);
    if (shouldDisable) {
      debouncedResumeMic();
    }

    // 更新音量
    if (onSystemVolumeUpdate) {
      onSystemVolumeUpdate(volume);
    }
    if (sendVolumeUpdate) {
      sendVolumeUpdate('interviewer', volume);
    }
  };
}

/**
 * 语音识别会话 Hook
 * 封装语音识别启动、停止和音频捕获逻辑
 * 
 * 遵循 React 官方最佳实践：
 * - 将 Effect 逻辑封装到自定义 Hook
 * - useEffect 仅依赖基本值
 * - 回调函数在 useEffect 内部创建
 */
export function useRecognitionSession(params: UseRecognitionSessionParams): void {
  const {
    connectionState,
    micStream,
    systemStream,
    sendRecognitionText,
    sendVolumeUpdate,
    onMicVolumeUpdate,
    onSystemVolumeUpdate
  } = params;

  const { startRecognition, stopRecognition, sendAudioData } = useRecognition();
  const {
    startMicrophoneCapture,
    startSystemAudioCapture,
    stopMicrophoneCapture,
    stopSystemAudioCapture
  } = useAudioCaptureForRecognition();

  // 麦克风禁用状态（当扬声器播放时禁用麦克风）
  const isMicMutedRef = useRef(false);

  // 创建防抖恢复函数（800ms 延迟）
  const debouncedResumeMic = useMemo(() => 
    debounce(() => {
      console.log('[RecognitionSession] 系统音频静音，恢复麦克风');
      isMicMutedRef.current = false;
    }, 800),
    []
  );

  // Effect A：仅在 WebRTC connected 时启动识别；断开时停止识别
  useEffect(() => {
    if (connectionState !== 'connected') {
      stopRecognition();
      return;
    }

    console.log('[RecognitionSession] WebRTC 已连接，启动语音识别...');

    const handleTextReceived = (message: RecognitionTextMessage) => {
      if (!sendRecognitionText) {
        return;
      }
      sendRecognitionText(message);
    };

    startRecognition(handleTextReceived);

    return () => {
      console.log('[RecognitionSession] WebRTC 断开，停止语音识别');
      stopRecognition();
    };
  }, [
    connectionState,
    sendRecognitionText,
    startRecognition,
    stopRecognition
  ]);

  // Effect B：麦克风采集（与 WebRTC 是否连接无关，用于预连接音量显示；连接后同样支持切换）
  useEffect(() => {
    // 清理掉旧的采集，避免切换设备时残留
    stopMicrophoneCapture();
    isMicMutedRef.current = false;

    if (!micStream) {
      if (onMicVolumeUpdate) {
        onMicVolumeUpdate(0);
      }
      return;
    }

    console.log('[RecognitionSession] 启动麦克风音频捕获');
    const micAudioCallback = createMicAudioCallback(isMicMutedRef as any, sendAudioData);
    const micVolumeCallback = createVolumeCallback('interviewee', onMicVolumeUpdate, sendVolumeUpdate);
    startMicrophoneCapture(micStream, micAudioCallback, micVolumeCallback);

    return () => {
      stopMicrophoneCapture();
      if (onMicVolumeUpdate) {
        onMicVolumeUpdate(0);
      }
      isMicMutedRef.current = false;
    };
  }, [
    micStream,
    startMicrophoneCapture,
    stopMicrophoneCapture,
    sendAudioData,
    onMicVolumeUpdate,
    sendVolumeUpdate
  ]);

  // Effect C：系统音频采集（与 WebRTC 是否连接无关，用于预连接音量显示；连接后同样支持切换）
  useEffect(() => {
    stopSystemAudioCapture();
    debouncedResumeMic.cancel();
    isMicMutedRef.current = false;

    if (!systemStream) {
      if (onSystemVolumeUpdate) {
        onSystemVolumeUpdate(0);
      }
      return;
    }

    console.log('[RecognitionSession] 启动系统音频捕获');
    const systemAudioCallback = (audioData: Int16Array) => sendAudioData('interviewer', audioData);
    const systemVolumeCallback = createSystemVolumeCallback(
      isMicMutedRef as any,
      debouncedResumeMic,
      onSystemVolumeUpdate,
      sendVolumeUpdate
    );
    startSystemAudioCapture(systemStream, systemAudioCallback, systemVolumeCallback);

    return () => {
      stopSystemAudioCapture();
      debouncedResumeMic.cancel();
      if (onSystemVolumeUpdate) {
        onSystemVolumeUpdate(0);
      }
      isMicMutedRef.current = false;
    };
  }, [
    systemStream,
    startSystemAudioCapture,
    stopSystemAudioCapture,
    sendAudioData,
    onSystemVolumeUpdate,
    sendVolumeUpdate,
    debouncedResumeMic
  ]);
}

