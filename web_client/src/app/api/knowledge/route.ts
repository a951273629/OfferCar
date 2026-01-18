import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import {
  getAllKnowledgeBases,
  getOfficialKnowledgeBases,
  getKnowledgeBasesByUserId,
  createKnowledgeBase,
} from '@/lib/db/queries/knowledge-base';
import { KnowledgeBaseCreateDto } from '@/types';

// GET /api/knowledge - 获取知识库列表
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const official = searchParams.get('official') === 'true';
    const userOnly = searchParams.get('user_only') === 'true';

    let knowledgeBases;
    
    if (official) {
      // 仅获取官方知识库
      knowledgeBases = await getOfficialKnowledgeBases();
    } else if (userOnly) {
      // 仅获取用户自己的知识库
      knowledgeBases = await getKnowledgeBasesByUserId(userId);
    } else {
      // 获取所有知识库（官方 + 用户）
      knowledgeBases = await getAllKnowledgeBases(userId);
    }

    return NextResponse.json({ data: knowledgeBases });
  } catch (error) {
    console.error('获取知识库列表失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取知识库列表失败' },
      { status: 500 }
    );
  }
}

// POST /api/knowledge - 创建知识库
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json() as KnowledgeBaseCreateDto;

    // 验证必填字段
    if (!body.title || !body.content || !body.file_type) {
      return NextResponse.json(
        { error: '标题、内容和文件类型为必填项' },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!['txt', 'md'].includes(body.file_type)) {
      return NextResponse.json(
        { error: '不支持的文件类型' },
        { status: 400 }
      );
    }

    // 验证内容长度（限制在 10 万字符内，约 5 万汉字）
    if (body.content.length > 100000) {
      return NextResponse.json(
        { error: '内容过长，请控制在 10 万字符以内' },
        { status: 400 }
      );
    }

    const id = await createKnowledgeBase(userId, body);

    return NextResponse.json({ data: { id, message: '创建成功' } }, { status: 201 });
  } catch (error) {
    console.error('创建知识库失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '创建知识库失败' },
      { status: 500 }
    );
  }
}



