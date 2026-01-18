import { query } from '../index';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 聊天历史接口
export interface ChatHistory {
  id: number;
  interview_id: number;
  user_id: string;
  question: string;
  answer: string;
  created_at: Date;
  updated_at: Date;
}

// 保存聊天记录
export async function saveChatHistory(
  interviewId: number,
  userId: string,
  question: string,
  answer: string
): Promise<number> {
  const sql = `
    INSERT INTO chat_histories (interview_id, user_id, question, answer)
    VALUES (?, ?, ?, ?)
  `;
  const result = await query<ResultSetHeader>(sql, [
    String(interviewId),
    String(userId),
    question,
    answer,
  ]);
  return result.insertId;
}

// 获取指定面试的所有聊天历史（按时间正序）
export async function getChatHistoriesByInterviewId(
  interviewId: number
): Promise<ChatHistory[]> {
  const sql = `
    SELECT * FROM chat_histories 
    WHERE interview_id = ? 
    ORDER BY created_at ASC
  `;
  return await query<(ChatHistory & RowDataPacket)[]>(sql, [interviewId]);
}

// 获取用户的所有聊天历史（跨所有面试）
export async function getChatHistoriesByUserId(
  userId: string,
  limit?: number
): Promise<ChatHistory[]> {
  const sql = limit
    ? 'SELECT * FROM chat_histories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM chat_histories WHERE user_id = ? ORDER BY created_at DESC';
  
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const params = limit ? [String(userId), String(limit)] : [String(userId)];
  return await query<(ChatHistory & RowDataPacket)[]>(sql, params);
}

// 删除指定的聊天记录
export async function deleteChatHistory(
  id: number,
  userId: string
): Promise<boolean> {
  const sql = 'DELETE FROM chat_histories WHERE id = ? AND user_id = ?';
  const result = await query<ResultSetHeader>(sql, [String(id), String(userId)]);
  return result.affectedRows > 0;
}

// 删除指定面试的所有聊天历史
export async function deleteChatHistoriesByInterviewId(
  interviewId: number,
  userId: string
): Promise<number> {
  const sql = 'DELETE FROM chat_histories WHERE interview_id = ? AND user_id = ?';
  const result = await query<ResultSetHeader>(sql, [String(interviewId), String(userId)]);
  return result.affectedRows;
}

