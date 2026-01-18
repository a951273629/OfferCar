import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  getInterviewById,
  updateInterview,
} from '@/lib/db/queries/interview';
import { ApiResponse } from '@/types';

// POST - 开始面试会话
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const interviewId = parseInt(params.id);

    // 检查面试是否存在
    const interview = await getInterviewById(interviewId, payload.userId);
    if (!interview) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '面试不存在',
        },
        { status: 404 }
      );
    }

    // 更新面试状态为进行中
    await updateInterview(interviewId, payload.userId, {
      status: 'in_progress',
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '面试会话已开始',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('开始面试会话错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '开始面试会话失败',
      },
      { status: 500 }
    );
  }
}

