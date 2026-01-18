import useSWR from 'swr';
import { api } from '@/lib/utils/api';
import {
  Interview,
  InterviewCreateDto,
  InterviewUpdateDto,
} from '@/types';

// 获取面试列表
export function useInterviews() {
  const { data, error, isLoading, mutate } = useSWR<Interview[]>(
    '/interview',
    () => api.get<Interview[]>('/interview')
  );

  return {
    interviews: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取单个面试
export function useInterview(id: number | string) {
  const { data, error, isLoading, mutate } = useSWR<Interview>(
    id ? `/interview/${id}` : null,
    () => api.get<Interview>(`/interview/${id}`)
  );

  return {
    interview: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// 面试操作
export function useInterviewActions() {
  const { mutate: mutateList } = useInterviews();

  const createInterview = async (data: InterviewCreateDto): Promise<Interview> => {
    const response = await api.post<Interview>('/interview', data);
    await mutateList();
    return response;
  };

  const updateInterview = async (id: number, data: InterviewUpdateDto) => {
    const response = await api.put(`/interview/${id}`, data);
    await mutateList();
    return response;
  };

  const deleteInterview = async (id: number) => {
    await api.delete(`/interview/${id}`);
    await mutateList();
  };

  const startInterview = async (id: number) => {
    const response = await api.post(`/interview/${id}/start`);
    await mutateList();
    return response;
  };

  return {
    createInterview,
    updateInterview,
    deleteInterview,
    startInterview,
  };
}

