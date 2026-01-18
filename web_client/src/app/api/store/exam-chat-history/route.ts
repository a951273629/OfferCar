import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  saveExamChatHistory,
  getExamChatHistoriesByExamId,
} from '@/lib/db/queries/exam-chat-history';
import { ApiResponse } from '@/types';

// GET - 获取笔试聊天历史
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

    // 获取查询参数
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');

    if (!examId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '缺少 examId 参数',
        },
        { status: 400 }
      );
    }

    // 查询聊天历史
    const histories = await getExamChatHistoriesByExamId(parseInt(examId));

    return NextResponse.json<ApiResponse<{ histories: typeof histories }>>(
      {
        success: true,
        data: { histories },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取笔试聊天历史错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取聊天历史失败',
      },
      { status: 500 }
    );
  }
}

// POST - 保存笔试聊天记录
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
    const { examId, question, answer, questionImage } = body;

    // 验证必填字段
    if (!examId || !question || !answer) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '缺少必填字段',
        },
        { status: 400 }
      );
    }

    // 保存聊天记录
    const id = await saveExamChatHistory(
      parseInt(examId),
      payload.userId,
      question,
      answer,
      questionImage
    );

    return NextResponse.json<ApiResponse<{ id: number }>>(
      {
        success: true,
        data: { id },
        message: '聊天记录保存成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('保存笔试聊天记录错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '保存聊天记录失败',
      },
      { status: 500 }
    );
  }
}

