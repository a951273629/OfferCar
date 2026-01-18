'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, Button, Space, Typography, List, Tooltip, Modal, message } from 'antd';
import {
  RobotOutlined,
  StopOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ChatMessage } from '@/types/api';
import { getMessageContent } from './functions/messageUtils';
import { MarkdownMessage } from './functions/MarkdownMessage';
import { LLmModeShift, LLmMode } from './LLmModeShift';
import { DEFAULT_GLOBAL_CONFIG, GlobalConfig } from '@/types';
import { api } from '@/lib/utils/api';
import { ConfigPage } from '@/components/common/ConfigPage';
import { KnowledgeAssistiveTouch } from '@/components/common/KnowledgeAssistiveTouch';

const { Title, Text } = Typography;

interface SessionMainContentProps {
  // 会话基本信息
  sessionType: 'exam' | 'interview';
  sessionTitle: string;
  position: string;
  
  // 响应式
  isMobile: boolean;
  
  // 消息相关（来自 useChatSession）
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  isRequesting: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  
  // 模型模式（来自父组件状态）
  modelMode: LLmMode;
  onModelModeChange: (mode: LLmMode) => void;
  
  // 操作回调
  sendPendingMessagesToAI: () => void;
  sendSingleMessageToAI?: (messageId: string) => void;
  stopStreaming: () => void;
  onDeleteMessage?: (messageId: string) => void;
  
  // 会话标识（在你最新定义下：ownerId = examId / interviewId）
  ownerId: number;

  // 局内设置弹窗（可选：受控/半受控）
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;

  // 会话配置变更通知（加载/保存成功后回传给父组件）
  onSessionConfigChange?: (config: GlobalConfig) => void;
}

export function SessionMainContent({
  sessionType,
  // sessionTitle,
  // position,
  isMobile,
  messages,
  streamingContent,
  isStreaming,
  isRequesting,
  messagesEndRef,
  modelMode,
  onModelModeChange,
  sendPendingMessagesToAI,
  sendSingleMessageToAI,
  stopStreaming,
  ownerId,
  settingsOpen: settingsOpenProp,
  onSettingsOpenChange,
  onSessionConfigChange,
  onDeleteMessage,
}: SessionMainContentProps) {
  const fixedBottomBarHeight = isMobile ? 104 : 96; // 预留给 fixed 底部栏的高度，避免消息被遮挡

  // AI 流式占位（最小高度=一屏），用于快答后提前腾出可视空间且确保 AI 气泡不被“空白”顶走
  const [streamPlaceholderMinHeight, setStreamPlaceholderMinHeight] = useState<number>(0);
  const streamPlaceholderRef = useRef<HTMLDivElement>(null);
  const prevRequestingRef = useRef<boolean>(false);
  const prevStreamingRef = useRef<boolean>(false);

  // 右侧主内容区域定位：用于 fixed 底部栏不覆盖左侧历史栏
  const mainRootRef = useRef<HTMLDivElement | null>(null);
  const [fixedPos, setFixedPos] = useState<{ left: number; width: number } | null>(null);

  const updateFixedPos = useCallback(() => {
    const el = mainRootRef.current;
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
  }, []);

  useEffect(() => {
    updateFixedPos();
  }, [updateFixedPos]);

  useEffect(() => {
    const handler = () => updateFixedPos();
    window.addEventListener('resize', handler);
    // 捕获滚动，避免页面/父容器滚动导致 left/width 失真
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [updateFixedPos]);

  // 局内设置
  const [internalSettingsOpen, setInternalSettingsOpen] = useState(false);
  const [sessionConfig, setSessionConfig] = useState<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const sessionConfigRef = useRef<GlobalConfig>(DEFAULT_GLOBAL_CONFIG);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  const settingsOpen = settingsOpenProp !== undefined ? settingsOpenProp : internalSettingsOpen;

  const setSettingsOpen = (open: boolean) => {
    onSettingsOpenChange?.(open);
    if (settingsOpenProp === undefined) {
      setInternalSettingsOpen(open);
    }
  };

  // 手势检测
  const swipeRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number;
    messageId: string;
  } | null>(null);

  const sessionConfigEndpoint = useMemo(() => {
    return sessionType === 'exam'
      ? `/exam/${ownerId}/config`
      : `/interview/${ownerId}/config`;
  }, [sessionType, ownerId]);

  // 加载会话配置（ownerId = examId / interviewId）
  useEffect(() => {
    const run = async () => {
      try {
        const result = await api.get<{ sessionConfig: GlobalConfig }>(sessionConfigEndpoint);
        const nextConfig = result.sessionConfig || DEFAULT_GLOBAL_CONFIG;
        setSessionConfig(nextConfig);
        sessionConfigRef.current = nextConfig;
        onSessionConfigChange?.(nextConfig);
      } catch (error) {
        console.warn('[SessionMainContent] 加载会话配置失败:', error);
      }
    };
    run();
  }, [sessionConfigEndpoint, onSessionConfigChange]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, []);

  const saveSessionConfigLatest = useCallback(async () => {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;
    try {
      const result = await api.put<{ sessionConfig: GlobalConfig }>(sessionConfigEndpoint, {
        sessionConfig: sessionConfigRef.current,
      });
      const nextConfig = result.sessionConfig || sessionConfigRef.current;
      setSessionConfig(nextConfig);
      sessionConfigRef.current = nextConfig;
      onSessionConfigChange?.(nextConfig);
      message.success({
        content: '已自动保存',
        key: 'sessionConfigAutoSave',
        duration: 1,
      });
    } catch (error) {
      console.warn('[SessionMainContent] 保存会话配置失败:', error);
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // 确保最后一次修改一定会落库
        void saveSessionConfigLatest();
      }
    }
  }, [onSessionConfigChange, sessionConfigEndpoint]);

  const handleSessionConfigChange = useCallback(
    (patch: Partial<GlobalConfig>) => {
      setSessionConfig((prev) => {
        const next = { ...prev, ...patch };
        sessionConfigRef.current = next;
        return next;
      });

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      autosaveTimerRef.current = setTimeout(() => {
        void saveSessionConfigLatest();
      }, 500);
    },
    [saveSessionConfigLatest],
  );

  const getUserBubbleStyle = (item: ChatMessage) => {
    const isInterview = sessionType === 'interview';
    const isInterviewer = isInterview && item.speaker === 'interviewer';
    const isInterviewee = isInterview && item.speaker === 'interviewee';

    const fontSize = isInterview
      ? (item.status === 'sent'
          ? sessionConfig.interviewerFontSize
          : (isInterviewer ? sessionConfig.interviewerFontSize : sessionConfig.intervieweeFontSize))
      : sessionConfig.userFontSize;

    return {
      backgroundColor: isInterview
        ? (isInterviewer ? 'var(--color-message-interviewer)' : 'var(--color-message-interviewee)')
        : 'var(--color-message-user)',
      fontSize,
    };
  };

  const getAiBubbleStyle = () => {
    return {
      backgroundColor: 'var(--color-message-assistant)',
      fontSize: sessionConfig.aiFontSize,
    };
  };

  const handlePointerDown = (e: React.PointerEvent, item: ChatMessage) => {
    if (!sessionConfig.gestureEnabled) {
      return;
    }
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') {
      return;
    }
    if (item.role !== 'user') {
      return;
    }

    swipeRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
      messageId: item.id,
    };

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const swipe = swipeRef.current;
    if (!swipe || !swipe.active || swipe.pointerId !== e.pointerId) {
      return;
    }

    const dx = e.clientX - swipe.startX;
    const dy = e.clientY - swipe.startY;

    swipeRef.current = null;

    // Guard Clause：优先过滤垂直滑动
    if (Math.abs(dy) > 30) {
      return;
    }

    // 左滑删除
    if (dx <= -80) {
      if (!onDeleteMessage) {
        message.warning('当前页面不支持删除消息');
        return;
      }
      onDeleteMessage(swipe.messageId);
      message.success('消息已删除');
      return;
    }

    // 右滑发送单条给 AI
    if (dx >= 80) {
      if (!sendSingleMessageToAI) {
        message.warning('当前页面不支持单条发送');
        return;
      }
      sendSingleMessageToAI(swipe.messageId);
      return;
    }
  };

  // 获取消息状态显示文本（根据 sessionType 和 scopeCharacter）
  const getStatusText = (status: string | undefined, speaker?: string) => {
    if (!status) {
      return '';
    }

    if (status === 'pending') {
      return '识别中...';
    }

    if (status === 'received') {
      if (sessionType === 'interview') {
        // 面试模式：判断是否忽略面试者消息
        if (sessionConfig.scopeCharacter && speaker === 'interviewee') {
          return '(忽略)';
        }
        return '(未发送）';
      }
      // 笔试模式
      return '（未发送）';
    }

    if (status === 'sent') {
      return '已发送';
    }

    return '';
  };

  // 获取状态显示颜色
  const getStatusColor = (status: string | undefined) => {
    if (!status) {
      return undefined;
    }

    if (status === 'pending') {
      return '#fa8c16';  // 橙色
    }

    if (status === 'sent') {
      return '#52c41a';  // 绿色
    }

    return undefined;  // 默认颜色
  };

  // 判断快答按钮是否禁用
  const isQuickAnswerDisabled = () => {
    if (isStreaming) {
      return false;
    }

    if (sessionType === 'exam') {
      // 笔试模式：检查是否有 pending/received 状态的消息
      return messages.filter(m => m.status === 'pending' || m.status === 'received').length === 0;
    }

    // 面试模式：检查是否有 pending/received 状态的消息
    const candidates = messages.filter(m => m.status === 'pending' || m.status === 'received');
    
    // 如果 scopeCharacter 为 true，仅考虑面试官消息
    if (sessionConfig.scopeCharacter) {
      return candidates.filter(m => m.speaker === 'interviewer').length === 0;
    }
    
    return candidates.length === 0;
  };

  // 快答触发后：立即设置 AI 占位一屏并滚动到 AI 占位区域（isRequesting false -> true）
  // 流式结束后：清空占位（isStreaming true -> false）
  useEffect(() => {
    const wasRequesting = prevRequestingRef.current;
    const wasStreaming = prevStreamingRef.current;

    // 1) 快答开始：计算一屏高度并滚到 AI 占位
    if (!wasRequesting && isRequesting) {
      const endEl = messagesEndRef.current;
      const scrollContainer = endEl?.closest('.ant-card') as HTMLElement | null;
      if (scrollContainer) {
        setStreamPlaceholderMinHeight(scrollContainer.clientHeight*0.9);
        requestAnimationFrame(() => {
          if (streamPlaceholderRef.current) {
            streamPlaceholderRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
          }
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    }

    // 2) 流式结束：清空占位
    if (wasStreaming && !isStreaming) {
      setStreamPlaceholderMinHeight(0);
    }

    prevRequestingRef.current = isRequesting;
    prevStreamingRef.current = isStreaming;
  }, [isRequesting, isStreaming, messagesEndRef]);

  return (
    <div ref={mainRootRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>


      {/* 消息显示区 */}
      <Card
        styles={{
          body: {
            padding: isMobile ? 0 : 24,
          },
        }}
        style={{
          flex: 1,
          overflow: 'auto',
          margin: 0,
          paddingBottom: fixedBottomBarHeight + 24,
        }}
      >
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <RobotOutlined style={{ fontSize: 48, color: '#7c3aed', marginBottom: 16 }} />
            <div style={{ marginBottom: 24 }}>
              <Text type="secondary" style={{ fontSize: 16 }}>
                <p>点击右上角"连接设备"开始面试/笔试</p>
              </Text>
              <Text type="secondary" style={{ fontSize: 16 }}>
                <p>Ctrl + Shift + 回车触发面试/笔试回答</p>
              </Text>
              <Text type="secondary" style={{ fontSize: 16 }}>
                <p>Ctrl + Shift + 空格截取电脑屏幕并读取内容（需要做题时可使用）</p>
              </Text>
              <Text type="secondary" style={{ fontSize: 16 }}>
                <p>您可以主动复述问题后再生成回答；</p>
              </Text>
            </div>
          </div>
        ) : (
          <>
            <List
              dataSource={messages}
              renderItem={(item) => (
                <List.Item
                  style={{
                    justifyContent: item.role === 'user' ? 'flex-end' : 'flex-start',
                    border: 'none',
                    padding: '12px 0',
                  }}
                >
                  <Space
                    direction="horizontal"
                    style={{
                      flexDirection: item.role === 'user' ? 'row-reverse' : 'row',
                      width: '100%',
                      maxWidth: '100%'
                    }}
                    align="start"
                  >
                    <div
                      style={{
                        minWidth: '80%',
                        maxWidth: '100%',
                        padding: '12px 16px',
                        borderRadius: 8,
                        ...(item.role === 'user' ? getUserBubbleStyle(item) : getAiBubbleStyle()),
                        overflowWrap: 'break-word',
                        wordBreak: 'break-word',
                      }}
                      onPointerDown={(e) => handlePointerDown(e, item)}
                      onPointerUp={handlePointerUp}
                    >
                      {item.role === 'user' ? (
                        <>
                          {/* 面试模式：显示说话人标签 */}
                          {sessionType === 'interview' && item.speaker && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                              {item.speaker === 'interviewee' ? ' 面试者' : ' 面试官'}
                            </Text>
                          )}
                          <Text style={{ whiteSpace: 'pre-wrap', fontSize: getUserBubbleStyle(item).fontSize }}>{getMessageContent(item.content)}</Text>
                          {/* 显示截图预览 */}
                          {Array.isArray(item.content) && item.content.find(c => c.type === 'image_url') && (
                            <div style={{ marginTop: 8 }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.content.find(c => c.type === 'image_url')?.image_url?.url}
                                alt="截图"
                                style={{ maxWidth: '100%', borderRadius: 4, border: '1px solid var(--color-border)' }}
                              />
                            </div>
                          )}
                          {/* 根据状态显示不同提示 */}
                          {item.status === 'pending' && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, color: getStatusColor(item.status) }}>
                              <ClockCircleOutlined /> {getStatusText(item.status, item.speaker)}
                            </Text>
                          )}
                          {item.status === 'received' && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                              <CheckCircleOutlined /> 已识别{getStatusText(item.status, item.speaker)}
                            </Text>
                          )}
                          {item.status === 'sent' && (
                            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4, color: getStatusColor(item.status) }}>
                              <CheckCircleOutlined /> {getStatusText(item.status, item.speaker)}
                            </Text>
                          )}
                        </>
                      ) : (
                        <>
                          <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                            <RobotOutlined />
                          </Text>
                          <div style={{ fontSize: getAiBubbleStyle().fontSize }}>
                            <MarkdownMessage content={getMessageContent(item.content)} />
                          </div>
                        </>
                      )}
                    </div>
                  </Space>
                </List.Item>
              )}
            />

            {/* 流式消息显示 */}
            {isStreaming && (
              <List.Item
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  padding: '12px 0',
                }}
              >
                <Space
                  direction="horizontal"
                  align="start"
                  style={{ width: '100%', maxWidth: '100%' }}
                >
                  <div
                    style={{
                      minWidth: '80%',
                      maxWidth: '100%',
                      minHeight: streamPlaceholderMinHeight > 0 ? streamPlaceholderMinHeight : undefined,
                      borderRadius: 8,
                      backgroundColor: 'transparent',  // AI 助手消息背景色
                      position: 'relative',
                      overflowWrap: 'break-word',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div ref={streamPlaceholderRef} />
                    {streamingContent && streamingContent.trim().length > 0 ? (
                      <MarkdownMessage content={streamingContent} />
                    ) : (
                      <div style={{ padding: '12px 16px' }}>
                        <Text type="secondary"> 正在生成...</Text>
                      </div>
                    )}
                    {/* 闪烁光标 */}
                    <span
                      style={{
                        animation: 'blink 1s infinite',
                        marginLeft: 2,
                        fontWeight: 'bold',
                      }}
                    >
                      |
                    </span>
                  </div>
                </Space>
              </List.Item>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </Card>

      {/* 底部快答按钮和模式选择器 */}
      <div
        style={{
          position: 'fixed',
          left: fixedPos ? fixedPos.left : 0,
          width: fixedPos ? fixedPos.width : '100%',
          bottom: 0,
          zIndex: 1000,
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--color-bg-container)',
          borderTop: '1px solid var(--color-border-secondary)',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '16px',
            minWidth: 0,
          }}
        >
          {/* 模式选择器 */}
          <LLmModeShift
            value={modelMode}
            onChange={onModelModeChange}
            size={isMobile ? 'small' : 'middle'}
          />

          {/* 快答/停止生成按钮 */}
          <Button
            type={isStreaming ? 'default' : 'primary'}
            danger={isStreaming}
            size={isMobile ? 'middle' : 'large'}
            icon={isStreaming ? <StopOutlined /> : <ThunderboltOutlined />}
            onClick={() => {
              if (process.env.NODE_ENV === 'development') {
                console.log('[UI] QuickAnswerButton click:', { isStreaming, isRequesting });
              }
              if (isStreaming) {
                stopStreaming();
                return;
              }
              sendPendingMessagesToAI();
            }}
            // antd Button 在 loading 状态下会禁用点击；流式期间需要允许点击“停止生成”
            loading={!isStreaming && isRequesting}
            disabled={!isStreaming && isQuickAnswerDisabled()}
            style={{ minWidth: isMobile ? 120 : 200 }}
          >
            {isStreaming ? '停止生成' : '快答'}
          </Button>
        </div>

        {/* 局内设置（桌面端：固定最右；移动端：入口移至顶栏） */}
        {!isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <Tooltip title="局内设置">
              <Button
                icon={<SettingOutlined />}
                size="large"
                onClick={() => setSettingsOpen(true)}
              >
                设置
              </Button>
            </Tooltip>
          </div>
        )}
      </div>

      <Modal
        title="局内设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        footer={null}
        maskClosable={false}
        keyboard={false}
        width={isMobile ? '95vw' : 640}
      >
        <ConfigPage
          config={sessionConfig}
          onChange={handleSessionConfigChange}
        />
      </Modal>

      {/* 知识库辅助触控悬浮窗：可拖动吸附 + 列表/预览 Modal；快答触发时自动关闭 */}
      <KnowledgeAssistiveTouch
        sessionType={sessionType}
        ownerId={ownerId}
        isRequesting={isRequesting}
        bottomSafe={fixedBottomBarHeight + 16}
      />
    </div>
  );
}

