import { InterviewLanguage, ProgrammingLanguage } from './interview';

export type ExamStatus = 'pending' | 'in_progress' | 'completed';

export interface Exam {
  id: number;
  user_id: string;
  title: string;
  description: string;
  position: string;
  language: InterviewLanguage;           // 回答语言
  programming_language?: ProgrammingLanguage;  // 编程语言（可选）
  status: ExamStatus;
  default_session_config_json?: string;  // 默认会话配置(JSON)
  created_at: Date;
  updated_at: Date;
}

export interface ExamCreateDto {
  title: string;
  description: string;
  position: string;
  language: InterviewLanguage;           // 回答语言（必填）
  programming_language?: ProgrammingLanguage;  // 编程语言（可选）
  default_session_config_json?: string; // 默认会话配置(JSON)
}

export interface ExamUpdateDto {
  title?: string;
  description?: string;
  position?: string;
  language?: InterviewLanguage;
  programming_language?: ProgrammingLanguage;
  status?: ExamStatus;
  default_session_config_json?: string; // 默认会话配置(JSON)
}

export interface ExamSession {
  id: number;
  exam_id: number;
  start_time: Date;
  end_time?: Date;
  answers: string;
  score?: number;
  feedback?: string;
  session_config_json?: string; // 会话配置(JSON)
  created_at: Date;
}

export interface ExamSessionCreateDto {
  exam_id: number;
}

