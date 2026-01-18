// 聊天历史类型定义

// 数据库实体
export interface ChatHistory {
  id: number;
  interview_id: number;
  user_id: string;
  question: string;
  answer: string;
  created_at: Date;
  updated_at: Date;
}

// 创建聊天历史的 DTO
export interface ChatHistoryCreateDto {
  interviewId: number;
  question: string;
  answer: string;
}

// API 响应类型
export interface ChatHistoryResponse {
  histories: ChatHistory[];
}

