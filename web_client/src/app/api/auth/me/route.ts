import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { findUserById } from '@/lib/db/queries/user';
import { ApiResponse, User } from '@/types';

// 强制动态渲染，因为使用了 cookies
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 验证认证
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '未授权，请先登录',
        },
        { status: 401 }
      );
    }

    // 获取用户信息
    const user = await findUserById(payload.userId);
    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '用户不存在',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<User>>(
      {
        success: true,
        data: user,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取用户信息错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取用户信息失败',
      },
      { status: 500 }
    );
  }
}

