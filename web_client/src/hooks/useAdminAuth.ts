import useSWR from 'swr';
import { api } from '@/lib/utils/api';
import { AdminMeResponse } from '@/types/admin';

// 获取当前用户的管理员信息
export function useAdminAuth() {
  const { data, error, isLoading, mutate } = useSWR<AdminMeResponse>(
    '/admin/me',
    () => api.get<AdminMeResponse>('/admin/me'),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  return {
    admin: data?.admin || null,
    isAdmin: data?.isAdmin || false,
    isSuperAdmin: data?.isSuperAdmin || false,
    isLoading,
    isError: error,
    mutate,
  };
}

