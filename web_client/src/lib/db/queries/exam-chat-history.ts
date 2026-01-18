import { query } from '../index';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 笔试聊天历史接口
export interface ExamChatHistory {
  id: number;
  exam_id: number;
  user_id: string;
  question: string;
  question_image: string | null;
  answer: string;
  created_at: Date;
  updated_at: Date;
}

// 保存笔试聊天记录
export async function saveExamChatHistory(
  examId: number,
  userId: string,
  question: string,
  answer: string,
  questionImage?: string
): Promise<number> {
  const sql = `
    INSERT INTO exam_chat_histories (exam_id, user_id, question, question_image, answer)
    VALUES (?, ?, ?, ?, ?)
  `;
  // 将所有参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [
    String(examId),
    String(userId),
    String(question),
    questionImage || null,
    String(answer),
  ]);
  return result.insertId;
}

// 获取指定笔试的所有聊天历史（按时间正序）
export async function getExamChatHistoriesByExamId(
  examId: number
): Promise<ExamChatHistory[]> {
  const sql = `
    SELECT * FROM exam_chat_histories 
    WHERE exam_id = ? 
    ORDER BY created_at ASC
  `;
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  return await query<(ExamChatHistory & RowDataPacket)[]>(sql, [String(examId)]);
}

// 获取用户的所有笔试聊天历史（跨所有笔试）
export async function getExamChatHistoriesByUserId(
  userId: string,
  limit?: number
): Promise<ExamChatHistory[]> {
  const sql = limit
    ? 'SELECT * FROM exam_chat_histories WHERE user_id = ? ORDER BY created_at DESC LIMIT ?'
    : 'SELECT * FROM exam_chat_histories WHERE user_id = ? ORDER BY created_at DESC';
  
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const params = limit ? [String(userId), String(limit)] : [String(userId)];
  return await query<(ExamChatHistory & RowDataPacket)[]>(sql, params);
}

// 删除指定的聊天记录
export async function deleteExamChatHistory(
  id: number,
  userId: string
): Promise<boolean> {
  const sql = 'DELETE FROM exam_chat_histories WHERE id = ? AND user_id = ?';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [String(id), String(userId)]);
  return result.affectedRows > 0;
}

// 删除指定笔试的所有聊天历史
export async function deleteExamChatHistoriesByExamId(
  examId: number,
  userId: string
): Promise<number> {
  const sql = 'DELETE FROM exam_chat_histories WHERE exam_id = ? AND user_id = ?';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [String(examId), String(userId)]);
  return result.affectedRows;
}

