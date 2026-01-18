import { query } from '../index';
import { User } from '@/types';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

/**
 * 以 better-auth.user.id 作为主键的用户查询（user + user_profile 组合视图）
 */

type UserRow = RowDataPacket & {
  id: string;
  email: string;
  name: string;
  balance?: unknown;
  referrer_id?: unknown;
  referral_code?: unknown;
  distributor_balance?: unknown;
  is_active?: unknown;
  global_config_json?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

function mapUserRow(row: UserRow): User {
  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name),
    balance: Number((row.balance as any) || 0),
    referrer_id: row.referrer_id === null || row.referrer_id === undefined ? undefined : String(row.referrer_id),
    referral_code: row.referral_code === null || row.referral_code === undefined ? undefined : String(row.referral_code),
    distributor_balance: Number((row.distributor_balance as any) || 0),
    is_active: row.is_active === null || row.is_active === undefined ? undefined : Boolean(row.is_active),
    global_config_json:
      row.global_config_json === null || row.global_config_json === undefined
        ? undefined
        : String(row.global_config_json),
    created_at: row.created_at as any,
    updated_at: row.updated_at as any,
  } as User;
}

// 根据邮箱查找用户（user.email）
export async function findUserByEmail(email: string): Promise<User | null> {
  const sql = `
    SELECT
      u.id AS id,
      u.email AS email,
      u.name AS name,
      COALESCE(p.balance, 0) AS balance,
      p.referrer_auth_user_id AS referrer_id,
      p.referral_code AS referral_code,
      COALESCE(p.distributor_balance, 0) AS distributor_balance,
      p.is_active AS is_active,
      p.global_config_json AS global_config_json,
      COALESCE(p.created_at, u.createdAt) AS created_at,
      COALESCE(p.updated_at, u.updatedAt) AS updated_at
    FROM \`user\` u
    LEFT JOIN user_profile p ON p.auth_user_id = u.id
    WHERE u.email = ?
    LIMIT 1
  `;

  const rows = await query<UserRow[]>(sql, [String(email)]);
  return rows.length > 0 ? mapUserRow(rows[0]) : null;
}

// 根据 auth user id 查找用户
export async function findUserById(id: string): Promise<User | null> {
  const sql = `
    SELECT
      u.id AS id,
      u.email AS email,
      u.name AS name,
      COALESCE(p.balance, 0) AS balance,
      p.referrer_auth_user_id AS referrer_id,
      p.referral_code AS referral_code,
      COALESCE(p.distributor_balance, 0) AS distributor_balance,
      p.is_active AS is_active,
      p.global_config_json AS global_config_json,
      COALESCE(p.created_at, u.createdAt) AS created_at,
      COALESCE(p.updated_at, u.updatedAt) AS updated_at
    FROM \`user\` u
    LEFT JOIN user_profile p ON p.auth_user_id = u.id
    WHERE u.id = ?
    LIMIT 1
  `;

  const rows = await query<UserRow[]>(sql, [String(id)]);
  return rows.length > 0 ? mapUserRow(rows[0]) : null;
}

// 确保 user_profile 存在（幂等）
export async function ensureUserProfile(params: {
  authUserId: string;
  referralCode?: string;
}): Promise<boolean> {
  const authUserId = String(params.authUserId).trim();
  if (!authUserId) {
    throw new Error('authUserId 不能为空');
  }

  const referralCode = params.referralCode ? String(params.referralCode) : null;

  const sql = `
    INSERT INTO user_profile (auth_user_id, referral_code)
    VALUES (?, ?)
    ON DUPLICATE KEY UPDATE auth_user_id = auth_user_id
  `;
  await query<ResultSetHeader>(sql, [authUserId, referralCode]);
  return true;
}

// 获取用户余额
export async function getUserBalance(userId: string): Promise<number> {
  const sql = 'SELECT balance FROM user_profile WHERE auth_user_id = ?';
  const results = await query<RowDataPacket[]>(sql, [String(userId)]);
  const balance = results.length > 0 && results[0] ? results[0].balance : 0;
  return Number(balance || 0);
}

// 更新用户余额（原子操作）
export async function updateUserBalance(userId: string, points: number): Promise<number> {
  const sql = `
    UPDATE user_profile
    SET balance = balance + ?
    WHERE auth_user_id = ?
  `;
  await query<ResultSetHeader>(sql, [String(points), String(userId)]);
  return await getUserBalance(userId);
}

// 检查用户余额是否足够
export async function checkUserBalance(userId: string, requiredPoints: number): Promise<boolean> {
  const balance = await getUserBalance(userId);
  return balance >= Number(requiredPoints || 0);
}

// 管理员获取所有用户列表（带分页、搜索、统计）
export async function getAllUsers(params: {
  page?: number;
  pageSize?: number;
  search?: string;
}): Promise<{ users: any[]; total: number }> {
  const { page = 1, pageSize = 20, search } = params;
  const validPage = Math.max(1, Math.floor(Number(page || 0)));
  const validPageSize = Math.max(1, Math.floor(Number(pageSize || 0)));
  const offset = (validPage - 1) * validPageSize;

  // 构建查询条件
  const conditions: string[] = [];
  const values: any[] = [];

  if (search) {
    conditions.push('u.email LIKE ?');
    values.push(`%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 查询总数
  const countSql = `
    SELECT COUNT(*) as total
    FROM user_profile p
    INNER JOIN \`user\` u ON u.id = p.auth_user_id
    ${whereClause}
  `;
  const countResults = await query<RowDataPacket[]>(countSql, values);
  const total = countResults.length > 0 && countResults[0] ? countResults[0].total : 0;

  // 查询用户列表（关联统计数据）
  const listSql = `
    SELECT 
      u.id,
      u.email,
      p.balance,
      p.distributor_balance,
      p.referrer_auth_user_id as referrer_id,
      p.is_active,
      p.created_at,
      ref_u.email as referrer_email,
      COUNT(DISTINCT o.id) as orders_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.actual_price ELSE 0 END), 0) as total_recharge
    FROM user_profile p
    INNER JOIN \`user\` u ON u.id = p.auth_user_id
    LEFT JOIN \`user\` ref_u ON ref_u.id = p.referrer_auth_user_id
    LEFT JOIN orders o ON p.auth_user_id = o.user_id
    ${whereClause}
    GROUP BY u.id, u.email, p.balance, p.distributor_balance, p.referrer_auth_user_id, p.is_active, p.created_at, ref_u.email
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;
  
  const rows = await query<RowDataPacket[]>(listSql, [...values, String(validPageSize), String(offset)]);
  const users = rows.map(row => ({
    ...row,
    balance: Number((row as any).balance || 0),
    distributor_balance: Number((row as any).distributor_balance || 0),
    is_active: Boolean((row as any).is_active),
    orders_count: Number((row as any).orders_count || 0),
    total_recharge: Number((row as any).total_recharge || 0),
  }));

  return { users, total };
}

// 获取用户详情（包含统计信息）
export async function getUserDetailById(userId: string): Promise<any | null> {
  const sql = `
    SELECT 
      u.id,
      u.email,
      u.name,
      p.balance,
      p.distributor_balance,
      p.referrer_auth_user_id as referrer_id,
      p.referral_code,
      p.is_active,
      p.created_at,
      p.updated_at,
      ref_u.email as referrer_email,
      COUNT(DISTINCT o.id) as orders_count,
      COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.actual_price ELSE 0 END), 0) as total_recharge,
      COUNT(DISTINCT r1.auth_user_id) as level1_referrals,
      COUNT(DISTINCT r2.auth_user_id) as level2_referrals
    FROM user_profile p
    INNER JOIN \`user\` u ON u.id = p.auth_user_id
    LEFT JOIN \`user\` ref_u ON ref_u.id = p.referrer_auth_user_id
    LEFT JOIN orders o ON p.auth_user_id = o.user_id
    LEFT JOIN user_profile r1 ON r1.referrer_auth_user_id = p.auth_user_id
    LEFT JOIN user_profile r2 ON r2.referrer_auth_user_id = r1.auth_user_id
    WHERE p.auth_user_id = ?
    GROUP BY u.id, u.email, u.name, p.balance, p.distributor_balance, p.referrer_auth_user_id, p.referral_code, p.is_active, p.created_at, p.updated_at, ref_u.email
  `;
  
  const results = await query<RowDataPacket[]>(sql, [String(userId)]);
  if (results.length === 0 || !results[0]) {
    return null;
  }

  const row = results[0];
  return {
    ...row,
    balance: Number((row as any).balance || 0),
    distributor_balance: Number((row as any).distributor_balance || 0),
    is_active: Boolean((row as any).is_active),
    orders_count: Number((row as any).orders_count || 0),
    total_recharge: Number((row as any).total_recharge || 0),
    level1_referrals: Number((row as any).level1_referrals || 0),
    level2_referrals: Number((row as any).level2_referrals || 0),
  };
}

// 更新用户启用/禁用状态
export async function updateUserStatus(
  userId: string,
  isActive: boolean
): Promise<boolean> {
  const sql = 'UPDATE user_profile SET is_active = ? WHERE auth_user_id = ?';
  const result = await query<ResultSetHeader>(sql, [isActive ? 1 : 0, String(userId)]);
  return result.affectedRows > 0;
}

// 获取用户全局配置 JSON（可能为 null/空）
export async function getUserGlobalConfigJson(userId: string): Promise<string | null> {
  const sql = 'SELECT global_config_json FROM user_profile WHERE auth_user_id = ?';
  const results = await query<RowDataPacket[]>(sql, [String(userId)]);
  const raw = results.length > 0 && results[0] ? results[0].global_config_json : null;
  if (raw === null || raw === undefined) {
    return null;
  }
  return String(raw);
}

// 更新用户全局配置 JSON
export async function updateUserGlobalConfigJson(
  userId: string,
  globalConfigJson: string
): Promise<boolean> {
  const sql = 'UPDATE user_profile SET global_config_json = ? WHERE auth_user_id = ?';
  const result = await query<ResultSetHeader>(sql, [String(globalConfigJson), String(userId)]);
  return result.affectedRows > 0;
}

