'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Card, List, Typography, Button, Tooltip, message } from 'antd';
import {
  RobotOutlined,
  MenuUnfoldOutlined,
  CloseOutlined,
  CameraOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { ConversationHistory } from '@/types/conversation-history';
import { ChatMessage } from '@/types/api';
import { buildMarkdown, downloadMarkdownFile, sanitizeFilenamePart } from '@/lib/utils/markdownExport';

const { Text } = Typography;

interface ChatHistorySidebarProps {
  // 响应式
  isMobile: boolean;
  
  // 来自 useSidebarResize
  sidebarWidth: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleSidebarClick: () => void;
  
  // 来自 useChatSession
  history: ConversationHistory[];
  selectedHistoryId: string | null;
  viewHistory: (id: string) => void;
  deleteHistoryItem: (id: string) => void;
  messages: ChatMessage[];
  sessionType?: 'exam' | 'interview';
  sessionTitle?: string;
  
  // 删除确认回调
  onDeleteConfirm: (id: string, e: React.MouseEvent) => void;
}

const COLLAPSED_WIDTH = 30;
const FIXED_FOOTER_SPACE = 96; // 给列表底部预留空间，避免被 fixed 按钮遮挡

export function ChatHistorySidebar({
  isMobile,
  sidebarWidth,
  isResizing,
  handleMouseDown,
  handleSidebarClick,
  history,
  selectedHistoryId,
  viewHistory,
  onDeleteConfirm,
  messages: sessionMessages,
  sessionType,
  sessionTitle,
}: ChatHistorySidebarProps) {
  // 移动端不显示
  if (isMobile) {
    return null;
  }

  const isCollapsed = sidebarWidth === COLLAPSED_WIDTH;

  const exportMessages = sessionMessages.filter((m) => m.role !== 'system');
  const canExport = (!isCollapsed) && (exportMessages.length > 0 || history.length > 0);

  const sidebarRootRef = useRef<HTMLDivElement | null>(null);
  const [fixedPos, setFixedPos] = useState<{ left: number; width: number } | null>(null);

  const updateFixedPos = useCallback(() => {
    if (isCollapsed) {
      setFixedPos(null);
      return;
    }
    const el = sidebarRootRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const next = {
      left: Math.round(rect.left),
      width: Math.round(rect.width),
    };
    setFixedPos((prev) => {
      if (prev && prev.left === next.left && prev.width === next.width) {
        return prev;
      }
      return next;
    });
  }, [isCollapsed]);

  useEffect(() => {
    updateFixedPos();
  }, [updateFixedPos, sidebarWidth, isResizing, isCollapsed]);

  useEffect(() => {
    if (isCollapsed) {
      return;
    }
    const handler = () => updateFixedPos();
    window.addEventListener('resize', handler);
    // 捕获滚动，避免页面滚动导致 left/width 失真
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [updateFixedPos, isCollapsed]);

  const handleExportMarkdown = () => {
    if (!canExport) {
      return;
    }

    const now = new Date();
    const markdown = buildMarkdown({
      sessionType,
      sessionTitle,
      messages: exportMessages,
      histories: history,
    });

    const pad2 = (n: number) => String(n).padStart(2, '0');
    const ts = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}${pad2(now.getSeconds())}`;
    const fileTitle = sanitizeFilenamePart(sessionTitle || (sessionType === 'exam' ? 'exam' : sessionType === 'interview' ? 'interview' : 'session'));
    const filename = `${fileTitle}-${ts}.md`;

    try {
      downloadMarkdownFile(markdown, filename);
      message.success('已导出 Markdown 文件');
    } catch (e) {
      console.error('[Export Markdown] 导出失败:', e);
      message.error('导出失败，请重试');
    }
  };

  return (
    <>
      <div ref={sidebarRootRef} style={{ position: 'relative', display: 'flex' }}>

        <Card
          title={isCollapsed ? null : "对话历史"}
          onClick={handleSidebarClick}
          styles={{
            body: {
              padding: isCollapsed ? 0 : undefined,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
            },
          }}
          style={{
            width: `${sidebarWidth}px`,
            overflow: 'hidden',
            cursor: isCollapsed ? 'pointer' : 'default',
            transition: isResizing ? 'none' : 'width 0.3s ease',
            height: '100%',
          }}
        >
          {isCollapsed ? (
            // 折叠状态：只显示图标
            <div style={{
              textAlign: 'center',
              writingMode: 'vertical-rl',
            }}>
              <MenuUnfoldOutlined style={{ fontSize: 20 }} />
            </div>
          ) : (
            // 展开状态：显示完整内容
            <>
              <div style={{ flex: 1, overflow: 'auto', paddingBottom: FIXED_FOOTER_SPACE }}>
                {history.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
                    <RobotOutlined style={{ fontSize: 32, marginBottom: 8 }} />
                    <div>暂无对话记录</div>
                    <div style={{ marginTop: 16, color: '#999', fontSize: 14 }}>
                      点击右上角"连接设备"开始面试
                    </div>
                  </div>
                ) : (
                  <List
                    dataSource={history}
                    renderItem={(item) => (
                      <List.Item
                        key={item.id}
                        onClick={() => viewHistory(item.id)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: selectedHistoryId === item.id ? 'var(--color-list-item-selected)' : 'transparent',
                          borderRadius: '8px',
                          padding: '12px',
                          marginBottom: '8px',
                          transition: 'background-color 0.3s',
                          position: 'relative',
                        }}
                        className="history-item"
                      >
                        <List.Item.Meta
                          title={
                            <Text ellipsis style={{ fontSize: 13, fontWeight: 500 }}>
                              {item.questionImage && <><CameraOutlined /> </>}
                              {item.question.substring(0, 30)}...
                            </Text>
                          }
                          description={
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </Text>
                          }
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<CloseOutlined />}
                          onClick={(e) => onDeleteConfirm(item.id, e)}
                          style={{
                            position: 'absolute',
                            bottom: '5px',
                            right: '8px',
                            opacity: 0.6,
                            transition: 'opacity 0.2s',
                          }}
                          className="delete-button"
                        />
                      </List.Item>
                    )}
                  />
                )}
              </div>
            </>
          )}
        </Card>

      {/* 拖动手柄 */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: '4px',
            cursor: 'ew-resize',
            background: isResizing ? '#1677ff' : 'transparent',
            transition: 'background 0.2s',
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = '#d9d9d9';
            }
          }}
          onMouseLeave={(e) => {
            if (!isResizing) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        />
      )}

      </div>

      {/* 导出按钮：固定在视口底部，避免被 Card 的 overflow 裁剪 */}
      {!isCollapsed && fixedPos && (
        <div
          style={{
            position: 'fixed',
            left: fixedPos.left,
            width: fixedPos.width,
            bottom: 0,
            zIndex: 1000,
            background: 'var(--color-bg-container)',
            borderTop: '1px solid var(--color-border-secondary)',
            padding: 12,
            boxSizing: 'border-box',
          }}
        >
          <Tooltip title={canExport ? '导出当前会话为 Markdown 文件' : '暂无可导出的消息/摘要'}>
            <Button
              type="primary"
              block
              icon={<DownloadOutlined />}
              onClick={handleExportMarkdown}
              disabled={!canExport}
            >
              导出 Markdown
            </Button>
          </Tooltip>
        </div>
      )}
    </>
  );
}

