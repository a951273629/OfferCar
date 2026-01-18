export interface User {
  id: string;                    // better-auth.user.id
  email: string;
  name: string;
  is_active?: boolean;           // 用户状态（启用/禁用）
  global_config_json?: string;   // 用户全局配置（JSON 字符串，可选）
  created_at: Date;
  updated_at: Date;
}

export interface UserLoginDto {
  email: string;
  code: string;
}

export interface SendOTPDto {
  email: string;
}

export interface UserAuthResponse {
  user: User;
  token: string;
  isNewUser?: boolean; // 是否是新注册用户
}

// 管理员用户列表项
export interface UserListItem {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

// 管理员用户详情
export interface UserDetail {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
