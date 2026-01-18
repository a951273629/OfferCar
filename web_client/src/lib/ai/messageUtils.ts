/**
 * AI 消息处理工具函数
 * 提供滑动窗口、过滤等功能（32K上下文窗口优化）
 */

import { ChatMessage } from '@/types/api';

/**
 * 过滤出对话消息（user 和 assistant）
 * 排除 system 消息和未发送状态的消息
 * 
 * @param messages - 原始消息列表
 * @returns 过滤后的对话消息
 */
export function filterConversationMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(msg => 
    (msg.role === 'user' || msg.role === 'assistant') && 
    msg.status !== 'pending' && 
    msg.status !== 'received'
  );
}

/**
 * 滑动窗口：提取最近 N 轮对话
 * 1 轮 = 1 个 user 消息 + 1 个 assistant 消息
 * 
 * 用于32K上下文窗口优化：保留最近5轮（10条消息）
 * 
 * @param messages - 消息列表
 * @param maxRounds - 最大轮数（默认 5）
 * @returns 最近的消息列表
 */
export function getRecentMessages(
  messages: ChatMessage[],
  maxRounds: number = 5
): ChatMessage[] {
  // 过滤出对话消息
  const conversationMessages = filterConversationMessages(messages);

  // 如果消息数量不超过限制，直接返回
  const maxMessages = maxRounds * 2; // 5轮 = 10条消息
  if (conversationMessages.length <= maxMessages) {
    return conversationMessages;
  }

  // 从末尾提取最近的消息
  return conversationMessages.slice(-maxMessages);
}

