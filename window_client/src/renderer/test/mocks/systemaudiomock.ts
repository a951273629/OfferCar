/**
 * 扬声器 Mock 工具
 * 播放音频到当前选中的扬声器设备
 * 
 * 核心功能：
 * 1. 加载并播放 MP3 文件
 * 2. 支持指定输出设备（通过 setSinkId）
 * 3. 提供播放控制接口（play, pause, stop）
 * 4. 支持循环播放
 */

export interface SystemAudioMockOptions {
  audioFilePath: string;  // MP3 文件路径
  loop?: boolean;         // 是否循环播放
  outputDeviceId?: string; // 输出设备 ID（可选）
  volume?: number;        // 音量（0-1，默认 1.0）
}

export class SystemAudioMock {
  private audioElement: HTMLAudioElement | null = null;
  private isPlaying: boolean = false;
  private currentDeviceId: string | null = null;

  /**
   * 创建并播放音频到扬声器
   * 
   * @param options 配置选项
   * @returns Promise<void>
   */
  async play(options: SystemAudioMockOptions): Promise<void> {
    const { audioFilePath, loop = true, outputDeviceId, volume = 1.0 } = options;

    try {
      console.log('[SystemAudioMock] 开始播放音频到扬声器...');
      console.log('[SystemAudioMock] 音频文件:', audioFilePath);
      console.log('[SystemAudioMock] 循环播放:', loop);
      console.log('[SystemAudioMock] 输出设备:', outputDeviceId || '默认设备');

      // 停止之前的播放（如果有）
      this.stop();

      // 创建音频元素
      this.audioElement = new Audio(audioFilePath);
      this.audioElement.loop = loop;
      this.audioElement.volume = volume;

      // 设置输出设备（如果指定）
      if (outputDeviceId) {
        // 检查浏览器是否支持 setSinkId
        if ('setSinkId' in this.audioElement) {
          try {
            await (this.audioElement as any).setSinkId(outputDeviceId);
            this.currentDeviceId = outputDeviceId;
            console.log('[SystemAudioMock] ✓ 输出设备已设置:', outputDeviceId);
          } catch (error) {
            console.warn('[SystemAudioMock] 设置输出设备失败，使用默认设备:', error);
            this.currentDeviceId = null;
          }
        } else {
          console.warn('[SystemAudioMock] 浏览器不支持 setSinkId，使用默认设备');
          this.currentDeviceId = null;
        }
      }

      // 监听播放事件
      this.audioElement.onplay = () => {
        console.log('[SystemAudioMock] ✓ 音频开始播放');
        this.isPlaying = true;
      };

      this.audioElement.onpause = () => {
        console.log('[SystemAudioMock] 音频暂停');
        this.isPlaying = false;
      };

      this.audioElement.onended = () => {
        console.log('[SystemAudioMock] 音频播放结束');
        this.isPlaying = false;
      };

      this.audioElement.onerror = (error) => {
        console.error('[SystemAudioMock] 音频播放错误:', error);
        this.isPlaying = false;
      };

      this.audioElement.onloadedmetadata = () => {
        console.log('[SystemAudioMock] 音频元数据已加载:');
        console.log('  - 时长:', this.audioElement?.duration.toFixed(2), '秒');
      };

      // 开始播放
      await this.audioElement.play();
      console.log('[SystemAudioMock] ✓ 播放请求已发送');
    } catch (error) {
      console.error('[SystemAudioMock] 播放失败:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (this.audioElement && this.isPlaying) {
      this.audioElement.pause();
      console.log('[SystemAudioMock] 已暂停');
    }
  }

  /**
   * 恢复播放
   */
  resume(): void {
    if (this.audioElement && !this.isPlaying) {
      this.audioElement.play().catch((error) => {
        console.error('[SystemAudioMock] 恢复播放失败:', error);
      });
    }
  }

  /**
   * 停止播放并清理资源
   */
  stop(): void {
    if (this.audioElement) {
      console.log('[SystemAudioMock] 停止播放...');
      
      // 暂停并重置播放位置
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      
      this.cleanup();
      console.log('[SystemAudioMock] ✓ 已停止');
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.audioElement) {
      // 移除所有事件监听器
      this.audioElement.onplay = null;
      this.audioElement.onpause = null;
      this.audioElement.onended = null;
      this.audioElement.onerror = null;
      this.audioElement.onloadedmetadata = null;

      // 移除音频元素
      this.audioElement.remove();
      this.audioElement = null;
    }

    this.isPlaying = false;
    this.currentDeviceId = null;
  }

  /**
   * 获取当前播放状态
   */
  getPlayingState(): boolean {
    return this.isPlaying;
  }

  /**
   * 获取当前输出设备 ID
   */
  getCurrentDeviceId(): string | null {
    return this.currentDeviceId;
  }

  /**
   * 设置音量
   * 
   * @param volume 音量值（0-1）
   */
  setVolume(volume: number): void {
    if (this.audioElement) {
      this.audioElement.volume = Math.max(0, Math.min(1, volume));
      console.log('[SystemAudioMock] 音量已设置为:', this.audioElement.volume);
    }
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.audioElement?.volume ?? 0;
  }

  /**
   * 获取当前播放时间
   */
  getCurrentTime(): number {
    return this.audioElement?.currentTime ?? 0;
  }

  /**
   * 获取音频总时长
   */
  getDuration(): number {
    return this.audioElement?.duration ?? 0;
  }
}


