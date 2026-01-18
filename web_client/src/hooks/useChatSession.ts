/**
 * 聊天会话自定义 Hook
 * 整合了流式动画、历史记录、AI 消息发送等核心逻辑
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { nanoid } from 'nanoid';
import { ChatMessage } from '@/types/api';
import { ConversationHistory } from '@/types/conversation-history';
import { processThinkTags, resetThinkTagState, isThinkTagActive } from '../components/common/functions/thinkTagProcessor';
import { getMessageContent } from '../components/common/functions/messageUtils';
import { buildAIContext } from '@/lib/ai/contextBuilder';
import { SessionContextData } from './useSessionContext';
import { getRecentMessages, filterConversationMessages } from '@/lib/ai/messageUtils';
import { useAppSelector } from '@/store/hooks';
import { selectGlobalConfig } from '@/store/settingsSlice';

interface UseChatSessionConfig {
  sessionId: number;
  sessionType: 'exam' | 'interview';
  position: string;
  supportImage?: boolean;
  contextData?: SessionContextData | null; // 替换：使用结构化的上下文数据
  modelMode?: 'general' | 'pro' | 'max'; // 新增：模型模式
  bilingualEnable?: boolean; // 新增：是否启用双语回答
  scopeCharacter?: boolean; // 新增：AI 消息范围控制（会话可覆盖全局）
}

/**
 * 生成空回复错误消息
 */
function createEmptyResponseError(): string {
  return `### 助手开小差了

**可能原因：**
- 配置参数错误
- 上下文内容超限（消息过多）
- 网络或服务暂时不可用

**建议：**
- 请稍后重试
- 或联系管理员检查配置`;
}

/**
 * 检查错误类型并返回处理结果
 */
function shouldHandleError(error: unknown): { shouldHandle: boolean; message: string } {
  // 优先检测 AbortError（用户主动中止）
  if (error instanceof Error && error.name === 'AbortError') {
    console.log('[Chat] 流式传输被用户中止');
    return { shouldHandle: false, message: '' };
  }
  
  // 真实错误需要处理
  const errorMessage = error instanceof Error ? error.message : '发送失败，请重试';
  return { shouldHandle: true, message: errorMessage };
}

/**
 * 从消息列表中提取第一个图片的 base64
 */
function extractImageFromMessages(
  messages: ChatMessage[],
  supportImage: boolean
): string | null {
  if (!supportImage) {
    return null;
  }
  
  for (const msg of messages) {
    if (!Array.isArray(msg.content)) {
      continue;
    }
    
    const imageItem = msg.content.find(item => item.type === 'image_url');
    if (!imageItem?.image_url) {
      continue;
    }
    
    return imageItem.image_url.url;
  }
  
  return null;
}

/**
 * 聊天会话 Hook
 * 
 * @param config - 会话配置
 * @returns 聊天会话的状态和方法
 */
export function useChatSession(config: UseChatSessionConfig) {
  const { sessionId, sessionType, position, supportImage = false, contextData, modelMode = 'general', bilingualEnable = false } = config;
  
  // ==================== Redux 状态 ====================
  const globalConfig = useAppSelector(selectGlobalConfig);
  const scopeCharacter = config.scopeCharacter ?? globalConfig.scopeCharacter;
  
  // ==================== 状态管理 ====================
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // isRequesting：仅表示“请求已发出/等待首包”，避免与 isStreaming（流式进行中）语义混淆
  const [isRequesting, setIsRequesting] = useState(false);
  const [history, setHistory] = useState<ConversationHistory[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // ==================== System Prompt 缓存（useMemo） ====================
  // 只在 contextData 变化时重新构建，避免每次都重新计算
  const systemPrompt = useMemo(() => {
    return buildAIContext(sessionType, position, contextData || null, { bilingualEnable });
  }, [sessionType, position, contextData, bilingualEnable]);
  
  // ==================== SSE 渲染策略：正文直出 + think 60fps 节流 ====================
  // 单一真值：已接收的完整回答（包含 processThinkTags 转换后的 Markdown）
  const remainTextRef = useRef('');
  // 上一次推送到 UI 的文本长度（仅用于“增量判断/调试”，不是第二份字符串缓冲）
  const renderedLengthRef = useRef(0);
  // think 期间对 setStreamingContent 做 requestAnimationFrame 节流
  const thinkRafIdRef = useRef<number | null>(null);
  const isThinkRafRunningRef = useRef(false);

  const tickThinkThrottle = useCallback(() => {
    if (!isThinkRafRunningRef.current) {
      return;
    }
    setStreamingContent(remainTextRef.current);
    renderedLengthRef.current = remainTextRef.current.length;
    thinkRafIdRef.current = requestAnimationFrame(tickThinkThrottle);
  }, []);

  const startThinkThrottle = useCallback(() => {
    if (isThinkRafRunningRef.current) {
      return;
    }
    isThinkRafRunningRef.current = true;
    tickThinkThrottle();
  }, [tickThinkThrottle]);

  const stopThinkThrottle = useCallback((immediate: boolean = false) => {
    isThinkRafRunningRef.current = false;
    if (thinkRafIdRef.current !== null) {
      cancelAnimationFrame(thinkRafIdRef.current);
      thinkRafIdRef.current = null;
    }

    if (!immediate) {
      return;
    }

    setStreamingContent(remainTextRef.current);
    renderedLengthRef.current = remainTextRef.current.length;
  }, []);

  // 兼容旧导出：对外仍提供 startAnimation/stopAnimation，但内部语义改为 think 节流控制
  const startAnimation = useCallback(() => {
    startThinkThrottle();
  }, [startThinkThrottle]);

  const stopAnimation = useCallback((immediate: boolean = false) => {
    stopThinkThrottle(immediate);
  }, [stopThinkThrottle]);

  // 组件卸载时清理 rAF
  useEffect(() => {
    return () => {
      if (thinkRafIdRef.current !== null) {
        cancelAnimationFrame(thinkRafIdRef.current);
        thinkRafIdRef.current = null;
      }
      isThinkRafRunningRef.current = false;
    };
  }, []);

  // ==================== 聊天历史持久化 ====================
  
  // 从数据库加载聊天历史
  const loadChatHistory = useCallback(async () => {
    try {
      const apiPath = sessionType === 'exam' 
        ? `/api/store/exam-chat-history?examId=${sessionId}`
        : `/api/store/chat-history?interviewId=${sessionId}`;
      
      const response = await fetch(apiPath, { credentials: 'include' });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data?.histories) {
        const loadedHistory = result.data.histories.map((h: { 
          id: number; 
          question: string;
          question_image?: string | null;
          answer: string; 
          created_at: string;
        }) => ({
          id: h.id.toString(),
          question: h.question,
          questionImage: h.question_image,
          answer: h.answer,
          timestamp: new Date(h.created_at),
        }));
        
        setHistory(loadedHistory);
      }
    } catch (error) {
      console.error('[Chat History] 加载失败:', error);
    }
  }, [sessionId, sessionType]);

  // 保存聊天记录到数据库
  const saveChatToDatabase = useCallback(async (
    question: string,
    answer: string,
    questionImage?: string
  ): Promise<number | null> => {
    try {
      const apiPath = sessionType === 'exam' 
        ? '/api/store/exam-chat-history'
        : '/api/store/chat-history';
      
      const requestBody: {
        examId?: number;
        interviewId?: number;
        question: string;
        answer: string;
        questionImage?: string;
      } = {
        question,
        answer,
      };
      
      if (sessionType === 'exam') {
        requestBody.examId = sessionId;
        if (questionImage && supportImage) {
          requestBody.questionImage = questionImage;
        }
      } else {
        requestBody.interviewId = sessionId;
      }

      const response = await fetch(apiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data?.id) {
        return result.data.id;
      }
      return null;
    } catch (error) {
      console.error('[Chat History] 保存失败:', error);
      return null;
    }
  }, [sessionId, sessionType, supportImage]);

  // 组件挂载时自动加载聊天历史
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // ==================== 停止流式生成 ====================
  const stopStreaming = useCallback(() => {
    console.log('[Chat] 用户主动停止流式生成');
    
    // think 节流中立即刷新一次，确保 UI 与落库一致
    stopThinkThrottle(true);
    resetThinkTagState();

    // 获取已累积的流式内容（单一真值）
    const currentContent = remainTextRef.current;
    
    // 如果有内容，保存为 AI 消息
    if (currentContent && currentContent.trim().length > 0) {
      console.log('[Chat] 保存已接收的流式内容:', currentContent.length, '字符');
      
      const aiMessage: ChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: currentContent,
        date: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, aiMessage]);
      
      // 清空流式内容状态
      remainTextRef.current = '';
      renderedLengthRef.current = 0;
      setStreamingContent('');
    }
    
    // 中止请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setIsStreaming(false);
    setIsRequesting(false);
    
    message.info('已停止生成');
  }, [stopThinkThrottle]);

  // ==================== 处理流式完成逻辑 ====================
  const handleStreamCompletion = useCallback(async (
    finalContent: string,
    combinedContent: string,
    imageBase64: string | null,
    pendingMessagesCount: number,
    ignoredCount: number
  ): Promise<void> => {
    let content = finalContent;
    let isError = false;

    // 检测空回复：将错误信息格式化为 markdown 并显示在聊天界面
    if (!content || content.trim().length === 0) {
      console.error('[Chat] AI 返回空内容');
      content = createEmptyResponseError();
      isError = true;
    }

    // 添加 AI 回复到消息列表（正常内容或错误提示）
    const aiMessage: ChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content: content,
      date: new Date().toISOString(),
      isError: isError,
    };
    setMessages((prev) => [...prev, aiMessage]);

    // 只在非错误时保存到历史记录和数据库
    if (isError) {
      return;
    }

    // 添加到历史记录
    const newHistory: ConversationHistory = {
      id: nanoid(),
      question: combinedContent,
      questionImage: imageBase64,
      answer: content,
      timestamp: new Date(),
    };
    setHistory((prev) => [...prev, newHistory]);
    setSelectedHistoryId(newHistory.id);

    // 保存到数据库
    const dbId = await saveChatToDatabase(combinedContent, content, imageBase64 || undefined);
    if (dbId) {
      newHistory.id = dbId.toString();
    }

  }, [saveChatToDatabase]);

  // ==================== 发送所有未发送的消息给 AI ====================
  const sendPendingMessagesToAI = useCallback(async () => {
    // 根据 scopeCharacter 设置筛选消息
    const pendingMessages = messages.filter((msg) => {
      const basicFilter = msg.role === 'user' && (msg.status === 'received' || msg.status === 'pending');
      
      // 如果 scopeCharacter 为 false，发送所有消息
      if (!scopeCharacter) {
        return basicFilter;
      }
      
      // 如果 scopeCharacter 为 true，仅发送面试官的消息
      return basicFilter && msg.speaker === 'interviewer';
    });

    // console.log('[Chat] 消息筛选设置:', {
    //   scopeCharacter,
    //   totalReadyOrRecognizing: messages.filter(m => m.role === 'user' && (m.status === 'received' || m.status === 'pending')).length,
    //   filteredCount: pendingMessages.length,
    //   mode: scopeCharacter ? '仅面试官' : '所有人',
    // });

    if (pendingMessages.length === 0) {
      message.warning(
        scopeCharacter 
          ? '没有未发送的面试官消息' 
          : '没有未发送的消息'
      );
      return;
    }

    // 初始化动画状态
    setIsRequesting(true);
    setIsStreaming(true);
    
    remainTextRef.current = '';
    renderedLengthRef.current = 0;
    resetThinkTagState();
    stopThinkThrottle(false);
    setStreamingContent('');

    try {
      // 收到首个 chunk 后即可结束“请求中”状态（按钮/界面不再转圈，但仍保持流式）
      const hasReceivedFirstChunkRef = { current: false };
      // 发送前：将本次要发送的 pending（识别中）消息标记为 received（识别完成）
      // 目的：复用现有“发送后清理 received”逻辑，将其视为本次发送的输入快照并清理掉
      const pendingMessageIdsToMarkReceived = new Set(
        pendingMessages
          .filter(m => m.status === 'pending')
          .map(m => m.id)
      );
      
      const normalizedMessages = pendingMessageIdsToMarkReceived.size > 0
        ? messages.map((m) => {
            if (!pendingMessageIdsToMarkReceived.has(m.id)) {
              return m;
            }
            return { ...m, status: 'received' as const };
          })
        : messages;

      // 合并所有未发送的消息内容
      const combinedContent = pendingMessages.map((msg) => getMessageContent(msg.content)).join('\n');
      
      // 提取第一个包含图片的消息的图片 base64（如果有）
      const imageBase64 = extractImageFromMessages(pendingMessages, supportImage);

      // 创建当前用户消息（支持多模态：文本+图片）
      const currentUserMessage: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: imageBase64 ? [
          { type: 'text', text: combinedContent },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ] : combinedContent,
        date: new Date().toISOString(),
        status: 'sent',
      };

      // 根据 scopeCharacter 决定清理哪些消息
      const messagesWithoutReceived = normalizedMessages.filter((msg) => {
        if (!(msg.role === 'user' && msg.status === 'received')) {
          return true; // 保留非 received 消息
        }
        
        // 如果不启用角色筛选，清理所有 received 消息
        if (!scopeCharacter) {
          return false;
        }
        
        // 如果启用角色筛选，只清理已发送的面试官消息，保留未发送的面试者消息
        return msg.speaker === 'interviewee';
      });
      const updatedMessages = [...messagesWithoutReceived, currentUserMessage];
      setMessages(updatedMessages);

      // 使用滑动窗口：保留最近 5 轮对话（10 条消息）
      const conversationMessages = getRecentMessages(updatedMessages, 5);

      // console.log('[Send AI] 准备发送消息:', {
      //   hasSystemPrompt: true,
      //   totalMessages: conversationMessages.length,
      //   messageLength: combinedContent.length,
      //   systemPromptLength: systemPrompt.length,
      //   hasImage: !!imageBase64,
      //   imageSize: imageBase64 ? `${(imageBase64.length / 1024).toFixed(2)} KB` : null,
      // });

      // 创建 AbortController
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // 构建新格式的请求体
      const requestBody: {
        messages: ChatMessage[];
        systemPrompt?: string;
        modelMode?: 'general' | 'pro' | 'max';
      } = {
        messages: conversationMessages,
        modelMode: modelMode,
      };

      // 每次请求都发送 systemPrompt（Chat Completions 为无状态接口，需要请求方自行携带上下文/指令）
      requestBody.systemPrompt = systemPrompt;
      // console.log('[Send AI] 发送 system prompt (长度:', systemPrompt.length, '字符)');

      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // 处理单行 SSE 数据
      const processSSELine = async (line: string): Promise<void> => {
        if (!line.startsWith('data: ')) {
          return; // Early Return
        }
        
        try {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'chunk' && data.isComplete === false) {
            if (!hasReceivedFirstChunkRef.current) {
              hasReceivedFirstChunkRef.current = true;
              setIsRequesting(false);
            }
            const wasInThink = isThinkTagActive();
            const processedContent = processThinkTags(data.content);
            const isInThink = isThinkTagActive();
            remainTextRef.current += processedContent;

            const shouldThrottleThink = wasInThink || isInThink || processedContent.trimStart().startsWith('>');
            if (shouldThrottleThink) {
              startThinkThrottle();
              return;
            }

            stopThinkThrottle(false);
            setStreamingContent(remainTextRef.current);
            renderedLengthRef.current = remainTextRef.current.length;
            return;
          }
          
          if (data.type === 'done' && data.isComplete === true) {
            stopThinkThrottle(true);
            resetThinkTagState();
            
            setIsStreaming(false);
            setIsRequesting(false);
            abortControllerRef.current = null;

            const finalContent = remainTextRef.current;
            
            // 计算被忽略的消息数量
            const ignoredCount = scopeCharacter 
              ? normalizedMessages.filter(m => m.role === 'user' && (m.status === 'received' || m.status === 'pending') && m.speaker === 'interviewee').length
              : 0;
            
            await handleStreamCompletion(finalContent, combinedContent, imageBase64, pendingMessages.length, ignoredCount);
            return;
          }
          
          if (data.type === 'error') {
            throw new Error(data.content);
          }
        } catch (error) {
          console.error('解析 SSE 数据失败:', error);
        }
      };

      // 读取 SSE 流
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        return; // Early Return
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          await processSSELine(line);
        }
      }
    } catch (error) {
      // 检查错误类型
      const { shouldHandle, message: errorMessage } = shouldHandleError(error);
      
      // 清理状态
      stopThinkThrottle(true);
      resetThinkTagState();
      setIsStreaming(false);
      setIsRequesting(false);
      abortControllerRef.current = null;
      
      // 只在需要处理的错误时显示提示
      if (!shouldHandle) {
        return; // AbortError 直接返回
      }
      
      // 真实错误才打印和显示
      console.error('发送消息失败:', error);
      message.error(errorMessage);
    }
  }, [messages, supportImage, modelMode, systemPrompt, scopeCharacter, startThinkThrottle, stopThinkThrottle, handleStreamCompletion]);

  // ==================== 发送单条消息给 AI（用于手势右滑） ====================
  const sendSingleMessageToAI = useCallback(async (messageId: string) => {
    const target = messages.find(m => m.id === messageId);
    if (!target) {
      message.error('消息不存在，无法发送');
      return;
    }

    if (target.role !== 'user') {
      message.warning('只能发送用户消息');
      return;
    }

    if (!(target.status === 'received' || target.status === 'pending')) {
      message.warning('该消息已发送或状态不可发送');
      return;
    }

    // 与批量发送逻辑对齐：仍遵循 scopeCharacter（避免绕过“仅面试官”设置）
    if (scopeCharacter && target.speaker === 'interviewee') {
      message.warning('当前设置为仅面试官消息，无法发送面试者消息');
      return;
    }

    const pendingMessages = [target];

    // 初始化动画状态
    setIsRequesting(true);
    setIsStreaming(true);

    remainTextRef.current = '';
    renderedLengthRef.current = 0;
    resetThinkTagState();
    stopThinkThrottle(false);
    setStreamingContent('');

    try {
      const hasReceivedFirstChunkRef = { current: false };
      const pendingMessageIdsToMarkReceived = new Set(
        pendingMessages
          .filter(m => m.status === 'pending')
          .map(m => m.id)
      );

      const normalizedMessages = pendingMessageIdsToMarkReceived.size > 0
        ? messages.map((m) => {
            if (!pendingMessageIdsToMarkReceived.has(m.id)) {
              return m;
            }
            return { ...m, status: 'received' as const };
          })
        : messages;

      const combinedContent = pendingMessages.map((msg) => getMessageContent(msg.content)).join('\n');
      const imageBase64 = extractImageFromMessages(pendingMessages, supportImage);

      const currentUserMessage: ChatMessage = {
        id: nanoid(),
        role: 'user',
        content: imageBase64 ? [
          { type: 'text', text: combinedContent },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ] : combinedContent,
        date: new Date().toISOString(),
        status: 'sent',
      };

      const messagesWithoutReceived = normalizedMessages.filter((msg) => {
        if (!(msg.role === 'user' && msg.status === 'received')) {
          return true;
        }
        if (!scopeCharacter) {
          return false;
        }
        return msg.speaker === 'interviewee';
      });

      const updatedMessages = [...messagesWithoutReceived, currentUserMessage];
      setMessages(updatedMessages);

      const conversationMessages = getRecentMessages(updatedMessages, 5);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const requestBody: {
        messages: ChatMessage[];
        systemPrompt?: string;
        modelMode?: 'general' | 'pro' | 'max';
      } = {
        messages: conversationMessages,
        modelMode: modelMode,
      };

      requestBody.systemPrompt = systemPrompt;

      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const processSSELine = async (line: string): Promise<void> => {
        if (!line.startsWith('data: ')) {
          return;
        }

        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'chunk' && data.isComplete === false) {
            if (!hasReceivedFirstChunkRef.current) {
              hasReceivedFirstChunkRef.current = true;
              setIsRequesting(false);
            }
            const wasInThink = isThinkTagActive();
            const processedContent = processThinkTags(data.content);
            const isInThink = isThinkTagActive();
            remainTextRef.current += processedContent;

            const shouldThrottleThink = wasInThink || isInThink || processedContent.trimStart().startsWith('>');
            if (shouldThrottleThink) {
              startThinkThrottle();
              return;
            }

            stopThinkThrottle(false);
            setStreamingContent(remainTextRef.current);
            renderedLengthRef.current = remainTextRef.current.length;
            return;
          }

          if (data.type === 'done' && data.isComplete === true) {
            stopThinkThrottle(true);
            resetThinkTagState();

            setIsStreaming(false);
            setIsRequesting(false);
            abortControllerRef.current = null;

            const finalContent = remainTextRef.current;
            const ignoredCount = 0;

            await handleStreamCompletion(finalContent, combinedContent, imageBase64, 1, ignoredCount);
            return;
          }

          if (data.type === 'error') {
            throw new Error(data.content);
          }
        } catch (error) {
          console.error('解析 SSE 数据失败:', error);
        }
      };

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        for (const line of lines) {
          await processSSELine(line);
        }
      }
    } catch (error) {
      const { shouldHandle, message: errorMessage } = shouldHandleError(error);
      stopThinkThrottle(true);
      resetThinkTagState();
      setIsStreaming(false);
      setIsRequesting(false);
      abortControllerRef.current = null;

      if (!shouldHandle) {
        return;
      }

      console.error('发送消息失败:', error);
      message.error(errorMessage);
    }
  }, [messages, supportImage, modelMode, systemPrompt, scopeCharacter, startThinkThrottle, stopThinkThrottle, handleStreamCompletion]);

  // ==================== 查看历史记录 ====================
  const viewHistory = useCallback((id: string) => {
    setSelectedHistoryId(id);
    const historyItem = history.find(h => h.id === id);
    if (historyItem) {
      const pendingMessages = messages.filter(
        (msg) => msg.role === 'user' && msg.status === 'pending'
      );

      // 构建历史消息内容（可能包含图片）
      const userContent: import('@/types/api').MultimodalContent[] = [
        { type: 'text', text: historyItem.question }
      ];
      
      if (historyItem.questionImage) {
        userContent.push({
          type: 'image_url',
          image_url: { url: historyItem.questionImage }
        });
      }

      const historyMessages: ChatMessage[] = [
        {
          id: nanoid(),
          role: 'user',
          content: supportImage ? userContent : historyItem.question,
          date: historyItem.timestamp.toISOString(),
          status: 'sent',
        },
        {
          id: nanoid(),
          role: 'assistant',
          content: historyItem.answer,
          date: historyItem.timestamp.toISOString(),
        },
      ];

      setMessages([...historyMessages, ...pendingMessages]);
    }
  }, [history, messages, supportImage]);

  // ==================== 删除历史记录 ====================
  const deleteHistoryItem = useCallback(async (id: string) => {
    try {
      const apiPath = sessionType === 'exam'
        ? `/api/store/exam-chat-history/${id}`
        : `/api/store/chat-history/${id}`;

      const response = await fetch(apiPath, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || '删除失败');
      }

      // 找到被删除记录的索引
      const deletedIndex = history.findIndex(h => h.id === id);
      
      // 如果删除的是当前查看的记录，需要切换到相邻记录
      if (selectedHistoryId === id) {
        const remainingHistory = history.filter(h => h.id !== id);
        
        if (remainingHistory.length > 0) {
          // 优先选择下一条，如果是最后一条则选上一条
          const nextIndex = deletedIndex < history.length - 1 ? deletedIndex : deletedIndex - 1;
          const nextHistory = remainingHistory[nextIndex >= remainingHistory.length ? remainingHistory.length - 1 : nextIndex];
          viewHistory(nextHistory.id);
        } else {
          // 没有其他记录了，清空消息列表
          setMessages([]);
          setSelectedHistoryId(null);
        }
      }

      // 更新本地历史记录列表
      setHistory((prev) => prev.filter(h => h.id !== id));
      
      message.success('聊天记录已删除');
    } catch (error) {
      console.error('[Chat History] 删除失败:', error);
      message.error(error instanceof Error ? error.message : '删除聊天记录失败，请重试');
    }
  }, [history, selectedHistoryId, sessionType, viewHistory]);

  return {
    // 消息相关
    messages,
    setMessages,
    streamingContent,
    isStreaming,
    isRequesting,
    
    // 操作函数
    sendPendingMessagesToAI,
    sendSingleMessageToAI,
    stopStreaming,
    
    // 历史记录
    history,
    selectedHistoryId,
    loadChatHistory,
    viewHistory,
    deleteHistoryItem,
    
    // 动画控制（如果组件需要单独控制）
    startAnimation,
    stopAnimation,
  };
}

