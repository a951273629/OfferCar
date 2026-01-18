export type KnowledgeBaseFileType = 'txt' | 'md';
export type KnowledgeBaseStatus = 'active' | 'archived';

export interface KnowledgeBase {
  id: number;
  user_id: string | null;
  title: string;
  description?: string;
  content: string;
  file_type: KnowledgeBaseFileType;
  tags?: string[];
  is_official: boolean;
  word_count: number;
  status: KnowledgeBaseStatus;
  created_at: Date;
  updated_at: Date;
}

export interface KnowledgeBaseCreateDto {
  title: string;
  description?: string;
  content: string;
  file_type: KnowledgeBaseFileType;
  tags?: string[];
}

export interface KnowledgeBaseUpdateDto {
  title?: string;
  description?: string;
  content?: string;
  tags?: string[];
  status?: KnowledgeBaseStatus;
}



