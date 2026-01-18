import crypto from 'crypto';

// 生成随机卡密代码（16位字母数字组合）
export function generateRandomCode(length: number = 16): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去除容易混淆的字符 I, O, 0, 1
  const bytes = crypto.randomBytes(length);
  let code = '';
  
  for (let i = 0; i < length; i++) {
    code += chars[bytes[i] % chars.length];
  }
  
  return code;
}

// 生成批次号（格式：BATCH-时间戳-随机字符）
export function generateBatchNo(): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `BATCH-${timestamp}-${random}`;
}

// 导出为 TXT 格式（每行一个卡密）
export function exportToTXT(codes: string[]): string {
  return codes.join('\n');
}

