// WebRTC 相关类型定义

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export interface SignalingCallbackResult {
  success: boolean;
  error?: string;
}

export interface AnswerEvent {
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidateEvent {
  candidate: RTCIceCandidateInit;
}

export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';  // pending=识别中, received=识别完成
  timestamp: number;
}

export interface VolumeMessage {
  type: 'volume';
  role: 'interviewee' | 'interviewer';
  volume: number;  // 0-100
  timestamp: number;
}

export interface UseWebRTCSenderResult {
  connectionState: ConnectionState;
  connect: (pairingCode: string) => Promise<void>;
  disconnect: () => void;
  sendExamCommand?: (type: string, data: string) => void;
  sendRecognitionText?: (message: RecognitionTextMessage) => void;
  sendVolumeUpdate?: (role: 'interviewee' | 'interviewer', volume: number) => void;
}

export interface UseWebRTCSenderOptions {
  channels?: ('commands' | 'text')[];  // DataChannel 类型数组
}

