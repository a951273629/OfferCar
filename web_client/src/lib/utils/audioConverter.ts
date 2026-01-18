/**
 * 音频格式转换工具
 * 使用 Web Audio API 将任意音频格式转换为 Azure Speech SDK 支持的 PCM WAV
 */

/**
 * 将任意音频格式（MP3、OGG 等）转换为 PCM WAV
 * @param audioBuffer 原始音频数据（ArrayBuffer）
 * @param targetSampleRate 目标采样率（默认 16000Hz，Azure 推荐）
 * @returns WAV 格式的 ArrayBuffer
 */
export async function convertToPCMWav(
  audioBuffer: ArrayBuffer,
  targetSampleRate: number = 16000
): Promise<ArrayBuffer> {
  try {
    console.log('[Audio Converter] 开始转换音频格式...');
    console.log('[Audio Converter] 原始音频大小:', audioBuffer.byteLength, 'bytes');

    // 1. 创建 AudioContext
    const audioContext = new AudioContext();

    // 2. 解码音频数据（支持 MP3、OGG 等格式）
    const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
    
    console.log('[Audio Converter] 音频解码成功');
    console.log('  原始采样率:', decodedAudio.sampleRate, 'Hz');
    console.log('  声道数:', decodedAudio.numberOfChannels);
    console.log('  时长:', decodedAudio.duration.toFixed(2), '秒');

    // 3. 重采样到目标采样率（如果需要）
    let audioBufferToConvert = decodedAudio;
    
    if (decodedAudio.sampleRate !== targetSampleRate) {
      console.log('[Audio Converter] 重采样到', targetSampleRate, 'Hz...');
      audioBufferToConvert = await resampleAudio(decodedAudio, targetSampleRate);
    }

    // 4. 转换为单声道（如果是立体声）
    const channelData = audioBufferToConvert.numberOfChannels > 1
      ? mixToMono(audioBufferToConvert)
      : audioBufferToConvert.getChannelData(0);

    console.log('[Audio Converter] PCM 样本数:', channelData.length);

    // 5. 转换为 16-bit PCM
    const pcm16Data = floatTo16BitPCM(channelData);

    // 6. 创建 WAV 文件
    const wavBuffer = createWavFile(pcm16Data, targetSampleRate);

    console.log('[Audio Converter] 转换完成，WAV 大小:', wavBuffer.byteLength, 'bytes');

    // 关闭 AudioContext
    await audioContext.close();

    return wavBuffer;
  } catch (error) {
    console.error('[Audio Converter] 转换失败:', error);
    throw new Error(`音频格式转换失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 重采样音频到目标采样率
 */
async function resampleAudio(
  audioBuffer: AudioBuffer,
  targetSampleRate: number
): Promise<AudioBuffer> {
  const offlineContext = new OfflineAudioContext(
    1,  // 单声道
    audioBuffer.duration * targetSampleRate,
    targetSampleRate
  );

  const source = offlineContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineContext.destination);
  source.start();

  return await offlineContext.startRendering();
}

/**
 * 混合多声道音频为单声道
 */
function mixToMono(audioBuffer: AudioBuffer): Float32Array {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const monoData = new Float32Array(length);

  // 将所有声道混合为单声道
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i];
    }
    monoData[i] = sum / numberOfChannels;
  }

  return monoData;
}

/**
 * 将 Float32Array 转换为 16-bit PCM
 */
function floatTo16BitPCM(float32Array: Float32Array): Int16Array {
  const int16Array = new Int16Array(float32Array.length);
  
  for (let i = 0; i < float32Array.length; i++) {
    // 限制范围在 [-1, 1]
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    // 转换为 16-bit 整数 [-32768, 32767]
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return int16Array;
}

/**
 * 创建 WAV 文件（包含文件头）
 */
function createWavFile(pcmData: Int16Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;  // 单声道
  const bitsPerSample = 16;  // 16-bit
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length * bytesPerSample;
  const bufferSize = 44 + dataSize;  // WAV 头 44 字节 + 数据

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // 写入 WAV 文件头
  let offset = 0;

  // RIFF 标识符
  writeString(view, offset, 'RIFF'); offset += 4;
  // 文件大小（不含前 8 字节）
  view.setUint32(offset, bufferSize - 8, true); offset += 4;
  // WAVE 标识符
  writeString(view, offset, 'WAVE'); offset += 4;

  // fmt 子块
  writeString(view, offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;  // fmt 块大小
  view.setUint16(offset, 1, true); offset += 2;   // 音频格式（1 = PCM）
  view.setUint16(offset, numChannels, true); offset += 2;  // 声道数
  view.setUint32(offset, sampleRate, true); offset += 4;   // 采样率
  view.setUint32(offset, byteRate, true); offset += 4;     // 字节率
  view.setUint16(offset, blockAlign, true); offset += 2;   // 块对齐
  view.setUint16(offset, bitsPerSample, true); offset += 2; // 位深度

  // data 子块
  writeString(view, offset, 'data'); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // 写入 PCM 数据
  for (let i = 0; i < pcmData.length; i++) {
    view.setInt16(offset, pcmData[i], true);
    offset += 2;
  }

  return buffer;
}

/**
 * 写入字符串到 DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * 验证音频格式是否为 WAV
 */
export function isWavFormat(arrayBuffer: ArrayBuffer): boolean {
  const view = new DataView(arrayBuffer);
  
  // 检查 RIFF 标识符
  const riff = String.fromCharCode(
    view.getUint8(0),
    view.getUint8(1),
    view.getUint8(2),
    view.getUint8(3)
  );
  
  // 检查 WAVE 标识符
  const wave = String.fromCharCode(
    view.getUint8(8),
    view.getUint8(9),
    view.getUint8(10),
    view.getUint8(11)
  );
  
  return riff === 'RIFF' && wave === 'WAVE';
}

