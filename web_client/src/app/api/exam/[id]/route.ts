import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { examUpdateSchema } from '@/lib/utils/validation';
import {
  getExamById,
  updateExam,
  deleteExam,
} from '@/lib/db/queries/exam';
import { ApiResponse, Exam } from '@/types';

// GET - 获取单个笔试
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

    const examId = parseInt(params.id);
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

    return NextResponse.json<ApiResponse<Exam>>(
      {
        success: true,
        data: exam,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取笔试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取笔试失败',
      },
      { status: 500 }
    );
  }
}

// PUT - 更新笔试
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
    const validationResult = examUpdateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    const examId = parseInt(params.id);
    const success = await updateExam(
      examId,
      payload.userId,
      validationResult.data
    );

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '笔试不存在或更新失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '笔试更新成功',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('更新笔试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '更新笔试失败',
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除笔试
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

    const examId = parseInt(params.id);
    const success = await deleteExam(examId, payload.userId);

    if (!success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '笔试不存在或删除失败',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '笔试删除成功',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除笔试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '删除笔试失败',
      },
      { status: 500 }
    );
  }
}

