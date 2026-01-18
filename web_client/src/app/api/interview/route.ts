import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { interviewCreateSchema } from '@/lib/utils/validation';
import {
  getInterviewsByUserId,
  createInterview,
} from '@/lib/db/queries/interview';
import { ApiResponse, Interview } from '@/types';

// GET - 获取面试列表
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

    // 获取面试列表
    const interviews = await getInterviewsByUserId(payload.userId);

    return NextResponse.json<ApiResponse<Interview[]>>(
      {
        success: true,
        data: interviews,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取面试列表错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取面试列表失败',
      },
      { status: 500 }
    );
  }
}

// POST - 创建面试
export async function POST(request: NextRequest) {
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

    const body = await request.json();

    // 验证输入
    const validationResult = interviewCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    // 创建面试
    const interviewId = await createInterview(
      payload.userId,
      validationResult.data
    );

    return NextResponse.json<ApiResponse<{ id: number }>>(
      {
        success: true,
        data: { id: interviewId },
        message: '面试创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('创建面试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '创建面试失败',
      },
      { status: 500 }
    );
  }
}

