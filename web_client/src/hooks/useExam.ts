import useSWR from 'swr';
import { api } from '@/lib/utils/api';
import { Exam, ExamCreateDto, ExamUpdateDto } from '@/types';

// 获取笔试列表
export function useExams() {
  const { data, error, isLoading, mutate } = useSWR<Exam[]>(
    '/exam',
    () => api.get<Exam[]>('/exam')
  );

  return {
    exams: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// 获取单个笔试
export function useExam(id: number | string) {
  const { data, error, isLoading, mutate } = useSWR<Exam>(
    id ? `/exam/${id}` : null,
    () => api.get<Exam>(`/exam/${id}`)
  );

  return {
    exam: data,
    isLoading,
    isError: error,
    mutate,
  };
}

// 笔试操作
export function useExamActions() {
  const { mutate: mutateList } = useExams();

  const createExam = async (data: ExamCreateDto) => {
    const response = await api.post('/exam', data);
    await mutateList();
    return response;
  };

  const updateExam = async (id: number, data: ExamUpdateDto) => {
    const response = await api.put(`/exam/${id}`, data);
    await mutateList();
    return response;
  };

  const deleteExam = async (id: number) => {
    await api.delete(`/exam/${id}`);
    await mutateList();
  };

  const startExam = async (id: number) => {
    const response = await api.post(`/exam/${id}/start`);
    await mutateList();
    return response;
  };

  return {
    createExam,
    updateExam,
    deleteExam,
    startExam,
  };
}

