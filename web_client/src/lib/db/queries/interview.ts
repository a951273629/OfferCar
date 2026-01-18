import { query } from '../index';
import { Interview, InterviewCreateDto, InterviewUpdateDto, InterviewSession } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 获取用户的所有面试
export async function getInterviewsByUserId(userId: string): Promise<Interview[]> {
  const sql = 'SELECT * FROM interviews WHERE user_id = ? ORDER BY created_at DESC';
  return await query<(Interview & RowDataPacket)[]>(sql, [String(userId)]);
}

// 根据 ID 获取面试
export async function getInterviewById(id: number, userId: string): Promise<Interview | null> {
  const sql = 'SELECT * FROM interviews WHERE id = ? AND user_id = ?';
  const interviews = await query<(Interview & RowDataPacket)[]>(sql, [String(id), String(userId)]);
  return interviews.length > 0 ? interviews[0] : null;
}

// 创建面试
export async function createInterview(
  userId: string,
  data: InterviewCreateDto
): Promise<number> {
  const sql = `
    INSERT INTO interviews (
      user_id, title, description, position, 
      language, programming_language, interview_type, 
      resume_url, resume_content, job_description,
      default_session_config_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const result = await query<ResultSetHeader>(sql, [
    String(userId),
    data.title,
    data.description || '',
    data.position,
    data.language,
    data.programming_language || null,
    data.interview_type,
    data.resume_url || null,
    data.resume_content || null,
    data.job_description || null,
    data.default_session_config_json || null,
  ]);
  return result.insertId;
}

// 更新面试
export async function updateInterview(
  id: number,
  userId: string,
  data: InterviewUpdateDto
): Promise<boolean> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.title !== undefined) {
    fields.push('title = ?');
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push('description = ?');
    values.push(data.description);
  }
  if (data.position !== undefined) {
    fields.push('position = ?');
    values.push(data.position);
  }
  if (data.language !== undefined) {
    fields.push('language = ?');
    values.push(data.language);
  }
  if (data.programming_language !== undefined) {
    fields.push('programming_language = ?');
    values.push(data.programming_language);
  }
  if (data.interview_type !== undefined) {
    fields.push('interview_type = ?');
    values.push(data.interview_type);
  }
  if (data.resume_url !== undefined) {
    fields.push('resume_url = ?');
    values.push(data.resume_url);
  }
  if (data.resume_content !== undefined) {
    fields.push('resume_content = ?');
    values.push(data.resume_content);
  }
  if (data.job_description !== undefined) {
    fields.push('job_description = ?');
    values.push(data.job_description);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }
  if (data.default_session_config_json !== undefined) {
    fields.push('default_session_config_json = ?');
    values.push(data.default_session_config_json == null ? null : String(data.default_session_config_json));
  }

  if (fields.length === 0) return false;

  values.push(String(id), String(userId));
  const sql = `UPDATE interviews SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
  const result = await query<ResultSetHeader>(sql, values);
  return result.affectedRows > 0;
}

// 删除面试
export async function deleteInterview(id: number, userId: string): Promise<boolean> {
  const sql = 'DELETE FROM interviews WHERE id = ? AND user_id = ?';
  const result = await query<ResultSetHeader>(sql, [String(id), String(userId)]);
  return result.affectedRows > 0;
}

// 创建面试会话
export async function createInterviewSession(
  interviewId: number,
  sessionConfigJson?: string | null
): Promise<number> {
  const sql = 'INSERT INTO interview_sessions (interview_id, transcript, session_config_json) VALUES (?, ?, ?)';
  const result = await query<ResultSetHeader>(sql, [interviewId, '', sessionConfigJson ? String(sessionConfigJson) : null]);
  return result.insertId;
}

// 获取面试会话
export async function getInterviewSessions(interviewId: number): Promise<InterviewSession[]> {
  const sql = 'SELECT * FROM interview_sessions WHERE interview_id = ? ORDER BY start_time DESC';
  return await query<(InterviewSession & RowDataPacket)[]>(sql, [interviewId]);
}

// 获取某次面试会话的 session_config_json（带鉴权：必须属于当前用户）
export async function getInterviewSessionConfigJsonById(
  sessionId: number,
  userId: string
): Promise<string | null> {
  const sql = `
    SELECT isess.session_config_json
    FROM interview_sessions isess
    INNER JOIN interviews i ON i.id = isess.interview_id
    WHERE isess.id = ? AND i.user_id = ?
    LIMIT 1
  `;
  const rows = await query<RowDataPacket[]>(sql, [String(sessionId), String(userId)]);
  const raw = rows.length > 0 && rows[0] ? rows[0].session_config_json : null;
  if (raw === null || raw === undefined) {
    return null;
  }
  return String(raw);
}

// 更新某次面试会话的 session_config_json（带鉴权）
export async function updateInterviewSessionConfigJsonById(
  sessionId: number,
  userId: string,
  sessionConfigJson: string
): Promise<boolean> {
  const sql = `
    UPDATE interview_sessions isess
    INNER JOIN interviews i ON i.id = isess.interview_id
    SET isess.session_config_json = ?
    WHERE isess.id = ? AND i.user_id = ?
  `;
  const result = await query<ResultSetHeader>(sql, [String(sessionConfigJson), String(sessionId), String(userId)]);
  return result.affectedRows > 0;
}

