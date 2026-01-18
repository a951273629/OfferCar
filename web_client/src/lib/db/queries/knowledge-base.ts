import { query } from '../index';
import { KnowledgeBase, KnowledgeBaseCreateDto, KnowledgeBaseUpdateDto } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 获取用户的所有知识库
export async function getKnowledgeBasesByUserId(userId: string): Promise<KnowledgeBase[]> {
  const sql = 'SELECT * FROM knowledge_bases WHERE user_id = ? AND status = "active" ORDER BY created_at DESC';
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, [String(userId)]);
  
  return results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];
}

// 获取官方知识库
export async function getOfficialKnowledgeBases(): Promise<KnowledgeBase[]> {
  const sql = 'SELECT * FROM knowledge_bases WHERE is_official = TRUE AND status = "active" ORDER BY created_at DESC';
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, []);
  
  return results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];
}

// 获取所有知识库（官方 + 用户）
export async function getAllKnowledgeBases(userId: string): Promise<KnowledgeBase[]> {
  const sql = `
    SELECT * FROM knowledge_bases 
    WHERE (is_official = TRUE OR user_id = ?) AND status = "active" 
    ORDER BY is_official DESC, created_at DESC
  `;
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, [String(userId)]);
  
  return results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];
}

// 根据 ID 获取知识库
export async function getKnowledgeBaseById(id: number, userId: string): Promise<KnowledgeBase | null> {
  const sql = 'SELECT * FROM knowledge_bases WHERE id = ? AND (is_official = TRUE OR user_id = ?)';
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, [String(id), String(userId)]);
  
  if (results.length === 0) return null;
  
  const row = results[0];
  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  } as KnowledgeBase;
}

// 创建知识库
export async function createKnowledgeBase(
  userId: string,
  data: KnowledgeBaseCreateDto
): Promise<number> {
  const wordCount = data.content.length;
  const tags = data.tags ? JSON.stringify(data.tags) : null;
  
  const sql = `
    INSERT INTO knowledge_bases (
      user_id, title, description, content, 
      file_type, tags, word_count
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const result = await query<ResultSetHeader>(sql, [
    String(userId),
    data.title,
    data.description || null,
    data.content,
    data.file_type,
    tags,
    wordCount,
  ]);
  
  return result.insertId;
}

// 更新知识库
export async function updateKnowledgeBase(
  id: number,
  userId: string,
  data: KnowledgeBaseUpdateDto
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
  if (data.content !== undefined) {
    fields.push('content = ?');
    values.push(data.content);
    fields.push('word_count = ?');
    values.push(data.content.length);
  }
  if (data.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(data.tags));
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return false;

  values.push(String(id), String(userId));
  const sql = `UPDATE knowledge_bases SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
  const result = await query<ResultSetHeader>(sql, values);
  return result.affectedRows > 0;
}

// 删除知识库
export async function deleteKnowledgeBase(id: number, userId: string): Promise<boolean> {
  const sql = 'DELETE FROM knowledge_bases WHERE id = ? AND user_id = ?';
  const result = await query<ResultSetHeader>(sql, [String(id), String(userId)]);
  return result.affectedRows > 0;
}

// 关联知识库到面试
export async function linkKnowledgeBaseToInterview(
  interviewId: number,
  knowledgeBaseId: number
): Promise<boolean> {
  try {
    const sql = `
      INSERT INTO interview_knowledge_bases (interview_id, knowledge_base_id) 
      VALUES (?, ?)
    `;
    await query<ResultSetHeader>(sql, [interviewId, knowledgeBaseId]);
    return true;
  } catch (error) {
    // 如果已存在（违反唯一约束），返回 true
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return true;
    }
    throw error;
  }
}

// 取消关联
export async function unlinkKnowledgeBaseFromInterview(
  interviewId: number,
  knowledgeBaseId: number
): Promise<boolean> {
  const sql = 'DELETE FROM interview_knowledge_bases WHERE interview_id = ? AND knowledge_base_id = ?';
  const result = await query<ResultSetHeader>(sql, [interviewId, knowledgeBaseId]);
  return result.affectedRows > 0;
}

// 获取面试关联的知识库
export async function getInterviewKnowledgeBases(interviewId: number): Promise<KnowledgeBase[]> {
  const sql = `
    SELECT kb.* 
    FROM knowledge_bases kb
    INNER JOIN interview_knowledge_bases ikb ON kb.id = ikb.knowledge_base_id
    WHERE ikb.interview_id = ? AND kb.status = "active"
    ORDER BY ikb.created_at DESC
  `;
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, [interviewId]);
  
  return results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];
}

// 获取面试关联的知识库 ID 列表
export async function getInterviewKnowledgeBaseIds(interviewId: number): Promise<number[]> {
  const sql = 'SELECT knowledge_base_id FROM interview_knowledge_bases WHERE interview_id = ?';
  const results = await query<RowDataPacket[]>(sql, [interviewId]);
  return results.map(row => row.knowledge_base_id as number);
}

// 批量设置面试的知识库关联（替换模式）
export async function setInterviewKnowledgeBases(
  interviewId: number,
  knowledgeBaseIds: number[]
): Promise<void> {
  // 先删除所有现有关联
  const deleteSql = 'DELETE FROM interview_knowledge_bases WHERE interview_id = ?';
  await query<ResultSetHeader>(deleteSql, [String(interviewId)]);
  
  // 如果没有新的关联，直接返回
  if (knowledgeBaseIds.length === 0) return;
  
  // 批量插入新关联
  const placeholders = knowledgeBaseIds.map(() => '(?, ?)').join(', ');
  const insertSql = `INSERT INTO interview_knowledge_bases (interview_id, knowledge_base_id) VALUES ${placeholders}`;
  const params: unknown[] = [];
  knowledgeBaseIds.forEach(kbId => {
    params.push(String(interviewId), String(kbId));
  });
  await query<ResultSetHeader>(insertSql, params);
}

// ========== 笔试知识库关联相关函数 ==========

// 关联知识库到笔试
export async function linkKnowledgeBaseToExam(
  examId: number,
  knowledgeBaseId: number
): Promise<boolean> {
  try {
    const sql = `
      INSERT INTO exam_knowledge_bases (exam_id, knowledge_base_id) 
      VALUES (?, ?)
    `;
    await query<ResultSetHeader>(sql, [examId, knowledgeBaseId]);
    return true;
  } catch (error) {
    // 如果已存在（违反唯一约束），返回 true
    if ((error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return true;
    }
    throw error;
  }
}

// 取消关联
export async function unlinkKnowledgeBaseFromExam(
  examId: number,
  knowledgeBaseId: number
): Promise<boolean> {
  const sql = 'DELETE FROM exam_knowledge_bases WHERE exam_id = ? AND knowledge_base_id = ?';
  const result = await query<ResultSetHeader>(sql, [examId, knowledgeBaseId]);
  return result.affectedRows > 0;
}

// 获取笔试关联的知识库
export async function getExamKnowledgeBases(examId: number): Promise<KnowledgeBase[]> {
  const sql = `
    SELECT kb.* 
    FROM knowledge_bases kb
    INNER JOIN exam_knowledge_bases ekb ON kb.id = ekb.knowledge_base_id
    WHERE ekb.exam_id = ? AND kb.status = "active"
    ORDER BY ekb.created_at DESC
  `;
  const results = await query<(RowDataPacket & { tags?: string })[]>(sql, [examId]);
  
  return results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];
}

// 获取笔试关联的知识库 ID 列表
export async function getExamKnowledgeBaseIds(examId: number): Promise<number[]> {
  const sql = 'SELECT knowledge_base_id FROM exam_knowledge_bases WHERE exam_id = ?';
  const results = await query<RowDataPacket[]>(sql, [examId]);
  return results.map(row => row.knowledge_base_id as number);
}

// 批量设置笔试的知识库关联（替换模式）
export async function setExamKnowledgeBases(
  examId: number,
  knowledgeBaseIds: number[]
): Promise<void> {
  // 先删除所有现有关联
  const deleteSql = 'DELETE FROM exam_knowledge_bases WHERE exam_id = ?';
  await query<ResultSetHeader>(deleteSql, [String(examId)]);
  
  // 如果没有新的关联，直接返回
  if (knowledgeBaseIds.length === 0) return;
  
  // 批量插入新关联
  const placeholders = knowledgeBaseIds.map(() => '(?, ?)').join(', ');
  const insertSql = `INSERT INTO exam_knowledge_bases (exam_id, knowledge_base_id) VALUES ${placeholders}`;
  const params: unknown[] = [];
  knowledgeBaseIds.forEach(kbId => {
    params.push(String(examId), String(kbId));
  });
  await query<ResultSetHeader>(insertSql, params);
}

// ========== 管理员专用：官方知识库管理 ==========

// 创建官方知识库
export async function createOfficialKnowledgeBase(
  data: KnowledgeBaseCreateDto
): Promise<number> {
  const wordCount = data.content.length;
  const tags = data.tags ? JSON.stringify(data.tags) : null;
  
  const sql = `
    INSERT INTO knowledge_bases (
      user_id, title, description, content, 
      file_type, tags, is_official, word_count
    )
    VALUES (NULL, ?, ?, ?, ?, ?, TRUE, ?)
  `;
  
  const result = await query<ResultSetHeader>(sql, [
    data.title,
    data.description || null,
    data.content,
    data.file_type,
    tags,
    wordCount,
  ]);
  
  return result.insertId;
}

// 更新官方知识库
export async function updateOfficialKnowledgeBase(
  id: number,
  data: KnowledgeBaseUpdateDto
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
  if (data.content !== undefined) {
    fields.push('content = ?');
    values.push(data.content);
    fields.push('word_count = ?');
    values.push(data.content.length);
  }
  if (data.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(data.tags));
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    values.push(data.status);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const sql = `UPDATE knowledge_bases SET ${fields.join(', ')} WHERE id = ? AND is_official = TRUE`;
  const result = await query<ResultSetHeader>(sql, values);
  return result.affectedRows > 0;
}

// 删除官方知识库
export async function deleteOfficialKnowledgeBase(id: number): Promise<boolean> {
  const sql = 'DELETE FROM knowledge_bases WHERE id = ? AND is_official = TRUE';
  const result = await query<ResultSetHeader>(sql, [id]);
  return result.affectedRows > 0;
}

// 批量删除官方知识库
export async function batchDeleteOfficialKnowledgeBases(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  
  const placeholders = ids.map(() => '?').join(', ');
  const sql = `DELETE FROM knowledge_bases WHERE id IN (${placeholders}) AND is_official = TRUE`;
  const result = await query<ResultSetHeader>(sql, ids);
  return result.affectedRows;
}

// 分页获取官方知识库列表，支持筛选
export async function getOfficialKnowledgeBasesWithPagination(params: {
  page: number;
  pageSize: number;
  fileType?: string;
  tags?: string[];
}): Promise<{ knowledgeBases: KnowledgeBase[]; total: number }> {
  const { page, pageSize, fileType, tags } = params;

  // 参数验证：确保 page 和 pageSize 是有效的正整数
  const validPage = Math.max(1, Math.floor(Number(page)));
  const validPageSize = Math.max(1, Math.floor(Number(pageSize)));

  // 构建WHERE条件
  const conditions: string[] = ['is_official = ?', 'status = ?'];
  const queryParams: unknown[] = [1, 'active'];

  if (fileType && fileType !== 'all') {
    conditions.push('file_type = ?');
    queryParams.push(fileType);
  }

  if (tags && tags.length > 0) {
    // 对于每个标签，检查tags字段是否包含该标签
    const tagConditions = tags.map(() => 'JSON_CONTAINS(tags, ?)').join(' AND ');
    conditions.push(`(${tagConditions})`);
    tags.forEach(tag => {
      queryParams.push(JSON.stringify(tag));
    });
  }

  const whereClause = conditions.join(' AND ');

  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM knowledge_bases WHERE ${whereClause}`;
  const countResult = await query<RowDataPacket[]>(countSql, queryParams);
  const total = countResult[0].total as number;

  // 查询数据 - 将 LIMIT 和 OFFSET 参数转换为字符串以兼容 MySQL 8.0.22+
  const offset = (validPage - 1) * validPageSize;
  const dataSql = `
    SELECT * FROM knowledge_bases 
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const results = await query<(RowDataPacket & { tags?: string })[]>(
    dataSql, 
    [...queryParams, String(validPageSize), String(offset)]
  );

  const knowledgeBases = results.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : [],
    is_official: Boolean(row.is_official),
  })) as KnowledgeBase[];

  return { knowledgeBases, total };
}



