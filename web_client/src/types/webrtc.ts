// WebRTC 类型定义

export type SignalingMessageType =
  | 'register-pairing-code'
  | 'connect-with-code'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'disconnect';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

export type AudioRole = 'interviewee' | 'interviewer';  // 面试者 | 面试官

export type DataChannelType = 'text' | 'commands';  // DataChannel 类型：文字或命令

export interface PairingCodeInfo {
  code: string;
  createdAt: Date;
  expiresAt: Date;
}

export interface AudioTrackInfo {
  trackId: string;
  role: AudioRole;
  label: string;
}

export interface RecognizedMessage {
  role: AudioRole;
  text: string;
  timestamp: Date;
}

export interface SignalingCallbackResult {
  success: boolean;
  error?: string;
}

export interface PeerConnectedEvent {
  peerSocketId: string;
}

export interface OfferEvent {
  offer: RTCSessionDescriptionInit;
  senderSocketId: string;
}

export interface AnswerEvent {
  answer: RTCSessionDescriptionInit;
}

export interface IceCandidateEvent {
  candidate: RTCIceCandidateInit;
}

// 笔试命令相关类型
export type ExamCommandType = 'screenshot' | 'text' | 'quick-answer' | 'scroll-up' | 'scroll-down';

export interface ExamCommandMessage {
  type: ExamCommandType;
  data: string;  // Base64 图片或纯文本
  timestamp: number;
}

// 识别文字消息
export interface RecognitionTextMessage {
  role: 'interviewee' | 'interviewer';
  text: string;
  type: 'recognizing' | 'recognized';
  status: 'pending' | 'received';  // pending=识别中, received=识别完成
  timestamp: number;
}

// 音量消息
export interface VolumeMessage {
  type: 'volume';
  role: 'interviewee' | 'interviewer';
  volume: number;  // 0-100
  timestamp: number;
}

// WebRTC Receiver Hook 配置选项
export interface UseWebRTCReceiverOptions {
  channels?: DataChannelType[];  // ['text', 'commands']
  onExamCommand?: (message: ExamCommandMessage) => void;
  onRecognitionText?: (message: RecognitionTextMessage) => void;
  onPeerDisconnected?: () => void;  // 对方断开回调
}

// WebRTC Receiver Hook 返回结果
export interface UseWebRTCReceiverResult {
  pairingCode: string;
  connectionState: ConnectionState;
  socketConnected: boolean;  // Socket.IO 连接状态
  microphoneVolume: number;  // 麦克风音量 0-100
  systemAudioVolume: number; // 系统音频音量 0-100
  isModalVisible: boolean;  // Modal 显示状态
  setIsModalVisible: (visible: boolean) => void;
  registerTextCallback?: (callback: (message: RecognitionTextMessage) => void) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  manualDisconnect: () => Promise<void>;  // 手动断开函数
}

