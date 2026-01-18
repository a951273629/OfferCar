/**
 * 语音活动检测器（Voice Activity Detector）
 * 用于智能判断是否应该发送音频数据
 * 
 * 核心功能：
 * 1. 基于音量阈值判断说话状态
 * 2. 跨通道音量比较（面试官 vs 面试者）
 * 3. 先说话优先策略（避免同时说话时的冲突）
 * 4. 智能状态转换（带延迟缓冲，避免频繁切换）
 */

export interface VoiceActivityOptions {
  volumeThreshold: number;    // 音量阈值（0.06 = 6%）
  silenceDuration: number;     // 静音持续时长（ms），用于 SPEAKING → SILENT
  activationDelay: number;     // 激活延迟（ms），用于 SILENT → SPEAKING
}

export type VoiceActivityState = 'SILENT' | 'SPEAKING';

export class VoiceActivityDetector {
  private state: VoiceActivityState = 'SILENT';
  private options: VoiceActivityOptions;
  
  // 状态转换时间戳
  private silenceStartTime: number = 0;
  private speakingStartTime: number = 0;
  
  // 标识符（用于日志）
  private identifier: string;
  
  // 上次日志输出时间
  private lastLogTime: number = 0;
  
  constructor(options: VoiceActivityOptions, identifier: string = 'VAD') {
    this.options = options;
    this.identifier = identifier;
  }
  
  /**
   * 检测语音活动
   * 
   * @param myVolume 本方当前音量（RMS，范围 0-1）
   * @param otherVolume 对方当前音量（RMS，范围 0-1）
   * @param otherIsSpeaking 对方是否正在说话
   * @returns 是否应该发送音频数据
   */
  detectActivity(
    myVolume: number,
    otherVolume: number,
    otherIsSpeaking: boolean
  ): boolean {
    const now = Date.now();
    
    // 条件检查
    const myAboveThreshold = myVolume > this.options.volumeThreshold;
    const otherAboveThreshold = otherVolume > this.options.volumeThreshold;
    
    // 暂停条件（两个条件同时满足）：
    // 1. 对方音量 > 阈值
    // 2. 本方音量 < 对方音量 且 本方音量 < 阈值
    const shouldPause = 
      otherAboveThreshold && 
      myVolume < otherVolume && 
      myVolume < this.options.volumeThreshold;
    
    if (shouldPause) {
      // 强制进入静音状态（对方在说话，本方应该暂停）
      if (this.state === 'SPEAKING') {
        console.log(
          `[VAD] ${this.identifier} SPEAKING → SILENT (对方说话优先, ` +
          `本方音量=${(myVolume * 100).toFixed(1)}%, ` +
          `对方音量=${(otherVolume * 100).toFixed(1)}%)`
        );
      }
      this.state = 'SILENT';
      this.silenceStartTime = 0;
      this.speakingStartTime = 0;
      return false;
    }
    
    // 状态机转换
    if (this.state === 'SILENT') {
      // 当前静音状态，检查是否应该激活
      if (myAboveThreshold) {
        // 本方音量超过阈值
        
        // 检查对方是否先说话（先说话优先策略）
        if (otherIsSpeaking) {
          // 对方已在说话，本方不能激活
          this.speakingStartTime = 0;
          return false;
        }
        
        // 激活延迟检查（避免短暂噪音触发）
        if (this.speakingStartTime === 0) {
          this.speakingStartTime = now;
        } else if (now - this.speakingStartTime >= this.options.activationDelay) {
          // 持续时间足够，转换为 SPEAKING 状态
          this.state = 'SPEAKING';
          this.speakingStartTime = 0;
          
          console.log(
            `[VAD] ${this.identifier} SILENT → SPEAKING ` +
            `(音量=${(myVolume * 100).toFixed(1)}%, ` +
            `延迟=${this.options.activationDelay}ms)`
          );
        }
      } else {
        // 音量低于阈值，重置激活计时器
        this.speakingStartTime = 0;
      }
      
      return false;
    } else {
      // 当前说话状态（state === 'SPEAKING'）
      
      if (!myAboveThreshold) {
        // 本方音量低于阈值，检查是否应该转为静音
        
        // 静音缓冲检查（避免短暂停顿导致状态切换）
        if (this.silenceStartTime === 0) {
          this.silenceStartTime = now;
        } else if (now - this.silenceStartTime >= this.options.silenceDuration) {
          // 静音持续时间足够，转换为 SILENT 状态
          this.state = 'SILENT';
          this.silenceStartTime = 0;
          
          console.log(
            `[VAD] ${this.identifier} SPEAKING → SILENT ` +
            `(音量=${(myVolume * 100).toFixed(1)}%, ` +
            `静音持续=${this.options.silenceDuration}ms)`
          );
        }
      } else {
        // 音量仍然超过阈值，重置静音计时器
        this.silenceStartTime = 0;
      }
      
      return true;
    }
  }
  
  /**
   * 获取当前状态
   */
  getState(): VoiceActivityState {
    return this.state;
  }
  
  /**
   * 重置状态（用于清理）
   */
  reset(): void {
    this.state = 'SILENT';
    this.silenceStartTime = 0;
    this.speakingStartTime = 0;
    this.lastLogTime = 0;
  }
}

