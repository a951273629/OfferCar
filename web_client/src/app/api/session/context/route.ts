import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/middleware';
import { getInterviewById } from '@/lib/db/queries/interview';
import { getExamById } from '@/lib/db/queries/exam';
import { 
  getInterviewKnowledgeBases,
  getExamKnowledgeBases
} from '@/lib/db/queries/knowledge-base';

/**
 * GET /api/session/context - 获取会话上下文数据
 * 
 * 查询参数：
 * - interviewId: 面试ID（面试模式）
 * - examId: 笔试ID（笔试模式）
 * 
 * 返回：
 * - knowledgeBases: 关联的知识库列表
 * - resumeContent: 简历内容（仅面试）
 * - jobDescription: 职位描述（仅面试）
 * - description: 笔试描述（仅笔试）
 * - position: 职位名称
 * - programmingLanguage: 编程语言
 */
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const userId = await verifyAuth(request);

    const { searchParams } = new URL(request.url);
    const interviewIdStr = searchParams.get('interviewId');
    const examIdStr = searchParams.get('examId');

    if (!interviewIdStr && !examIdStr) {
      return NextResponse.json(
        { error: '缺少 interviewId 或 examId 参数' },
        { status: 400 }
      );
    }

    // 处理面试会话
    if (interviewIdStr) {
      const interviewId = parseInt(interviewIdStr, 10);
      if (isNaN(interviewId)) {
        return NextResponse.json(
          { error: '无效的 interviewId' },
          { status: 400 }
        );
      }

      // 获取面试信息
      const interview = await getInterviewById(interviewId, userId);
      if (!interview) {
        return NextResponse.json(
          { error: '面试不存在或无权限访问' },
          { status: 404 }
        );
      }

      // 获取关联的知识库
      const knowledgeBases = await getInterviewKnowledgeBases(interviewId);

      // 构建上下文数据
      const contextData = {
        sessionType: 'interview' as const,
        position: interview.position,
        programmingLanguage: interview.programming_language || null,
        jobDescription: interview.job_description || null,
        resumeContent: interview.resume_content || null,
        knowledgeBases: knowledgeBases.map((kb) => ({
          id: kb.id,
          title: kb.title,
          content: kb.content,
          isOfficial: kb.is_official,
          wordCount: kb.word_count,
        })),
      };

      return NextResponse.json({
        success: true,
        data: contextData,
      });
    }

    // 处理笔试会话
    if (examIdStr) {
      const examId = parseInt(examIdStr, 10);
      if (isNaN(examId)) {
        return NextResponse.json(
          { error: '无效的 examId' },
          { status: 400 }
        );
      }

      // 获取笔试信息
      const exam = await getExamById(examId, userId);
      if (!exam) {
        return NextResponse.json(
          { error: '笔试不存在或无权限访问' },
          { status: 404 }
        );
      }

      // 获取关联的知识库
      const knowledgeBases = await getExamKnowledgeBases(examId);

      // 构建上下文数据
      const contextData = {
        sessionType: 'exam' as const,
        position: exam.position,
        programmingLanguage: exam.programming_language || null,
        description: exam.description || null,
        knowledgeBases: knowledgeBases.map((kb) => ({
          id: kb.id,
          title: kb.title,
          content: kb.content,
          isOfficial: kb.is_official,
          wordCount: kb.word_count,
        })),
      };

      return NextResponse.json({
        success: true,
        data: contextData,
      });
    }

  } catch (error) {
    console.error('[Session Context] 获取上下文失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '获取会话上下文失败' },
      { status: 500 }
    );
  }
}

