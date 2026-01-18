import { query } from '../index';
import { CardTemplate } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 创建卡密模板
export async function createCardTemplate(params: {
  name: string;
  points: number;
}): Promise<number> {
  const sql = `
    INSERT INTO card_templates (name, points, is_active)
    VALUES (?, ?, TRUE)
  `;
  const result = await query<ResultSetHeader>(sql, [params.name, params.points]);
  return result.insertId;
}

// 获取所有卡密模板
export async function getCardTemplates(params?: {
  activeOnly?: boolean;
}): Promise<CardTemplate[]> {
  const { activeOnly = false } = params || {};
  
  let sql = 'SELECT * FROM card_templates';
  
  if (activeOnly) {
    sql += ' WHERE is_active = TRUE';
  }
  
  sql += ' ORDER BY created_at DESC';
  
  return await query<(CardTemplate & RowDataPacket)[]>(sql);
}

// 根据ID获取模板
export async function getCardTemplateById(
  templateId: number
): Promise<CardTemplate | null> {
  const sql = 'SELECT * FROM card_templates WHERE id = ?';
  const templates = await query<(CardTemplate & RowDataPacket)[]>(sql, [templateId]);
  return templates.length > 0 ? templates[0] : null;
}

// 更新卡密模板
export async function updateCardTemplate(
  templateId: number,
  params: {
    name?: string;
    points?: number;
    is_active?: boolean;
  }
): Promise<boolean> {
  const updates: string[] = [];
  const values: any[] = [];
  
  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }
  
  if (params.points !== undefined) {
    updates.push('points = ?');
    values.push(params.points);
  }
  
  if (params.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(params.is_active);
  }
  
  if (updates.length === 0) {
    return false;
  }
  
  values.push(templateId);
  
  const sql = `UPDATE card_templates SET ${updates.join(', ')} WHERE id = ?`;
  const result = await query<ResultSetHeader>(sql, values);
  return result.affectedRows > 0;
}

// 删除卡密模板
export async function deleteCardTemplate(templateId: number): Promise<boolean> {
  const sql = 'DELETE FROM card_templates WHERE id = ?';
  const result = await query<ResultSetHeader>(sql, [templateId]);
  return result.affectedRows > 0;
}

