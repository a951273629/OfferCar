/**
 * Markdown 消息渲染组件
 * 支持代码高亮和语法高亮
 */

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownMessageProps {
  content: string;
}

/**
 * 渲染 Markdown 格式的消息内容
 * - 支持代码块语法高亮
 * - 支持行内代码
 * - 支持标准 Markdown 语法
 * - 移动端响应式：自动换行，不溢出
 */
export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        wordWrap: 'break-word',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        overflow: 'hidden',
      }}
    >
      <ReactMarkdown
        components={{
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || '');
            const inline = !className;
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                wrapLongLines={true}
                customStyle={{
                  maxWidth: '100%',
                  overflow: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} style={{ wordBreak: 'break-word' }}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

