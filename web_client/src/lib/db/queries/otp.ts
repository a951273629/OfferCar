import { query } from '../index';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface VerificationCode {
  id: number;
  email: string;
  code: string;
  expires_at: Date;
  used: boolean;
  attempts: number;
  created_at: Date;
}

// 创建验证码记录
export async function createVerificationCode(
  email: string,
  code: string,
  expiresAt: Date
): Promise<number> {
  const sql =
    'INSERT INTO email_verification_codes (email, code, expires_at) VALUES (?, ?, ?)';
  const result = await query<ResultSetHeader>(sql, [email, code, expiresAt]);
  return result.insertId;
}

// 查询最新的有效验证码
export async function getLatestVerificationCode(
  email: string
): Promise<VerificationCode | null> {
  const sql = `
    SELECT * FROM email_verification_codes 
    WHERE email = ? 
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  const codes = await query<(VerificationCode & RowDataPacket)[]>(sql, [email]);
  return codes.length > 0 ? codes[0] : null;
}

// 验证验证码（检查是否存在、未使用、未过期）
export async function getValidVerificationCode(
  email: string,
  code: string
): Promise<VerificationCode | null> {
  const sql = `
    SELECT * FROM email_verification_codes 
    WHERE email = ? 
      AND code = ? 
      AND used = FALSE 
      AND expires_at > NOW()
    ORDER BY created_at DESC 
    LIMIT 1
  `;
  const codes = await query<(VerificationCode & RowDataPacket)[]>(sql, [
    email,
    code,
  ]);
  return codes.length > 0 ? codes[0] : null;
}

// 标记验证码为已使用
export async function markCodeAsUsed(id: number): Promise<void> {
  const sql = 'UPDATE email_verification_codes SET used = TRUE WHERE id = ?';
  await query(sql, [id]);
}

// 增加验证码尝试次数
export async function incrementAttempts(id: number): Promise<void> {
  const sql =
    'UPDATE email_verification_codes SET attempts = attempts + 1 WHERE id = ?';
  await query(sql, [id]);
}

// 清理过期的验证码（可选，用于定期维护）
export async function cleanupExpiredCodes(): Promise<number> {
  const sql = 'DELETE FROM email_verification_codes WHERE expires_at < NOW()';
  const result = await query<ResultSetHeader>(sql);
  return result.affectedRows;
}

// 检查是否在指定时间内已发送过验证码（防止频繁请求）
export async function hasRecentVerificationCode(
  email: string,
  withinSeconds: number
): Promise<boolean> {
  const seconds = Math.max(0, Math.floor(Number(withinSeconds || 0)));
  const cutoff = new Date(Date.now() - seconds * 1000);

  const sql = `
    SELECT COUNT(*) as count 
    FROM email_verification_codes 
    WHERE email = ? 
      AND created_at > ?
  `;
  const result = await query<({ count: number } & RowDataPacket)[]>(sql, [
    String(email),
    cutoff,
  ]);
  return result[0].count > 0;
}

