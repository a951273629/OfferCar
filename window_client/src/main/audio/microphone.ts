// 麦克风音频捕获
// 注意：实际的音频捕获在渲染进程中使用 Web Audio API 完成
// 这里主要提供设备列表等辅助功能

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: string;
}

// 这个函数实际上需要在渲染进程中调用
// 这里仅作为接口定义
export async function getMicrophoneDevices(): Promise<AudioDevice[]> {
  // 实际实现在渲染进程中通过 navigator.mediaDevices.enumerateDevices()
  // 主进程通过 IPC 获取设备列表
  return [];
}

// 音频流处理接口
export interface AudioStreamOptions {
  deviceId?: string;
  sampleRate?: number;
  channelCount?: number;
}

// 开始麦克风捕获
export function startMicrophoneCapture(options: AudioStreamOptions = {}): void {
  // 通过 IPC 通知渲染进程开始捕获
  console.log('请求开始麦克风捕获', options);
}

// 停止麦克风捕获
export function stopMicrophoneCapture(): void {
  // 通过 IPC 通知渲染进程停止捕获
  console.log('请求停止麦克风捕获');
}

