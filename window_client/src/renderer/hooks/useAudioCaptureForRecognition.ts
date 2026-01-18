import { useRef, useCallback } from 'react';

interface UseAudioCaptureForRecognitionResult {
  startMicrophoneCapture: (
    stream: MediaStream,
    onAudioData: (data: Int16Array) => void,
    onVolumeUpdate?: (volume: number) => void
  ) => void;
  startSystemAudioCapture: (
    stream: MediaStream,
    onAudioData: (data: Int16Array) => void,
    onVolumeUpdate?: (volume: number) => void
  ) => void;
  stopMicrophoneCapture: () => void;
  stopSystemAudioCapture: () => void;
}

interface AudioCaptureContext {
  context: AudioContext | null;
  processor: ScriptProcessorNode | null;
}

/**
 * 将 Float32Array 转换为 Int16Array
 */
function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return int16Array;
}

/**
 * 音频捕获 Hook（用于语音识别）
 * 捕获音频数据并通过回调函数传递，用于火山引擎语音识别
 */
export function useAudioCaptureForRecognition(): UseAudioCaptureForRecognitionResult {
  const micCaptureRef = useRef<AudioCaptureContext>({ context: null, processor: null });
  const systemCaptureRef = useRef<AudioCaptureContext>({ context: null, processor: null });

  // 启动麦克风音频捕获
  const startMicrophoneCapture = useCallback((
    stream: MediaStream,
    onAudioData: (data: Int16Array) => void,
    onVolumeUpdate?: (volume: number) => void
  ) => {
    try {
      console.log('[AudioCaptureForRecognition] 启动麦克风音频捕获...');
      
      // 创建 AudioContext（16kHz 采样率）
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const float32Data = e.inputBuffer.getChannelData(0);
        
        // 计算 RMS 音量
        if (onVolumeUpdate) {
          const rms = Math.sqrt(
            Array.from(float32Data).reduce((sum, val) => sum + val * val, 0) / float32Data.length
          );
          const volume = Math.min(100, Math.round(rms * 300));
          onVolumeUpdate(volume);
        }
        
        // 转换为 Int16Array
        const int16Data = float32ToInt16(float32Data);
        
        // 通过回调传递数据
        onAudioData(int16Data);
      };
      
      // 连接音频节点
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // 保存到引用
      micCaptureRef.current = { context: audioContext, processor };
      
      console.log('[AudioCaptureForRecognition] ✓ 麦克风音频捕获已启动');
    } catch (error) {
      console.error('[AudioCaptureForRecognition] 麦克风音频捕获失败:', error);
    }
  }, []);

  // 启动系统音频捕获
  const startSystemAudioCapture = useCallback((
    stream: MediaStream,
    onAudioData: (data: Int16Array) => void,
    onVolumeUpdate?: (volume: number) => void
  ) => {
    try {
      console.log('[AudioCaptureForRecognition] 启动系统音频捕获...');
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      
      processor.onaudioprocess = (e: AudioProcessingEvent) => {
        const float32Data = e.inputBuffer.getChannelData(0);
        
        // 计算 RMS 音量
        if (onVolumeUpdate) {
          const rms = Math.sqrt(
            Array.from(float32Data).reduce((sum, val) => sum + val * val, 0) / float32Data.length
          );
          const volume = Math.min(100, Math.round(rms * 300));
          onVolumeUpdate(volume);
        }
        
        // 转换为 Int16Array
        const int16Data = float32ToInt16(float32Data);
        
        // 通过回调传递数据
        onAudioData(int16Data);
      };
      
      // 连接音频节点
      source.connect(processor);
      processor.connect(audioContext.destination);
      
      // 保存到引用
      systemCaptureRef.current = { context: audioContext, processor };
      
      console.log('[AudioCaptureForRecognition] ✓ 系统音频捕获已启动');
    } catch (error) {
      console.error('[AudioCaptureForRecognition] 系统音频捕获失败:', error);
    }
  }, []);

  // 停止麦克风音频捕获
  const stopMicrophoneCapture = useCallback(() => {
    const { context, processor } = micCaptureRef.current;
    
    if (processor) {
      processor.disconnect();
      micCaptureRef.current.processor = null;
    }
    
    if (context) {
      context.close().catch(() => {});
      micCaptureRef.current.context = null;
    }
    
    console.log('[AudioCaptureForRecognition] 麦克风音频捕获已停止');
  }, []);

  // 停止系统音频捕获
  const stopSystemAudioCapture = useCallback(() => {
    const { context, processor } = systemCaptureRef.current;
    
    if (processor) {
      processor.disconnect();
      systemCaptureRef.current.processor = null;
    }
    
    if (context) {
      context.close().catch(() => {});
      systemCaptureRef.current.context = null;
    }
    
    console.log('[AudioCaptureForRecognition] 系统音频捕获已停止');
  }, []);

  return {
    startMicrophoneCapture,
    startSystemAudioCapture,
    stopMicrophoneCapture,
    stopSystemAudioCapture
  };
}

