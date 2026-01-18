/**
 * 会话上下文 Hook
 * 负责加载面试/笔试的知识库和简历内容
 */

import { useState, useEffect } from 'react';

export interface KnowledgeBaseContext {
  id: number;
  title: string;
  content: string;
  isOfficial: boolean;
  wordCount: number;
}

export interface SessionContextData {
  sessionType: 'interview' | 'exam';
  position: string;
  programmingLanguage: string | null;
  jobDescription?: string | null;
  resumeContent?: string | null;
  description?: string | null;
  knowledgeBases: KnowledgeBaseContext[];
}

interface UseSessionContextOptions {
  sessionId: number;
  sessionType: 'interview' | 'exam';
}

interface UseSessionContextResult {
  contextData: SessionContextData | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * 会话上下文 Hook
 * 
 * 加载面试/笔试的上下文数据（知识库、简历、职位描述等）
 * 
 * @param options - 配置选项
 * @returns 上下文数据和加载状态
 */
export function useSessionContext(options: UseSessionContextOptions): UseSessionContextResult {
  const { sessionId, sessionType } = options;
  
  const [contextData, setContextData] = useState<SessionContextData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadContextData() {
      try {
        setIsLoading(true);
        setError(null);

        // 构建查询参数
        const params = new URLSearchParams();
        if (sessionType === 'interview') {
          params.append('interviewId', sessionId.toString());
        } else {
          params.append('examId', sessionId.toString());
        }

        // 调用API获取上下文数据
        const response = await fetch(`/api/session/context?${params.toString()}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          const result = await response.json();
          throw new Error(result.error || '获取上下文数据失败');
        }

        const result = await response.json();
        
        if (isMounted && result.success && result.data) {
          setContextData(result.data);
          console.log('[Session Context] 上下文数据加载成功:', {
            sessionType: result.data.sessionType,
            position: result.data.position,
            knowledgeBasesCount: result.data.knowledgeBases.length,
            hasResume: !!result.data.resumeContent,
            hasJobDescription: !!result.data.jobDescription,
          });
        }
      } catch (err) {
        console.error('[Session Context] 加载失败:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : '加载上下文数据失败');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadContextData();

    return () => {
      isMounted = false;
    };
  }, [sessionId, sessionType]);

  return {
    contextData,
    isLoading,
    error,
  };
}

