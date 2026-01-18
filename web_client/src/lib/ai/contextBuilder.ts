/**
 * AI 上下文构建器
 * 根据 OpenAI 最佳实践构建结构化的 System Prompt
 */

import { SessionContextData } from '@/hooks/useSessionContext';

export interface BuildAIContextOptions {
  bilingualEnable?: boolean;
}

/**
 * 截断文本内容（保持Token在合理范围）
 * 
 * @param content - 原始内容
 * @param maxLength - 最大字符数
 * @returns 截断后的内容
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) {
    return content;
  }
  
  return content.substring(0, maxLength) + '\n\n[内容已截断，如需完整内容请查看原文...]';
}

/**
 * 构建知识库上下文
 * 
 * @param knowledgeBases - 知识库列表
 * @param maxKnowledgeBases - 最多包含的知识库数量
 * @param maxContentPerKb - 每个知识库的最大字符数
 * @returns 格式化的知识库上下文
 */
function buildKnowledgeBasesContext(
  knowledgeBases: SessionContextData['knowledgeBases'],
  maxKnowledgeBases: number = 5,
  maxContentPerKb: number = 800
): string {
  if (!knowledgeBases || knowledgeBases.length === 0) {
    return '';
  }

  // 优先级排序：用户创建的 > 官方知识库
  const sortedKbs = [...knowledgeBases].sort((a, b) => {
    if (a.isOfficial === b.isOfficial) return 0;
    return a.isOfficial ? 1 : -1;
  });

  // 只取前 N 个
  const selectedKbs = sortedKbs.slice(0, maxKnowledgeBases);

  const kbSections = selectedKbs.map((kb, index) => {
    const truncatedContent = truncateContent(kb.content, maxContentPerKb);
    return `### 知识库${index + 1}: ${kb.title}\n${truncatedContent}`;
  });

  return `## 参考知识库\n${kbSections.join('\n\n')}`;
}

/**
 * 构建结构化的 AI 上下文 Prompt（遵循 OpenAI 最佳实践）
 * 
 * @param sessionType - 会话类型（interview / exam）
 * @param position - 职位名称
 * @param contextData - 会话上下文数据
 * @returns 格式化的 System Prompt
 */
export function buildAIContext(
  sessionType: 'interview' | 'exam',
  position: string,
  contextData: SessionContextData | null,
  options?: BuildAIContextOptions
): string {
  const sections: string[] = [];
  const bilingualEnable = options?.bilingualEnable === true;

  // 1. 角色定义
  if (sessionType === 'interview') {
    sections.push('你是一位专业的面试助手，帮助面试者回答问题，所有的回答应该非常口语化 符合人类的说话方式');
  } else {
    sections.push('你是一位专业的笔试辅导助手。');
  }

  // 2. 候选人信息
  sections.push('\n## 候选人信息');
  sections.push(`### 应聘职位\n${position}`);

  // 2.1 编程语言（如果有）
  if (contextData?.programmingLanguage) {
    sections.push(`### 主要编程语言\n${contextData.programmingLanguage}`);
  }

  // 2.2 个人简历（仅面试模式）
  if (sessionType === 'interview' && contextData?.resumeContent) {
    const truncatedResume = truncateContent(contextData.resumeContent, 3000);
    sections.push(`### 个人简历\n${truncatedResume}`);
  }

  // 3. 参考知识库
  if (contextData?.knowledgeBases && contextData.knowledgeBases.length > 0) {
    const kbContext = buildKnowledgeBasesContext(contextData.knowledgeBases);
    sections.push(`### 参考知识库\n${kbContext}`);
  }

  // 4. 职位要求（面试模式）
  if (sessionType === 'interview' && contextData?.jobDescription) {
    const truncatedJd = truncateContent(contextData.jobDescription, 1500);
    sections.push(`\n## 职位要求\n${truncatedJd}`);
  }

  // 5. 笔试描述（笔试模式）
  if (sessionType === 'exam' && contextData?.description) {
    sections.push(`\n## 笔试说明\n${contextData.description}`);
  }

  // 6. 任务指引
  sections.push('\n## 任务指引');
  sections.push(
    '- 提供详细、准确的问题解答\n' +
    '- 优先使用知识库中的内容回答问题\n' +
    '- 回答严格按照三个部分组成\n' +
    '- step1:####面试官意图。\n  根据问题内容 判断出, 面试官是想考察面试者的 哪些 技术能力 或者业务能力,一句话概括。\n' +
    '- step2:####口语化问题回答。\n  站在面试者的角度, 口语化回答问题,回答问题时,不要出现任何解释性文字,不要出现语气词,直接回答问题。\n' +
    '- step3:####问题预测。\n  根据 面试官意图 和 口语化问题回答, 预测出 面试官 接下来可能会问哪些方面的问题,列举1-3个。\n'
  );
  if (bilingualEnable) {
    // answer language use chinese and english
    sections.push('\n## 回答语言');
    sections.push(
      `-在step2:口语化问题回答时,同时使用 中文 和english language 回答问题. 每一句话进行对照,不要一大段话翻译一次,输出示例:\n` +
      `- e.g.: 你好,我是面试者,我想问你一个问题.\n` +
      `(Hello, I am the interviewer, I want to ask you a question.)` +
      `-贵公司的技术栈使用哪些技术呢?\n` +
      `(What technologies does your company use?)\n` +
      `\n`
    );
  }
  return sections.join('\n');
}

