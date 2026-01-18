import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  getExamById,
  updateExam,
} from '@/lib/db/queries/exam';
import { ApiResponse } from '@/types';

// POST - 开始笔试会话
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

    const examId = parseInt(params.id);

    // 检查笔试是否存在
    const exam = await getExamById(examId, payload.userId);
    if (!exam) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '笔试不存在',
        },
        { status: 404 }
      );
    }

    // 更新笔试状态为进行中
    await updateExam(examId, payload.userId, {
      status: 'in_progress',
    });

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '笔试会话已开始',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('开始笔试会话错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '开始笔试会话失败',
      },
      { status: 500 }
    );
  }
}

