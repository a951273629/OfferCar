import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { deleteChatHistory } from '@/lib/db/queries/chat-history';
import { ApiResponse } from '@/types';

// DELETE - 删除单条聊天历史记录
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

    const historyId = parseInt(params.id);

    if (isNaN(historyId)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '无效的记录 ID',
        },
        { status: 400 }
      );
    }

    // 删除聊天历史记录（会验证记录所有权）
    const deleted = await deleteChatHistory(historyId, payload.userId);

    if (!deleted) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '记录不存在或无权删除',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>(
      {
        success: true,
        message: '聊天记录已删除',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('删除聊天历史记录错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '删除聊天记录失败',
      },
      { status: 500 }
    );
  }
}

