'use client';

import { createAuthClient } from 'better-auth/react';

/**
 * Better-Auth 客户端（React / Next.js Client Components）
 *
 * 注意：baseURL 对应我们在 App Router 下挂载的：
 * `src/app/api/auth/[...all]/route.ts`
 */
function getAppOrigin(): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  const envBase = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  if (envBase) {
    return String(envBase).replace(/\/+$/, '');
  }

  const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${String(vercelUrl).replace(/^https?:\/\//, '').replace(/\/+$/, '')}`;
  }

  // 兜底：避免 better-auth 内部 new URL() 因相对路径直接抛错
  return 'http://localhost:3000';
}

export const authClient = createAuthClient({
  baseURL: `${getAppOrigin()}/api/auth`,
});

export type BetterAuthSession = typeof authClient.$Infer.Session;


