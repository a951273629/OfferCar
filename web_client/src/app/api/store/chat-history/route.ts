import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import {
  saveChatHistory,
  getChatHistoriesByInterviewId,
  deleteChatHistoriesByInterviewId,
} from '@/lib/db/queries/chat-history';
import { ApiResponse, ChatHistoryCreateDto, ChatHistoryResponse } from '@/types';

// GET - 获取聊天历史
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
    const searchParams = request.nextUrl.searchParams;
    const interviewId = searchParams.get('interviewId');

    if (!interviewId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '缺少 interviewId 参数',
        },
        { status: 400 }
      );
    }

    // 查询聊天历史
    const histories = await getChatHistoriesByInterviewId(parseInt(interviewId));

    return NextResponse.json<ApiResponse<ChatHistoryResponse>>(
      {
        success: true,
        data: { histories },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取聊天历史错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '获取聊天历史失败',
      },
      { status: 500 }
    );
  }
}

// POST - 保存聊天记录
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

    // 解析请求体
    const body: ChatHistoryCreateDto = await request.json();
    const { interviewId, question, answer } = body;

    // 验证必填字段
    if (!interviewId || !question || !answer) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '缺少必填字段：interviewId, question, answer',
        },
        { status: 400 }
      );
    }

    // 保存到数据库
    const chatId = await saveChatHistory(
      interviewId,
      payload.userId,
      question,
      answer
    );

    return NextResponse.json<ApiResponse<{ id: number }>>(
      {
        success: true,
        data: { id: chatId },
        message: '聊天记录保存成功',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('保存聊天历史错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '保存聊天历史失败',
      },
      { status: 500 }
    );
  }
}

// DELETE - 删除指定面试的所有聊天历史
export async function DELETE(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;
    const interviewId = searchParams.get('interviewId');

    if (!interviewId) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '缺少 interviewId 参数',
        },
        { status: 400 }
      );
    }

    // 删除聊天历史
    const deletedCount = await deleteChatHistoriesByInterviewId(
      parseInt(interviewId),
      payload.userId
    );

    return NextResponse.json<ApiResponse<{ deletedCount: number }>>(
      {
        success: true,
        data: { deletedCount },
        message: `已删除 ${deletedCount} 条聊天记录`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除聊天历史错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除聊天历史失败',
      },
      { status: 500 }
    );
  }
}

