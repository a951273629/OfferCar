import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { interviewUpdateSchema } from '@/lib/utils/validation';
import {
  getInterviewById,
  updateInterview,
  deleteInterview,
} from '@/lib/db/queries/interview';
import { ApiResponse, Interview } from '@/types';

// GET - 获取单个面试
export async function GET(
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

    return NextResponse.json<ApiResponse<Interview>>(
      {
        success: true,
        data: interview,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取面试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取面试失败',
      },
      { status: 500 }
    );
  }
}

// PUT - 更新面试
export async function PUT(
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

    const body = await request.json();

    // 验证输入
    const validationResult = interviewUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const interviewId = parseInt(params.id);
    const success = await updateInterview(
      interviewId,
      payload.userId,
      validationResult.data
    );

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '面试不存在或更新失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '面试更新成功',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('更新面试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '更新面试失败',
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除面试
export async function DELETE(
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
    const success = await deleteInterview(interviewId, payload.userId);

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '面试不存在或删除失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '面试删除成功',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除面试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '删除面试失败',
      },
      { status: 500 }
    );
  }
}

