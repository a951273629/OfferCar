import { query } from '../index';
import { Exam, ExamCreateDto, ExamUpdateDto, ExamSession } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 获取用户的所有笔试
export async function getExamsByUserId(userId: string): Promise<Exam[]> {
  const sql = 'SELECT * FROM exams WHERE user_id = ? ORDER BY created_at DESC';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  return await query<(Exam & RowDataPacket)[]>(sql, [String(userId)]);
}

// 根据 ID 获取笔试
export async function getExamById(id: number, userId: string): Promise<Exam | null> {
  const sql = 'SELECT * FROM exams WHERE id = ? AND user_id = ?';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const exams = await query<(Exam & RowDataPacket)[]>(sql, [String(id), String(userId)]);
  return exams.length > 0 ? exams[0] : null;
}

// 创建笔试
export async function createExam(
  userId: string,
  data: ExamCreateDto
): Promise<number> {
  const sql = `
    INSERT INTO exams (user_id, title, description, position, language, programming_language, default_session_config_json)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  // 将所有参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [
    String(userId),
    String(data.title),
    String(data.description || ''),
    String(data.position),
    String(data.language),
    data.programming_language ? String(data.programming_language) : null,
    data.default_session_config_json ? String(data.default_session_config_json) : null,
  ]);
  return result.insertId;
}

// 更新笔试
export async function updateExam(
  id: number,
  userId: string,
  data: ExamUpdateDto
): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(String(data.title));
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(String(data.description));
  }
  if (data.position !== undefined) {
    fields.push('position = ?');
    values.push(String(data.position));
  }
  if (data.language !== undefined) {
    fields.push('language = ?');
    values.push(String(data.language));
  }
  if (data.programming_language !== undefined) {
    fields.push('programming_language = ?');
    values.push(data.programming_language ? String(data.programming_language) : null);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(String(data.status));
  }
  if (data.default_session_config_json !== undefined) {
    fields.push('default_session_config_json = ?');
    values.push(data.default_session_config_json == null ? null : String(data.default_session_config_json));
  }

  if (fields.length === 0) return false;

  // 将 id 和 userId 转换为字符串以兼容 MySQL 8.0.22+
  values.push(String(id), String(userId));
  const sql = `UPDATE exams SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
  const result = await query<ResultSetHeader>(sql, values);
  return result.affectedRows > 0;
}

// 删除笔试
export async function deleteExam(id: number, userId: string): Promise<boolean> {
  const sql = 'DELETE FROM exams WHERE id = ? AND user_id = ?';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [String(id), String(userId)]);
  return result.affectedRows > 0;
}

// 创建笔试会话
export async function createExamSession(
  examId: number,
  sessionConfigJson?: string | null
): Promise<number> {
  const sql = 'INSERT INTO exam_sessions (exam_id, answers, session_config_json) VALUES (?, ?, ?)';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  const result = await query<ResultSetHeader>(sql, [String(examId), '', sessionConfigJson ? String(sessionConfigJson) : null]);
  return result.insertId;
}

// 获取笔试会话
export async function getExamSessions(examId: number): Promise<ExamSession[]> {
  const sql = 'SELECT * FROM exam_sessions WHERE exam_id = ? ORDER BY start_time DESC';
  // 将参数转换为字符串以兼容 MySQL 8.0.22+
  return await query<(ExamSession & RowDataPacket)[]>(sql, [String(examId)]);
}

// 获取某次笔试会话的 session_config_json（带鉴权：必须属于当前用户）
export async function getExamSessionConfigJsonById(
  sessionId: number,
  userId: string
): Promise<string | null> {
  const sql = `
    SELECT es.session_config_json
    FROM exam_sessions es
    INNER JOIN exams e ON e.id = es.exam_id
    WHERE es.id = ? AND e.user_id = ?
    LIMIT 1
  `;
  const rows = await query<RowDataPacket[]>(sql, [String(sessionId), String(userId)]);
  const raw = rows.length > 0 && rows[0] ? rows[0].session_config_json : null;
  if (raw === null || raw === undefined) {
    return null;
  }
  return String(raw);
}

// 更新某次笔试会话的 session_config_json（带鉴权）
export async function updateExamSessionConfigJsonById(
  sessionId: number,
  userId: string,
  sessionConfigJson: string
): Promise<boolean> {
  const sql = `
    UPDATE exam_sessions es
    INNER JOIN exams e ON e.id = es.exam_id
    SET es.session_config_json = ?
    WHERE es.id = ? AND e.user_id = ?
  `;
  const result = await query<ResultSetHeader>(sql, [String(sessionConfigJson), String(sessionId), String(userId)]);
  return result.affectedRows > 0;
}

