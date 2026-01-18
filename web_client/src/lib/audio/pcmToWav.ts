/**
 * PCM 转 WAV 工具
 * 将 PCM 音频数据转换为 WAV 格式（无需编码库）
 */

/**
 * 将字符串写入 DataView
 * @param view DataView 对象
 * @param offset 偏移量
 * @param string 要写入的字符串
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * 将 PCM 音频数据转换为 WAV Blob
 * @param pcmData Int16Array PCM 数据
 * @param sampleRate 采样率（默认 16kHz）
 * @returns WAV Blob 对象
 */
export function pcmToWav(pcmData: Int16Array, sampleRate: number = 16000): Blob {
  const numChannels = 1; // 单声道
  const bitsPerSample = 16; // 16位
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const dataSize = pcmData.length * 2; // Int16 = 2 bytes
  const fileSize = 44 + dataSize; // WAV header = 44 bytes

  console.log(`[PCM to WAV] 开始转换，样本数: ${pcmData.length}, 时长: ${(pcmData.length / sampleRate).toFixed(2)}秒`);

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // RIFF 头（12 字节）
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize - 8, true); // 文件大小 - 8
  writeString(view, 8, 'WAVE');

  // fmt 块（24 字节）
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // 音频格式 (1 = PCM)
  view.setUint16(22, numChannels, true); // 声道数
  view.setUint32(24, sampleRate, true); // 采样率
  view.setUint32(28, byteRate, true); // 字节率
  view.setUint16(32, blockAlign, true); // 块对齐
  view.setUint16(34, bitsPerSample, true); // 位深度

  // data 块头（8 字节）
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true); // 数据大小

  // 写入 PCM 数据
  const offset = 44;
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset + i * 2, pcmData[i], true);
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });

  console.log(`[PCM to WAV] 转换完成，WAV 大小: ${(blob.size / 1024).toFixed(2)} KB`);

  return blob;
}

/**
 * 将 PCM 音频数据数组转换为 WAV Blob（用于合并多个片段）
 * @param pcmDataArray Int16Array[] 数组
 * @param sampleRate 采样率（默认 16kHz）
 * @returns WAV Blob 对象
 */
export function pcmArrayToWav(pcmDataArray: Int16Array[], sampleRate: number = 16000): Blob {
  // 计算总长度
  const totalLength = pcmDataArray.reduce((sum, arr) => sum + arr.length, 0);

  // 合并所有 PCM 数据
  const mergedPcm = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of pcmDataArray) {
    mergedPcm.set(chunk, offset);
    offset += chunk.length;
  }

  // 转换为 WAV
  return pcmToWav(mergedPcm, sampleRate);
}

