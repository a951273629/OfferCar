export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AzureSpeechToken {
  token: string;
  region: string;
}

// ==================== AI 聊天相关类型定义 ====================

// 消息角色类型
export const MessageRoles = ['system', 'user', 'assistant'] as const;
export type MessageRole = (typeof MessageRoles)[number];

// 多模态内容类型（支持文本和图片）
export interface MultimodalContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

// 聊天消息接口
export interface ChatMessage {
  id: string;                                    // 唯一消息 ID
  role: MessageRole;                             // 消息角色
  content: string | MultimodalContent[];         // 消息内容（支持多模态）
  date: string;                                  // ISO 格式时间戳
  streaming?: boolean;                           // 是否正在流式输出
  isError?: boolean;                             // 是否为错误消息
  model?: string;                                // 使用的模型
  status?: 'pending' | 'received' | 'sent';              // 消息状态（保留字段）
  speaker?: 'interviewee' | 'interviewer';       // 说话人身份（面试者 | 面试官）
}

// AI Provider 枚举
export enum AIProvider {
  OpenAI = 'openai',
  Gemini = 'gemini',
}

// LLM 配置接口
export interface LLMConfig {
  model?: string;                                // 模型名称
  provider?: AIProvider;                         // Provider 类型
  modelMode?: 'general' | 'pro' | 'max';        // 模型模式（新增）
  temperature?: number;                          // 温度参数 (0-1)
  top_p?: number;                                // Top-p 采样
  max_tokens?: number;                           // 最大 token 数（默认 8192）
  stream?: boolean;                              // 是否流式输出
  presence_penalty?: number;                     // 存在惩罚
  frequency_penalty?: number;                    // 频率惩罚
}

// 聊天选项接口
export interface ChatOptions {
  messages: ChatMessage[];                       // 消息列表
  config: LLMConfig;                             // LLM 配置
  modelMode?: 'general' | 'pro' | 'max';        // 模型模式（新增）
  onUpdate?: (chunk: string) => void;           // 流式更新回调（只传递当前块）
  onFinish: (message: string) => void;          // 完成回调（传递完整消息）
  onError?: (error: Error) => void;             // 错误回调
  onController?: (controller: AbortController) => void; // 控制器回调
}

// ==================== SSE 数据格式定义 ====================

// SSE Chunk 数据（流式传输中）
export interface SSEChunkData {
  type: 'chunk';
  content: string;
  isComplete: false;
}

// SSE Done 数据（流式完成）
export interface SSEDoneData {
  type: 'done';
  content: string;
  isComplete: true;
}

// SSE Error 数据（错误）
export interface SSEErrorData {
  type: 'error';
  content: string;
}

// SSE 数据联合类型
export type SSEData = SSEChunkData | SSEDoneData | SSEErrorData;

// ==================== 兼容旧接口 ====================

export interface ChatRequest {
  message: string;
  context?: string;
  sessionId?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
}

