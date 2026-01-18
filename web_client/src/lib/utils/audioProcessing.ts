/**
 * 音频数据处理工具函数
 * 用于 Web Audio API 音频流处理
 */

/**
 * 音频处理器资源接口
 */
export interface AudioProcessorResources {
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  processor: ScriptProcessorNode;
}

/**
 * 将 Float32Array 转换为 Int16Array
 * Float32 范围: -1.0 ~ 1.0
 * Int16 范围: -32768 ~ 32767
 * 
 * @param float32Array 输入的 Float32 音频数据
 * @returns 转换后的 Int16 音频数据
 */
export function float32ToInt16(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    // 限制在 [-1, 1] 范围内
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // 转换为 Int16 范围
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return int16Array;
}

/**
 * 创建音频处理器（可选的工厂函数）
 * 
 * @param stream MediaStream 音频流
 * @param onAudioData 音频数据回调函数
 * @param sampleRate 采样率（默认 16000Hz，Azure 推荐）
 * @returns 音频处理器资源对象
 */
export function createAudioProcessor(
  stream: MediaStream,
  onAudioData: (pcmData: Int16Array) => void,
  sampleRate: number = 16000
): AudioProcessorResources {
  // 创建 AudioContext
  const audioContext = new AudioContext({ sampleRate });
  
  // 创建媒体流源
  const source = audioContext.createMediaStreamSource(stream);
  
  // 创建音频处理器节点（4096 samples ≈ 256ms @ 16kHz）
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  
  // 音频数据处理
  processor.onaudioprocess = (e: AudioProcessingEvent) => {
    const float32Data = e.inputBuffer.getChannelData(0);
    const int16Data = float32ToInt16(float32Data);
    onAudioData(int16Data);
  };
  
  // 连接音频节点
  source.connect(processor);
  processor.connect(audioContext.destination);
  
  return { audioContext, source, processor };
}

/**
 * 停止并清理音频处理器资源
 * 
 * @param resources 音频处理器资源对象
 */
export function stopAudioProcessor(resources: AudioProcessorResources): void {
  try {
    resources.processor.disconnect();
    resources.source.disconnect();
    resources.audioContext.close();
  } catch (error) {
    console.error('[Audio Processing] 清理资源失败:', error);
  }
}

