// 管理员类型定义

export type AdminRole = 'super_admin' | 'admin';

export interface Admin {
  id: number;
  user_id: string; // better-auth.user.id
  role: AdminRole;
  created_at: Date;
  updated_at: Date;
  
  // 关联用户信息（查询时可能包含）
  user_email?: string;
  user_name?: string;
}

// 创建管理员 DTO
export interface AdminCreateDto {
  user_id: string;
  role: AdminRole;
}

// 更新管理员 DTO
export interface AdminUpdateDto {
  role: AdminRole;
}

// 管理员列表查询参数
export interface AdminListParams {
  role?: AdminRole;
  page?: number;
  pageSize?: number;
}

// 管理员列表响应
export interface AdminListResponse {
  admins: Admin[];
  total: number;
  page: number;
  pageSize: number;
}

// 角色文本映射
export const ADMIN_ROLE_TEXT: Record<AdminRole, string> = {
  super_admin: '超级管理员',
  admin: '普通管理员',
};

// 角色颜色映射
export const ADMIN_ROLE_COLORS: Record<AdminRole, string> = {
  super_admin: 'red',
  admin: 'blue',
};

// 管理员信息响应（用于 /api/admin/me）
export interface AdminMeResponse {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  admin: Admin | null;
}

