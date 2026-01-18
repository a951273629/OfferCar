// DataChannel 数据传输工具

// 分片配置常量
export const CHUNK_THRESHOLD = 200 * 1024;  // 200KB
export const CHUNK_SIZE = 100 * 1024;       // 100KB
export const MAX_BUFFERED_AMOUNT = 64 * 1024; // 64KB

/**
 * 生成唯一分片 ID
 */
export function generateChunkId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 计算字符串字节大小
 */
export function getStringByteSize(str: string): number {
  return new Blob([str]).size;
}

/**
 * 分片发送大数据
 * @param type 消息类型
 * @param data 数据内容
 * @param channel RTCDataChannel 实例
 */
export async function sendLargeData(
  type: string,
  data: string,
  channel: RTCDataChannel
): Promise<void> {
  const dataSize = getStringByteSize(data);
  
  if (dataSize <= CHUNK_THRESHOLD) {
    // 小数据直接发送
    const message = { type, data, timestamp: Date.now() };
    channel.send(JSON.stringify(message));
    console.log(`[DataChannel] 发送命令: ${type}, 大小: ${(dataSize / 1024).toFixed(2)}KB`);
    return;
  }
  
  // 大数据分片发送
  console.log(`[DataChannel] 数据过大 (${(dataSize / 1024).toFixed(2)}KB)，开始分片发送...`);
  
  const chunkId = generateChunkId();
  const chunks = [];
  
  // 分割数据
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.substring(i, i + CHUNK_SIZE));
  }
  
  console.log(`[DataChannel] 总分片数: ${chunks.length}, 每片约 ${(CHUNK_SIZE / 1024).toFixed(0)}KB`);
  
  // 逐片发送
  for (let i = 0; i < chunks.length; i++) {
    // 等待缓冲区清空
    while (channel.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    const chunkMessage = {
      type: `${type}-chunk`,
      data: {
        id: chunkId,
        index: i,
        total: chunks.length,
        chunk: chunks[i]
      },
      timestamp: Date.now()
    };
    
    channel.send(JSON.stringify(chunkMessage));
    
    if ((i + 1) % 5 === 0 || i === chunks.length - 1) {
      console.log(`[DataChannel] 进度: ${i + 1}/${chunks.length}`);
    }
  }
  
  console.log(`[DataChannel] 分片发送完成: ${type}`);
}

