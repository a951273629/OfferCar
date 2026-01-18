'use client';

/**
 * Markdown 导出工具函数
 *
 * 注意：
 * - `downloadMarkdownFile` 依赖浏览器 DOM（document/URL/Blob），因此此文件标记为 client-only。
 * - 图片支持：对 dataURL / http(s) / blob URL 直接保留；其它字符串默认按 base64 PNG 组装为 dataURL。
 */

import { ChatMessage } from '@/types/api';
import { ConversationHistory } from '@/types/conversation-history';

export function sanitizeFilenamePart(input: string) {
  const value = (input || '').trim();
  if (!value) {
    return 'session';
  }
  return value.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
}

export function toDataUrlIfNeeded(url: string) {
  const value = (url || '').trim();
  if (!value) {
    return '';
  }
  if (value.startsWith('data:')) {
    return value;
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  if (value.startsWith('blob:')) {
    return value;
  }
  // 默认按 base64 的 png 处理（项目中截图多为 png）
  return `data:image/png;base64,${value}`;
}

function roleLabel(role: ChatMessage['role']) {
  if (role === 'user') return 'user';
  if (role === 'assistant') return 'assistant';
  if (role === 'system') return 'system';
  return role;
}

function speakerLabel(speaker?: ChatMessage['speaker']) {
  if (!speaker) return '';
  if (speaker === 'interviewer') return '面试官';
  if (speaker === 'interviewee') return '面试者';
  return '';
}

export function renderContentToMarkdown(content: ChatMessage['content']) {
  if (typeof content === 'string') {
    return content;
  }

  const parts: string[] = [];
  for (const item of content) {
    if (item.type === 'text') {
      const text = (item.text || '').trimEnd();
      if (text) {
        parts.push(text);
      }
      continue;
    }
    if (item.type === 'image_url') {
      const url = toDataUrlIfNeeded(item.image_url?.url || '');
      if (url) {
        parts.push(`![](${url})`);
      } else {
        parts.push('[图片]');
      }
    }
  }
  return parts.join('\n\n');
}

export function buildMarkdown(params: {
  sessionType?: 'exam' | 'interview';
  sessionTitle?: string;
  messages: ChatMessage[];
  histories: ConversationHistory[];
}) {
  const { sessionType, sessionTitle, messages: msgs, histories } = params;

  const now = new Date();
  const lines: string[] = [];

  lines.push(`# ${sessionTitle || '会话导出'}`);
  lines.push(`- 会话类型：${sessionType === 'exam' ? '笔试' : sessionType === 'interview' ? '面试' : '未知'}`);
  lines.push(`- 导出时间：${now.toLocaleString()}`);

  lines.push('');
  lines.push('## 当前会话消息');

  if (msgs.length < 1) {
    lines.push('（暂无消息）');
  } else {
    msgs.forEach((m, idx) => {
      const speaker = speakerLabel(m.speaker);
      const who = speaker ? `${roleLabel(m.role)}（${speaker}）` : roleLabel(m.role);
      const time = m.date ? new Date(m.date).toLocaleString() : '';

      lines.push('');
      lines.push(`### ${idx + 1}. ${who}`);
      if (time) {
        lines.push(`- 时间：${time}`);
      }
      if (m.isError) {
        lines.push(`- 标记：错误消息`);
      }
      lines.push('');
      lines.push(renderContentToMarkdown(m.content));
    });
  }

  lines.push('');
  lines.push('## 全部历史记录');
  if (!Array.isArray(histories) || histories.length < 1) {
    lines.push('（暂无历史记录）');
  } else {
    histories.forEach((h, idx) => {
      const time = h.timestamp ? new Date(h.timestamp).toLocaleString() : '';
      lines.push('');
      lines.push(`### ${idx + 1}. ${time ? time : '历史记录'}`);
      lines.push('');
      lines.push('#### 问题');
      lines.push('');
      lines.push(h.question || '');
      if (h.questionImage) {
        lines.push('');
        lines.push(`![](${toDataUrlIfNeeded(h.questionImage)})`);
      }
      lines.push('');
      lines.push('#### 回答');
      lines.push('');
      lines.push(h.answer || '');
    });
  }

  return lines.join('\n');
}

export function downloadMarkdownFile(markdown: string, filename: string) {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


