import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import {
  getInterviewKnowledgeBases,
  getInterviewKnowledgeBaseIds,
  setInterviewKnowledgeBases,
  getExamKnowledgeBases,
  getExamKnowledgeBaseIds,
  setExamKnowledgeBases,
} from '@/lib/db/queries/knowledge-base';
import { getInterviewById } from '@/lib/db/queries/interview';
import { getExamById } from '@/lib/db/queries/exam';

// GET /api/knowledge/link?interview_id=123 或 ?exam_id=456 - 获取关联的知识库
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const { searchParams } = new URL(req.url);
    const interviewIdStr = searchParams.get('interview_id');
    const examIdStr = searchParams.get('exam_id');
    
    if (!interviewIdStr && !examIdStr) {
      return NextResponse.json(
        { error: '缺少 interview_id 或 exam_id 参数' },
        { status: 400 }
      );
    }

    const idsOnly = searchParams.get('ids_only') === 'true';

    // 处理面试
    if (interviewIdStr) {
      const interviewId = parseInt(interviewIdStr, 10);
      if (isNaN(interviewId)) {
        return NextResponse.json(
          { error: '无效的 interview_id' },
          { status: 400 }
        );
      }

      // 验证面试归属
      const interview = await getInterviewById(interviewId, userId);
      if (!interview) {
        return NextResponse.json(
          { error: '面试不存在或无权限访问' },
          { status: 404 }
        );
      }

      if (idsOnly) {
        const ids = await getInterviewKnowledgeBaseIds(interviewId);
        return NextResponse.json({ data: { ids } });
      } else {
        const knowledgeBases = await getInterviewKnowledgeBases(interviewId);
        return NextResponse.json({ data: knowledgeBases });
      }
    }

    // 处理笔试
    if (examIdStr) {
      const examId = parseInt(examIdStr, 10);
      if (isNaN(examId)) {
        return NextResponse.json(
          { error: '无效的 exam_id' },
          { status: 400 }
        );
      }

      // 验证笔试归属
      const exam = await getExamById(examId, userId);
      if (!exam) {
        return NextResponse.json(
          { error: '笔试不存在或无权限访问' },
          { status: 404 }
        );
      }

      if (idsOnly) {
        const ids = await getExamKnowledgeBaseIds(examId);
        return NextResponse.json({ data: { ids } });
      } else {
        const knowledgeBases = await getExamKnowledgeBases(examId);
        return NextResponse.json({ data: knowledgeBases });
      }
    }

    return NextResponse.json(
      { error: '未知错误' },
      { status: 500 }
    );
  } catch (error) {
    console.error('获取知识库失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取知识库失败' },
      { status: 500 }
    );
  }
}

// POST /api/knowledge/link - 设置知识库关联（替换模式）
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyAuth(req);
    const body = await req.json() as {
      interview_id?: number;
      exam_id?: number;
      knowledge_base_ids: number[];
    };

    if ((!body.interview_id && !body.exam_id) || !Array.isArray(body.knowledge_base_ids)) {
      return NextResponse.json(
        { error: '参数格式错误' },
        { status: 400 }
      );
    }

    // 处理面试
    if (body.interview_id) {
      // 验证面试归属
      const interview = await getInterviewById(body.interview_id, userId);
      if (!interview) {
        return NextResponse.json(
          { error: '面试不存在或无权限访问' },
          { status: 404 }
        );
      }

      await setInterviewKnowledgeBases(body.interview_id, body.knowledge_base_ids);
      return NextResponse.json({ data: { message: '设置成功' } });
    }

    // 处理笔试
    if (body.exam_id) {
      // 验证笔试归属
      const exam = await getExamById(body.exam_id, userId);
      if (!exam) {
        return NextResponse.json(
          { error: '笔试不存在或无权限访问' },
          { status: 404 }
        );
      }

      await setExamKnowledgeBases(body.exam_id, body.knowledge_base_ids);
      return NextResponse.json({ data: { message: '设置成功' } });
    }

    return NextResponse.json(
      { error: '未知错误' },
      { status: 500 }
    );
  } catch (error) {
    console.error('设置知识库失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '设置知识库失败' },
      { status: 500 }
    );
  }
}



