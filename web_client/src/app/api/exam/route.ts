import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { examCreateSchema } from '@/lib/utils/validation';
import { getExamsByUserId, createExam } from '@/lib/db/queries/exam';
import { ApiResponse, Exam } from '@/types';

// GET - 获取笔试列表
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

    // 获取笔试列表
    const exams = await getExamsByUserId(payload.userId);

    return NextResponse.json<ApiResponse<Exam[]>>(
      {
        success: true,
        data: exams,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取笔试列表错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取笔试列表失败',
      },
      { status: 500 }
    );
  }
}

// POST - 创建笔试
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
    const validationResult = examCreateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: validationResult.error.errors[0].message,
        },
        { status: 400 }
      );
    }

    // 创建笔试
    const examId = await createExam(payload.userId, validationResult.data);

    return NextResponse.json<ApiResponse<{ id: number }>>(
      {
        success: true,
        data: { id: examId },
        message: '笔试创建成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('创建笔试错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '创建笔试失败',
      },
      { status: 500 }
    );
  }
}

