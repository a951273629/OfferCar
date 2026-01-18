/**
 * 消息内容处理工具函数
 */

import { MultimodalContent } from '@/types/api';

/**
 * 将多模态内容转换为纯文本字符串
 * 
 * @param content - 消息内容（可能是字符串或多模态数组）
 * @returns 纯文本字符串
 * 
 * @example
 * // 纯文本
 * getMessageContent('Hello') // 返回: 'Hello'
 * 
 * // 多模态内容
 * getMessageContent([
 *   { type: 'text', text: 'Hello' },
 *   { type: 'image_url', image_url: { url: '...' } }
 * ]) 
 * // 返回: 'Hello\n[图片]'
 */
export function getMessageContent(content: string | MultimodalContent[]): string {
  if (typeof content === 'string') {
    return content;
  }
  
  // 如果是多模态内容数组，提取文本部分
  return content
    .map(item => {
      if (item.type === 'text') {
        return item.text || '';
      }
      if (item.type === 'image_url') {
        return '[图片]';  // 图片占位符
      }
      return '';
    })
    .filter(text => text.length > 0)
    .join('\n');
}

