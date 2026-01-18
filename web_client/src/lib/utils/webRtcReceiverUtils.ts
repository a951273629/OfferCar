import type { 
  ExamCommandMessage, 
  RecognitionTextMessage, 
  VolumeMessage 
} from '@/types/webrtc';

/**
 * 处理缓存的 ICE 候选队列
 */
export async function processPendingIceCandidates(
  pc: RTCPeerConnection,
  pendingCandidates: RTCIceCandidateInit[]
): Promise<void> {
  if (pendingCandidates.length === 0) {
    return;
  }
  
  console.log('[WebRTC Receiver] 开始处理缓存的 ICE 候选，数量:', pendingCandidates.length);
  
  for (const [index, candidate] of pendingCandidates.entries()) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`[WebRTC Receiver] 处理缓存候选 ${index + 1}/${pendingCandidates.length}`);
    } catch (err) {
      console.error(`[WebRTC Receiver] 处理缓存候选失败 ${index + 1}:`, err);
    }
  }
  
  console.log('[WebRTC Receiver] 缓存的 ICE 候选已全部处理完成');
}

/**
 * 处理分片消息组装逻辑
 */
export function handleChunkMessage(
  message: any,
  chunkBuffer: Map<string, { chunks: string[], total: number }>,
  onComplete: (message: ExamCommandMessage) => void
): void {
  const baseType = message.type.replace('-chunk', '');
  const { id, index, total, chunk } = message.data;
  
  if (!chunkBuffer.has(id)) {
    chunkBuffer.set(id, { chunks: new Array(total), total });
    console.log(`[WebRTC Receiver] 开始接收分片: ${baseType}, 总数: ${total}`);
  }
  
  const buffer = chunkBuffer.get(id)!;
  buffer.chunks[index] = chunk;
  
  const receivedCount = buffer.chunks.filter(c => c !== undefined).length;
  
  if (receivedCount % 5 === 0 || receivedCount === total) {
    console.log(`[WebRTC Receiver] 接收进度: ${receivedCount}/${total}`);
  }
  
  if (receivedCount !== total) {
    return;
  }
  
  const fullData = buffer.chunks.join('');
  chunkBuffer.delete(id);
  
  console.log(`[WebRTC Receiver] ✓ 分片接收完成: ${baseType}, 大小: ${(fullData.length / 1024).toFixed(2)}KB`);
  
  const completeMessage: ExamCommandMessage = {
    type: baseType as any,
    data: fullData,
    timestamp: message.timestamp
  };
  
  onComplete(completeMessage);
}

/**
 * 处理完整的笔试命令消息
 */
export function handleCompleteExamMessage(
  message: ExamCommandMessage,
  callback: ((message: ExamCommandMessage) => void) | null
): void {
  console.log('[WebRTC Receiver] 收到笔试命令:', message.type);
  
  if (!callback) {
    return;
  }
  
  callback(message);
}

/**
 * 处理音量消息
 */
export function handleVolumeMessage(
  volumeMsg: VolumeMessage,
  setMicrophoneVolume: (volume: number) => void,
  setSystemAudioVolume: (volume: number) => void
): void {
  if (volumeMsg.role === 'interviewee') {
    setMicrophoneVolume(volumeMsg.volume);
  } else {
    setSystemAudioVolume(volumeMsg.volume);
  }
}

/**
 * 处理文字消息
 */
export function handleTextMessage(
  textMsg: RecognitionTextMessage,
  callback: ((message: RecognitionTextMessage) => void) | null
): void {
  if (!callback) {
    return;
  }
  
  callback(textMsg);
}

