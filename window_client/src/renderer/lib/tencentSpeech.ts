import CryptoJS from 'crypto-js';
import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';

// 腾讯云实时语音识别配置
const TENCENT_SECRET_ID = process.env.TENCENT_SECRET_ID || '';
const TENCENT_SECRET_KEY = process.env.TENCENT_SECRET_KEY || '';
const TENCENT_APP_ID = process.env.TENCENT_APP_ID || '';
const TENCENT_ENGINE_MODEL_TYPE = process.env.TENCENT_ENGINE_MODEL_TYPE || '16k_zh';

export interface TencentSpeechConfig {
  appId: string;
  secretId: string;
  secretKey: string;
  engineModelType: string;
}

/**
 * 获取腾讯云语音识别配置
 */
export function getTencentSpeechConfig(): TencentSpeechConfig {
  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY || !TENCENT_APP_ID) {
    throw new Error(
      '腾讯云语音识别配置不完整，请检查环境变量: TENCENT_SECRET_ID, TENCENT_SECRET_KEY, TENCENT_APP_ID'
    );
  }

  return {
    appId: TENCENT_APP_ID,
    secretId: TENCENT_SECRET_ID,
    secretKey: TENCENT_SECRET_KEY,
    engineModelType: TENCENT_ENGINE_MODEL_TYPE,
  };
}

/**
 * 生成腾讯云实时语音识别 WebSocket URL
 */
export function generateTencentWebSocketUrl(voiceId: string): string {
  const config = getTencentSpeechConfig();
  
  const timestamp = Math.floor(Date.now() / 1000);
  const expired = timestamp + 86400; // 24小时后过期
  const nonce = timestamp;

  // 构建请求参数（按字母序排序）
  const params: Record<string, string | number> = {
    engine_model_type: config.engineModelType,
    expired: expired,
    filter_dirty: 0,
    filter_modal: 0,
    filter_punc: 0,
    needvad: 1,
    nonce: nonce,
    secretid: config.secretId,
    timestamp: timestamp,
    voice_format: 1,
    voice_id: voiceId,
  };

  // 生成签名字符串
  const signatureString = generateSignatureString(config.appId, params);
  
  // 生成签名
  const signature = generateSignature(signatureString, config.secretKey);
  
  // URL编码签名
  const encodedSignature = encodeURIComponent(signature);
  
  // 构建完整URL
  const queryParams = Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  const url = `wss://asr.cloud.tencent.com/asr/v2/${config.appId}?${queryParams}&signature=${encodedSignature}`;
  
  console.log('[Tencent Speech] WebSocket URL 已生成');
  
  return url;
}

/**
 * 生成签名字符串
 */
function generateSignatureString(appId: string, params: Record<string, string | number>): string {
  const sortedKeys = Object.keys(params).sort();
  const queryString = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
  const signatureString = `asr.cloud.tencent.com/asr/v2/${appId}?${queryString}`;
  return signatureString;
}

/**
 * 生成 HMAC-SHA1 签名
 */
function generateSignature(signatureString: string, secretKey: string): string {
  const hmac = CryptoJS.HmacSHA1(signatureString, secretKey);
  return CryptoJS.enc.Base64.stringify(hmac);
}

/**
 * 创建腾讯云 WebSocket 连接
 */
export function createTencentWebSocket(): WebSocket {
  const voiceId = uuidv4();
  const url = generateTencentWebSocketUrl(voiceId);

  console.log('[Tencent Speech] 创建 WebSocket 连接...');
  console.log('[Tencent Speech] Voice ID:', voiceId);

  const ws = new WebSocket(url);
  return ws;
}

/**
 * 腾讯云识别结果接口
 */
export interface TencentRecognitionResult {
  code: number;
  message: string;
  voice_id?: string;
  message_id?: string;
  final?: number;
  result?: {
    slice_type: number;  // 0: 一句话开始，1: 一句话中间，2: 一句话结束
    index: number;
    start_time: number;
    end_time: number;
    voice_text_str: string;
    word_size: number;
    word_list: any[];
  };
}

