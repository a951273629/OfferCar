/**
 * 会话历史记录（UI / 导出侧使用）
 */

export interface ConversationHistory {
  id: string;
  question: string;
  questionImage?: string | null; // 可选字段：截图（dataURL/base64）
  answer: string;
  timestamp: Date;
}


