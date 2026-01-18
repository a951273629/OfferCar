
// 信令服务器地址
export const SIGNALING_SERVER_URL = 
  process.env.NEXT_PUBLIC_SIGNALING_SERVER_URL || 'http://localhost:3001';



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

// 配对码配置
export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_EXPIRY_MS = 5 * 60 * 1000; // 5分钟

// 生成配对码
export function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

