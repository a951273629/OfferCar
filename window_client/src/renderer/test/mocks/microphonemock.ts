/**
 * 麦克风 Mock 工具
 * 创建虚拟麦克风 MediaStream，可传递给 useAudioCapture 测试
 * 
 * 核心功能：
 * 1. 加载 MP3 文件到 AudioBuffer
 * 2. 使用 MediaStreamAudioDestinationNode 创建虚拟流
 * 3. 支持循环播放和停止控制
 * 4. 采样率匹配 useAudioCapture（16kHz）
 */

export interface MicrophoneMockOptions {
  audioFilePath: string;  // MP3 文件路径
  loop?: boolean;         // 是否循环播放
  sampleRate?: number;    // 采样率（默认 16000，匹配 useAudioCapture）
}

export class MicrophoneMock {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  private stream: MediaStream | null = null;
  private isPlaying: boolean = false;

  /**
   * 创建虚拟麦克风流
   * 
   * @param options 配置选项
   * @returns Promise<MediaStream> 虚拟麦克风流
   */
  async createMockStream(options: MicrophoneMockOptions): Promise<MediaStream> {
    const { audioFilePath, loop = true, sampleRate = 16000 } = options;

    try {
      console.log('[MicrophoneMock] 开始创建虚拟麦克风流...');
      console.log('[MicrophoneMock] 音频文件:', audioFilePath);
      console.log('[MicrophoneMock] 采样率:', sampleRate);

      // 创建 AudioContext（匹配 useAudioCapture 的采样率）
      this.audioContext = new AudioContext({ sampleRate });

      // 加载音频文件
      const response = await fetch(audioFilePath);
      if (!response.ok) {
        throw new Error(`加载音频文件失败: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      console.log('[MicrophoneMock] 音频文件已加载，大小:', (arrayBuffer.byteLength / 1024).toFixed(2), 'KB');

      // 解码音频数据
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      console.log('[MicrophoneMock] 音频解码成功:');
      console.log('  - 时长:', audioBuffer.duration.toFixed(2), '秒');
      console.log('  - 采样率:', audioBuffer.sampleRate, 'Hz');
      console.log('  - 通道数:', audioBuffer.numberOfChannels);

      // 创建音频源节点
      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = audioBuffer;
      this.sourceNode.loop = loop;

      // 创建 MediaStream 目标节点（虚拟流输出）
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // 连接音频节点
      this.sourceNode.connect(this.destinationNode);

      // 启动播放
      this.sourceNode.start();
      this.isPlaying = true;

      // 监听播放结束（仅在非循环模式下）
      if (!loop) {
        this.sourceNode.onended = () => {
          console.log('[MicrophoneMock] 音频播放结束');
          this.isPlaying = false;
        };
      }

      // 获取虚拟流
      this.stream = this.destinationNode.stream;

      console.log('[MicrophoneMock] ✓ 虚拟麦克风流创建成功');
      console.log('[MicrophoneMock] Stream ID:', this.stream.id);
      console.log('[MicrophoneMock] 音频轨道数:', this.stream.getAudioTracks().length);

      return this.stream;
    } catch (error) {
      console.error('[MicrophoneMock] 创建虚拟流失败:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 停止播放并清理资源
   */
  stop(): void {
    console.log('[MicrophoneMock] 停止虚拟麦克风流...');

    if (this.sourceNode && this.isPlaying) {
      try {
        this.sourceNode.stop();
      } catch (error) {
        // sourceNode.stop() 可能已经被调用过
        console.warn('[MicrophoneMock] sourceNode.stop() 失败（可能已停止）:', error);
      }
      this.isPlaying = false;
    }

    this.cleanup();
    console.log('[MicrophoneMock] ✓ 已停止');
  }

  /**
   * 清理所有资源
   */
  private cleanup(): void {
    // 断开节点连接
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.destinationNode) {
      this.destinationNode.disconnect();
      this.destinationNode = null;
    }

    // 关闭音频上下文
    if (this.audioContext) {
      this.audioContext.close().catch((error) => {
        console.warn('[MicrophoneMock] AudioContext 关闭失败:', error);
      });
      this.audioContext = null;
    }

    // 停止所有音频轨道
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
  }

  /**
   * 获取当前播放状态
   */
  getPlayingState(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取当前流
   */
  getStream(): MediaStream | null {
    return this.stream;
  }
}


