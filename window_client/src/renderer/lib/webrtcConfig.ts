// WebRTC 配置 - Electron 端

// 信令服务器地址
// 开发环境: http://localhost:3001
// 通过 webpack DefinePlugin 在构建时注入
export const SIGNALING_SERVER_URL = process.env.SIGNALING_SERVER_URL || 'http://localhost:3001';

// ICE 服务器配置（STUN）
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// WebRTC PeerConnection 配置
export const PEER_CONNECTION_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
  iceCandidatePoolSize: 10
};

