import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// CORS 白名单（仅用于 /api/*，让旧入口/缓存用户不再因预检被浏览器拦截）
const ALLOWED_ORIGINS = ['https://www.offercar.cn', 'https://offercar.cn'] as const;

function buildCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.includes(origin as any)) {
    return {};
  }

  const requestHeaders =
    request.headers.get('access-control-request-headers') || 'Content-Type, Authorization';

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': requestHeaders,
    Vary: 'Origin',
  };
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /api/*：统一在这里加 CORS（相当于过滤器/拦截器）
  if (pathname.startsWith('/api')) {
    const corsHeaders = buildCorsHeaders(request);

    // 预检请求直接返回，避免进入 route handler
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    const response = NextResponse.next();
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
    return response;
  }

  // 页面路由：按 Better-Auth 最佳实践，仅检查 session cookie 做“乐观重定向”
  const sessionCookie = getSessionCookie(request);

  const isAuthPage = pathname === '/login' || pathname === '/register';
  const isPublicPage = pathname === '/';

  // 已登录访问登录/注册页：跳到默认页
  if (sessionCookie && isAuthPage) {
    return NextResponse.redirect(new URL('/interview', request.url));
  }

  // 未登录访问受保护页面：跳到 /login?redirect=<原始路径>
  const isProtectedPage = !isPublicPage && !isAuthPage;
  if (!sessionCookie && isProtectedPage) {
    const redirectPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', redirectPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// 配置匹配的路由
export const config = {
  matcher: [
    // API 路由：用于统一 CORS/预检处理
    '/api/:path*',
    // 页面路由：排除 _next 静态资源与带扩展名的文件（如 .png/.ico/.css）
    '/((?!_next|.*\\..*).*)',
  ],
};

