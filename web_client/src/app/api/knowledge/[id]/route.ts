import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import {
  getKnowledgeBaseById,
  updateKnowledgeBase,
  deleteKnowledgeBase,
} from '@/lib/db/queries/knowledge-base';
import { KnowledgeBaseUpdateDto } from '@/types';

// GET /api/knowledge/[id] - 获取知识库详情
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await verifyAuth(req);
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的知识库 ID' }, { status: 400 });
    }

    const knowledgeBase = await getKnowledgeBaseById(id, userId);

    if (!knowledgeBase) {
      return NextResponse.json({ error: '知识库不存在' }, { status: 404 });
    }

    return NextResponse.json({ data: knowledgeBase });
  } catch (error) {
    console.error('获取知识库详情失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取知识库详情失败' },
      { status: 500 }
    );
  }
}

// PUT /api/knowledge/[id] - 更新知识库
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await verifyAuth(req);
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的知识库 ID' }, { status: 400 });
    }

    const body = await req.json() as KnowledgeBaseUpdateDto;

    // 验证内容长度（如果有更新）
    if (body.content && body.content.length > 100000) {
      return NextResponse.json(
        { error: '内容过长，请控制在 10 万字符以内' },
        { status: 400 }
      );
    }

    const success = await updateKnowledgeBase(id, userId, body);

    if (!success) {
      return NextResponse.json(
        { error: '知识库不存在或无权限修改' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { message: '更新成功' } });
  } catch (error) {
    console.error('更新知识库失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '更新知识库失败' },
      { status: 500 }
    );
  }
}

// DELETE /api/knowledge/[id] - 删除知识库
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await verifyAuth(req);
    const id = parseInt(params.id, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的知识库 ID' }, { status: 400 });
    }

    const success = await deleteKnowledgeBase(id, userId);

    if (!success) {
      return NextResponse.json(
        { error: '知识库不存在或无权限删除' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { message: '删除成功' } });
  } catch (error) {
    console.error('删除知识库失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '删除知识库失败' },
      { status: 500 }
    );
  }
}



