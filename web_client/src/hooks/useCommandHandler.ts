import { useCallback } from 'react';
import { message } from 'antd';
import { nanoid } from 'nanoid';
import { ChatMessage } from '@/types/api';
import type { ExamCommandMessage } from '@/types/webrtc';

export interface UseCommandHandlerOptions {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  sendPendingMessagesToAI: () => void;
  supportImage?: boolean;
  sessionType?: 'exam' | 'interview';
  onScrollCommand?: (direction: 'up' | 'down') => void;
}

export interface UseCommandHandlerResult {
  handleExamCommand: (commandMessage: ExamCommandMessage) => void;
}

/**
 * 自定义 Hook：处理来自 Electron 的命令
 * 支持截图、文本、快捷键命令
 * 
 * @param options - 配置选项
 * @returns 命令处理函数
 */
export function useCommandHandler(options: UseCommandHandlerOptions): UseCommandHandlerResult {
  const { setMessages, sendPendingMessagesToAI, supportImage = true, sessionType = 'exam', onScrollCommand } = options;

  // 添加图片到待发送消息
  const addImageToPendingMessages = useCallback((base64Image: string) => {
    const defaultText = sessionType === 'exam'
      ? '请回答这个笔试问题'
      : '请回答这个面试问题';

    const screenshotMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: supportImage
        ? [
          { type: 'text', text: defaultText },
          { type: 'image_url', image_url: { url: base64Image } }
        ]
        : defaultText,
      date: new Date().toISOString(),
      status: 'received',  // 使用 received 状态
      speaker: 'interviewer'
    };

    setMessages((prev) => [...prev, screenshotMessage]);
  }, [setMessages, supportImage, sessionType]);

  // 添加文本到待发送消息
  const addTextToPendingMessages = useCallback((text: string) => {
    const textMessage: ChatMessage = {
      id: nanoid(),
      role: 'user',
      content: text,
      date: new Date().toISOString(),
      status: 'received',  // 使用 received 状态
      speaker: 'interviewer',
    };

    setMessages((prev) => [...prev, textMessage]);
  }, [setMessages]);

  // 处理来自 Electron 的命令
  const handleExamCommand = useCallback((commandMessage: ExamCommandMessage) => {
    console.log(`[${sessionType === 'exam' ? 'ExamSession' : 'InterviewSession'}] 收到命令:`, commandMessage.type);

    switch (commandMessage.type) {
      case 'screenshot':
        // 添加图片到待发送区域
        addImageToPendingMessages(commandMessage.data);
        message.success('截图已添加到待发送区域');
        break;
      case 'text':
        // 添加文本到待发送区域
        addTextToPendingMessages(commandMessage.data);
        message.success('文本已添加到待发送区域');
        break;
      case 'quick-answer':
        // 触发"发送给 AI"
        sendPendingMessagesToAI();
        // message.info('正在发送给 AI...');
        break;
      case 'scroll-up':
        // 触发向上滚动
        if (onScrollCommand) {
          onScrollCommand('up');
        }
        break;
      case 'scroll-down':
        // 触发向下滚动
        if (onScrollCommand) {
          onScrollCommand('down');
        }
        break;
    }
  }, [sessionType, addImageToPendingMessages, addTextToPendingMessages, sendPendingMessagesToAI, onScrollCommand]);

  return {
    handleExamCommand,
  };
}

