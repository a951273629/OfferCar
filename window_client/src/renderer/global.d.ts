// 全局类型声明
import type { ElectronAPI } from '../preload/index';

// 识别文本消息接口
export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';
  timestamp: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI & {
      recognition: {
        start: () => Promise<{ success: boolean }>;
        stop: () => Promise<{ success: boolean }>;
        sendAudio: (role: 'interviewee' | 'interviewer', audioData: number[]) => Promise<{ success: boolean }>;
        getStatus: () => Promise<{ isRunning: boolean }>;
      };

      shell: {
        openExternal: (url: string) => Promise<{ success: boolean }>;
      };
      on: {
        clipboardTextChanged: (callback: (text: string) => void) => void;
        clipboardImageChanged: (callback: (data: any) => void) => void;
        trayVisibilityChanged: (callback: (visible: boolean) => void) => void;
        examScreenshotCaptured: (callback: (base64: string) => void) => void;
        examQuickAnswerTriggered: (callback: () => void) => void;
        recognitionResult: (callback: (message: RecognitionTextMessage) => void) => void;
      };
      removeListener: {
        clipboardTextChanged: () => void;
        clipboardImageChanged: () => void;
        trayVisibilityChanged: () => void;
        examScreenshotCaptured: () => void;
        examQuickAnswerTriggered: () => void;
        recognitionResult: () => void;
      };
    };
  }
}

export {};

