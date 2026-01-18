import { NextRequest } from 'next/server';
import { ensureLegacyUserForEmail } from '@/lib/auth/legacy-user';
import { auth } from '@/auth';

export interface AuthPayload {
  userId: string;
  email: string;
}

// 验证请求是否已认证
export async function authenticateRequest(
  request: NextRequest
): Promise<AuthPayload | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  const authUserId = session?.user?.id ? String(session.user.id) : '';
  const email = session?.user?.email ? String(session.user.email) : '';

  if (!authUserId || !email) {
    return null;
  }

  // 迁移后：兜底确保 user_profile 存在（幂等）
  const { legacyUser } = await ensureLegacyUserForEmail({
    authUserId,
    email,
  });

  return {
    userId: legacyUser.id,
    email: legacyUser.email,
  };
}

// 验证认证并返回用户 ID（简化版，用于API路由）
export async function verifyAuth(request: NextRequest): Promise<string> {
  const payload = await authenticateRequest(request);
  if (!payload) {
    throw new Error('未授权，请先登录');
  }
  return payload.userId;
}

