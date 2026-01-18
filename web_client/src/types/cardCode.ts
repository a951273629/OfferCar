// 卡密类型定义

export type CardCodeStatus = 'active' | 'used' | 'expired';

export interface CardCode {
  id: number;
  code: string;
  points: number;
  status: CardCodeStatus;
  template_id: number | null;
  batch_no: string | null;
  expires_at: Date | null;
  used_by: string | null;
  used_at: Date | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
  
  // 关联信息（查询时可能包含）
  template_name?: string;
  used_by_email?: string;
  created_by_email?: string;
}

export interface CardTemplate {
  id: number;
  name: string;
  points: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 创建单个卡密 DTO
export interface CardCodeCreateDto {
  points: number;
  template_id?: number | null;
  expires_at?: string | null;
}

// 批量创建卡密 DTO
export interface BatchCreateDto {
  points: number;
  template_id?: number | null;
  quantity: number;
  expires_at?: string | null;
}

// 卡密兑换 DTO
export interface CardRedeemDto {
  code: string;
}

// 卡密列表查询参数
export interface CardCodeListParams {
  status?: CardCodeStatus;
  batch_no?: string;
  template_id?: number;
  page?: number;
  pageSize?: number;
}

// 卡密列表响应
export interface CardCodeListResponse {
  cards: CardCode[];
  total: number;
  page: number;
  pageSize: number;
}

// 创建模板 DTO
export interface CardTemplateCreateDto {
  name: string;
  points: number;
}

// 更新模板 DTO
export interface CardTemplateUpdateDto {
  name?: string;
  points?: number;
  is_active?: boolean;
}

// 卡密状态文本映射
export const CARD_CODE_STATUS_TEXT: Record<CardCodeStatus, string> = {
  active: '未使用',
  used: '已使用',
  expired: '已过期',
};

// 卡密状态颜色映射
export const CARD_CODE_STATUS_COLORS: Record<CardCodeStatus, string> = {
  active: 'success',
  used: 'default',
  expired: 'error',
};

