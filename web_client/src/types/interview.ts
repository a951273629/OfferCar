export type InterviewStatus = 'pending' | 'in_progress' | 'completed';
export type InterviewLanguage = 'zh' | 'en' | 'ja' | 'fr' | 'de';
export type ProgrammingLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'csharp' | 'go' | 'rust' | 'php' | 'ruby' | 'swift' | 'kotlin' | 'other';
export type InterviewType = 'technical' | 'managerial' | 'hr';

export interface Interview {
  id: number;
  user_id: string;
  title: string;
  description: string;
  position: string;
  language: InterviewLanguage;
  programming_language?: ProgrammingLanguage;
  interview_type: InterviewType;
  resume_url?: string;
  resume_content?: string;
  job_description?: string;
  status: InterviewStatus;
  default_session_config_json?: string; // 默认会话配置(JSON)
  created_at: Date;
  updated_at: Date;
}

export interface InterviewCreateDto {
  title: string;
  description?: string;
  position: string;
  language: InterviewLanguage;
  programming_language?: ProgrammingLanguage;
  interview_type: InterviewType;
  resume_url?: string;
  resume_content?: string;
  job_description?: string;
  default_session_config_json?: string; // 默认会话配置(JSON)
}

export interface InterviewUpdateDto {
  title?: string;
  description?: string;
  position?: string;
  language?: InterviewLanguage;
  programming_language?: ProgrammingLanguage;
  interview_type?: InterviewType;
  resume_url?: string;
  resume_content?: string;
  job_description?: string;
  status?: InterviewStatus;
  default_session_config_json?: string; // 默认会话配置(JSON)
}

export interface InterviewSession {
  id: number;
  interview_id: number;
  start_time: Date;
  end_time?: Date;
  transcript: string;
  score?: number;
  feedback?: string;
  session_config_json?: string; // 会话配置(JSON)
  created_at: Date;
}

export interface InterviewSessionCreateDto {
  interview_id: number;
}

