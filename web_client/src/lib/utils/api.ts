import axios, { AxiosError } from 'axios';
import { ApiResponse } from '@/types';

// 统一使用相对路径，自动跟随当前访问域名，避免因 www / 裸域不一致引发跨域
const API_BASE_URL = '/api';

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // 支持 Cookie
});

// 响应拦截器
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse>) => {
    // 统一错误处理
    if (error.response) {
      const { data } = error.response;
      throw new Error(data.error || data.message || '请求失败');
    } else if (error.request) {
      throw new Error('网络错误，请检查网络连接');
    } else {
      throw new Error('请求配置错误');
    }
  }
);

// API 工具函数
export const api = {
  // GET 请求
  get: async <T = unknown>(url: string, params?: unknown): Promise<T> => {
    const response = await apiClient.get<ApiResponse<T>>(url, { params });
    return response.data.data as T;
  },

  // POST 请求
  post: async <T = unknown>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.post<ApiResponse<T>>(url, data);
    return response.data.data as T;
  },

  // PUT 请求
  put: async <T = unknown>(url: string, data?: unknown): Promise<T> => {
    const response = await apiClient.put<ApiResponse<T>>(url, data);
    return response.data.data as T;
  },

  // DELETE 请求
  delete: async <T = unknown>(url: string): Promise<T> => {
    const response = await apiClient.delete<ApiResponse<T>>(url);
    return response.data.data as T;
  },
};

