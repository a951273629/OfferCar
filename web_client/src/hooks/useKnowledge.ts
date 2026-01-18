import useSWR from 'swr';
import { api } from '@/lib/utils/api';
import {
  KnowledgeBase,
  KnowledgeBaseCreateDto,
  KnowledgeBaseUpdateDto,
} from '@/types';

// 获取知识库列表
export function useKnowledgeBases(official?: boolean, userOnly?: boolean) {
  const params = new URLSearchParams();
  if (official) params.append('official', 'true');
  if (userOnly) params.append('user_only', 'true');
  const queryString = params.toString();
  const url = `/knowledge${queryString ? `?${queryString}` : ''}`;

  const { data, error, isLoading, mutate } = useSWR<KnowledgeBase[]>(
    url,
    () => api.get<KnowledgeBase[]>(url)
  );

  return {
    knowledgeBases: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取单个知识库
export function useKnowledgeBase(id: number | string | null) {
  const { data, error, isLoading, mutate } = useSWR<KnowledgeBase>(
    id ? `/knowledge/${id}` : null,
    () => api.get<KnowledgeBase>(`/knowledge/${id}`)
  );

  return {
    knowledgeBase: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取面试关联的知识库
export function useInterviewKnowledgeBases(interviewId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<KnowledgeBase[]>(
    interviewId ? `/knowledge/link?interview_id=${interviewId}` : null,
    () => api.get<KnowledgeBase[]>(`/knowledge/link?interview_id=${interviewId}`)
  );

  return {
    knowledgeBases: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取面试关联的知识库 ID 列表
export function useInterviewKnowledgeBaseIds(interviewId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<{ ids: number[] }>(
    interviewId ? `/knowledge/link?interview_id=${interviewId}&ids_only=true` : null,
    () => api.get<{ ids: number[] }>(`/knowledge/link?interview_id=${interviewId}&ids_only=true`)
  );

  return {
    ids: data?.ids || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取笔试关联的知识库
export function useExamKnowledgeBases(examId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<KnowledgeBase[]>(
    examId ? `/knowledge/link?exam_id=${examId}` : null,
    () => api.get<KnowledgeBase[]>(`/knowledge/link?exam_id=${examId}`)
  );

  return {
    knowledgeBases: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取笔试关联的知识库 ID 列表
export function useExamKnowledgeBaseIds(examId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<{ ids: number[] }>(
    examId ? `/knowledge/link?exam_id=${examId}&ids_only=true` : null,
    () => api.get<{ ids: number[] }>(`/knowledge/link?exam_id=${examId}&ids_only=true`)
  );

  return {
    ids: data?.ids || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 知识库操作
export function useKnowledgeActions() {
  const { mutate: mutateList } = useKnowledgeBases();

  const createKnowledgeBase = async (data: KnowledgeBaseCreateDto) => {
    const response = await api.post('/knowledge', data);
    await mutateList();
    return response;
  };

  const updateKnowledgeBase = async (
    id: number,
    data: KnowledgeBaseUpdateDto
  ) => {
    const response = await api.put(`/knowledge/${id}`, data);
    await mutateList();
    return response;
  };

  const deleteKnowledgeBase = async (id: number) => {
    await api.delete(`/knowledge/${id}`);
    await mutateList();
  };

  const setInterviewKnowledgeBases = async (
    interviewId: number,
    knowledgeBaseIds: number[]
  ) => {
    await api.post('/knowledge/link', {
      interview_id: interviewId,
      knowledge_base_ids: knowledgeBaseIds,
    });
  };

  const setExamKnowledgeBases = async (
    examId: number,
    knowledgeBaseIds: number[]
  ) => {
    await api.post('/knowledge/link', {
      exam_id: examId,
      knowledge_base_ids: knowledgeBaseIds,
    });
  };

  return {
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    setInterviewKnowledgeBases,
    setExamKnowledgeBases,
  };
}





