import { contextBridge, ipcRenderer } from 'electron';

// 定义暴露给渲染进程的 API
const electronAPI = {
  // 窗口控制
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  },

  // 应用控制
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    getVersion: () => ipcRenderer.invoke('app:get-version')
  },

  // 配置管理
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (updates: any) => ipcRenderer.invoke('config:update', updates),
    reset: () => ipcRenderer.invoke('config:reset')
  },

  // 音频设备
  audio: {
    getMicrophoneDevices: () => ipcRenderer.invoke('audio:get-microphone-devices'),
    getSystemAudioSources: () => ipcRenderer.invoke('audio:get-system-audio-sources'),
    startCapture: (config: any) => ipcRenderer.invoke('audio:start-capture', config),
    stopCapture: () => ipcRenderer.invoke('audio:stop-capture')
  },

  // 截图
  screenshot: {
    capture: () => ipcRenderer.invoke('screenshot:capture'),
    captureWindow: (title?: string) => ipcRenderer.invoke('screenshot:capture-window', title)
  },

  // 剪贴板
  clipboard: {
    start: () => ipcRenderer.invoke('clipboard:start'),
    stop: () => ipcRenderer.invoke('clipboard:stop'),
    getStatus: () => ipcRenderer.invoke('clipboard:get-status')
  },

  // 语音识别（火山引擎）
  recognition: {
    start: () => ipcRenderer.invoke('recognition:start'),
    stop: () => ipcRenderer.invoke('recognition:stop'),
    sendAudio: (role: 'interviewee' | 'interviewer', audioData: number[]) => 
      ipcRenderer.invoke('recognition:send-audio', role, audioData),
    getStatus: () => ipcRenderer.invoke('recognition:get-status')
  },

  // Shell 操作
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url)
  },

  // 事件监听
  on: {
    clipboardTextChanged: (callback: (text: string) => void) => {
      ipcRenderer.on('clipboard-text-changed', (_event, text) => callback(text));
    },
    clipboardImageChanged: (callback: (data: any) => void) => {
      ipcRenderer.on('clipboard-image-changed', (_event, data) => callback(data));
    },
    trayVisibilityChanged: (callback: (visible: boolean) => void) => {
      ipcRenderer.on('tray-visibility-changed', (_event, visible) => callback(visible));
    },
    examScreenshotCaptured: (callback: (base64: string) => void) => {
      ipcRenderer.on('exam-screenshot-captured', (_event, base64) => callback(base64));
    },
    examQuickAnswerTriggered: (callback: () => void) => {
      ipcRenderer.on('exam-quick-answer-triggered', () => callback());
    },
    examScrollUp: (callback: () => void) => {
      ipcRenderer.on('exam-scroll-up', () => callback());
    },
    examScrollDown: (callback: () => void) => {
      ipcRenderer.on('exam-scroll-down', () => callback());
    },
    recognitionResult: (callback: (message: any) => void) => {
      ipcRenderer.on('recognition:result', (_event, message) => callback(message));
    }
  },

  // 移除监听器
  removeListener: {
    clipboardTextChanged: () => {
      ipcRenderer.removeAllListeners('clipboard-text-changed');
    },
    clipboardImageChanged: () => {
      ipcRenderer.removeAllListeners('clipboard-image-changed');
    },
    trayVisibilityChanged: () => {
      ipcRenderer.removeAllListeners('tray-visibility-changed');
    },
    examScreenshotCaptured: () => {
      ipcRenderer.removeAllListeners('exam-screenshot-captured');
    },
    examQuickAnswerTriggered: () => {
      ipcRenderer.removeAllListeners('exam-quick-answer-triggered');
    },
    examScrollUp: () => {
      ipcRenderer.removeAllListeners('exam-scroll-up');
    },
    examScrollDown: () => {
      ipcRenderer.removeAllListeners('exam-scroll-down');
    },
    recognitionResult: () => {
      ipcRenderer.removeAllListeners('recognition:result');
    }
  }
};

// 将 API 暴露给渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型声明（用于 TypeScript）
export type ElectronAPI = typeof electronAPI;

