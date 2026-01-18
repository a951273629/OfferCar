import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { redeemCardCode } from '@/lib/db/queries/cardCode';
import { ApiResponse } from '@/types';

// POST - 兑换卡密（用户）
export async function POST(request: NextRequest) {
  try {
    // 验证用户登录
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

    const body = await request.json();
    const { code } = body as { code: string };

    // 验证必填字段
    if (!code) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '请输入卡密',
        },
        { status: 400 }
      );
    }

    // 去除空格和转大写
    const trimmedCode = code.trim().toUpperCase();

    // 验证卡密格式（16位字母数字）
    if (!/^[A-Z0-9]{16}$/.test(trimmedCode)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '卡密格式不正确，应为16位字母数字组合',
        },
        { status: 400 }
      );
    }

    // 兑换卡密
    const result = await redeemCardCode(trimmedCode, payload.userId);

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: result.error || '兑换失败',
        },
        { status: 400 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        data: { points: result.points },
        message: `兑换成功！获得 ${result.points} 点`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('兑换卡密失败:', error);

    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '兑换失败，请稍后重试',
      },
      { status: 500 }
    );
  }
}

