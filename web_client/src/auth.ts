import { betterAuth } from 'better-auth';
import { createAuthMiddleware, APIError } from 'better-auth/api';
import { toNextJsHandler } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';

import { getPool } from '@/lib/db';
import { sendVerificationCode } from '@/lib/email/mailer';
import { ensureLegacyUserForEmail } from '@/lib/auth/legacy-user';

function normalizeUrlLike(input: string): string {
  const value = String(input || '').trim();
  if (!value) {
    return '';
  }

  // 去掉尾部 /，避免出现 https://a.com/// 的情况
  const noTrailingSlash = value.replace(/\/+$/, '');

  // 如果输入包含 path/query/hash，提取 origin（更符合 trustedOrigins 预期）
  try {
    return new URL(noTrailingSlash).origin;
  } catch {
    // 不是合法 URL 时原样返回（例如 wildcard 模式）
    return noTrailingSlash;
  }
}

function parseTrustedOriginsFromEnv(): string[] {
  const env = String(process.env.TRUSTED_ORIGINS || '').trim();
  if (!env) {
    const fallbackFromBetterAuthUrl = String(process.env.BETTER_AUTH_URL || '').trim();
    const normalizedFallback = fallbackFromBetterAuthUrl ? normalizeUrlLike(fallbackFromBetterAuthUrl) : '';
    return normalizedFallback ? [normalizedFallback] : [];
  }

  const items = env
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => normalizeUrlLike(s))
    .filter(Boolean);

  return Array.from(new Set(items));
}

function resolveBetterAuthBaseUrl(trustedOrigins: string[]): string | undefined {
  const env = String(process.env.BETTER_AUTH_URL || '').trim();
  if (env) {
    // baseURL 允许包含 path，但这里统一规范为无尾部 / 的完整 URL
    return String(env).replace(/\/+$/, '');
  }

  // 回落：取第一个 trusted origin 作为 baseURL
  const first = trustedOrigins[0];
  if (!first) {
    return undefined;
  }
  return String(first).replace(/\/+$/, '');
}

/**
 * Better-Auth 服务端实例（src 入口，支持 @/auth 导入）
 *
 * 注意：
 * - Better-Auth CLI 不会自动读取 Next.js 的 `.env.local`
 * - 你跑 `npx @better-auth/cli migrate` 时需要用 `--config .\\src\\auth.ts`
 *   并确保当前 shell 会话里已经注入 DATABASE_* 环境变量
 */
const trustedOrigins = parseTrustedOriginsFromEnv();
const baseURL = resolveBetterAuthBaseUrl(trustedOrigins);

export const auth = betterAuth({
  ...(baseURL ? { baseURL } : {}),
  trustedOrigins,
  database: getPool(),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      // 300s=5min；旧逻辑是10min，但 Better-Auth 推荐更短；后续如需对齐可再调
      expiresIn: 300,
      async sendVerificationOTP({ email, otp, type }) {
        // 为避免 timing attack，这里不 await（让发送异步进行）
        // 仍复用现有邮件模板/发送逻辑
        void sendVerificationCode(email, otp);

        // 预留：不同 type 可自定义不同邮件内容（目前统一）
        void type;
      },
    }),
  ],
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) {
        return;
      }

      const email = newSession.user?.email;
      if (!email) {
        return;
      }

      const authUserId = newSession.user?.id ? String(newSession.user.id) : '';
      if (!authUserId) {
        return;
      }

      // 邀请码：优先 cookie ic，其次 body.referral_code
      const icFromCookie = ctx.getCookie('ic');
      const icFromBody =
        typeof (ctx.body as any)?.referral_code === 'string'
          ? String((ctx.body as any).referral_code)
          : undefined;

      const referralCode =
        typeof icFromCookie === 'string' && icFromCookie.trim() ? icFromCookie : icFromBody;

      try {
        await ensureLegacyUserForEmail({
          authUserId,
          email,
          referralCode,
        });
      } catch (error) {
        console.error('[BetterAuth] legacy 用户同步失败:', error);
        throw new APIError('INTERNAL_SERVER_ERROR', {
          message: '登录成功但初始化用户失败，请稍后重试',
        });
      } finally {
        // 清理邀请码 cookie，避免重复触发
        ctx.setCookie('ic', '', { maxAge: 0, path: '/' });
      }
    }),
  },
});

/**
 * Next.js Handler 导出（App Router）
 * 使用方式：在 `src/app/api/auth/[...all]/route.ts` 中导出 GET/POST
 */
export const authNextHandler = toNextJsHandler(auth);


