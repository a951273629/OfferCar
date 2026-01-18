import useSWR from 'swr';
import { api } from '@/lib/utils/api';
import { User, UserLoginDto, SendOTPDto } from '@/types';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';

// 获取当前用户
export function useAuth() {
  const { data, error, isLoading, mutate } = useSWR<User>(
    '/auth/me',
    () => api.get<User>('/auth/me'),
    {
      shouldRetryOnError: false,
      revalidateOnFocus: false,
    }
  );

  return {
    user: data,
    isLoading,
    isError: error,
    isAuthenticated: !!data && !error,
    mutate,
  };
}

// 认证操作
export function useAuthActions() {
  const router = useRouter();
  const { mutate } = useAuth();

  const sendOTP = async (data: SendOTPDto) => {
    const res = await fetch('/api/auth/email-otp/send-verification-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: String(data.email),
        type: 'sign-in',
      }),
    });

    if (!res.ok) {
      let msg = '发送验证码失败';
      try {
        const json = (await res.json()) as any;
        msg = String(json?.message || json?.error?.message || msg);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }
  };

  const login = async (credentials: UserLoginDto): Promise<void> => {
    const res = await fetch('/api/auth/sign-in/email-otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: String(credentials.email),
        otp: String(credentials.code),
      }),
    });

    if (!res.ok) {
      let msg = '登录失败';
      try {
        const json = (await res.json()) as any;
        msg = String(json?.message || json?.error?.message || msg);
      } catch {
        // ignore
      }
      throw new Error(msg);
    }

    await mutate();
  };

  const logout = async () => {
    const { error } = await authClient.signOut();
    if (error) {
      throw new Error(String((error as any).message || '登出失败'));
    }
    await mutate(undefined, false);
    // 使用硬跳转确保触发服务器端中间件验证
    window.location.href = '/login';
  };

  return {
    sendOTP,
    login,
    logout,
  };
}

