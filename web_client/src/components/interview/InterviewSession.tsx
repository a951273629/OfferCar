'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Tooltip, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
import { PairingCodeDisplay } from '../common/PairingCodeDisplay';
import { ShortcutGuideModal } from '../common/ShortcutGuideModal';
import { DeviceStatusPanel } from '../common/DeviceStatusPanel';
import { LLmMode } from '../common/LLmModeShift';
import { ChatHistorySidebar } from '../common/ChatHistorySidebar';
import { SessionMainContent } from '../common/SessionMainContent';
import { useChatSession } from '@/hooks/useChatSession';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSidebarResize } from '@/hooks/useSidebarResize';
import { useCommandHandler } from '@/hooks/useCommandHandler';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useInterviewSession } from '@/hooks/useInterviewSession';
import { useSessionContext } from '@/hooks/useSessionContext';
import { useConnectionGuide } from '@/hooks/useConnectionGuide';
import { mockInterviewMessages } from '@/mocks/interviewMessages';
import { useAppSelector } from '@/store/hooks';
import { selectGlobalConfig } from '@/store/settingsSlice';
import Guide from 'byte-guide';
import { api } from '@/lib/utils/api';
import { DEFAULT_GLOBAL_CONFIG, GlobalConfig } from '@/types';

interface InterviewSessionProps {
  interviewId: number;
  interviewTitle: string;
  position: string;
  language: string;
}

export function InterviewSession({
  interviewId,
  interviewTitle,
  position,
  language
}: InterviewSessionProps) {
  // 使用 App hook 获取上下文方法（用于 modal 等静态方法）
  const { modal } = App.useApp();
  const router = useRouter();

  // 响应式检测
  const isMobile = useMediaQuery('(max-width: 768px)');

  // 移动端：局内设置弹窗（由 SessionMainContent 受控）
  const [settingsOpen, setSettingsOpen] = useState(false);

  const globalConfig = useAppSelector(selectGlobalConfig);

  // 会话配置（用于实时过滤 interviewee 消息）
  const [sessionConfig, setSessionConfig] = useState<GlobalConfig | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const result = await api.get<{ sessionConfig: GlobalConfig }>(`/interview/${interviewId}/config`);
        setSessionConfig(result.sessionConfig || DEFAULT_GLOBAL_CONFIG);
      } catch (error) {
        // 会话配置接口失败时，退化为全局配置
        console.warn('[InterviewSession] 加载会话配置失败，使用全局配置:', error);
        setSessionConfig(null);
      }
    };
    run();
  }, [interviewId]);

  const effectiveShowIntervieweeMessages =
    (sessionConfig?.showIntervieweeMessages ?? globalConfig.showIntervieweeMessages);

  const effectiveBilingualEnable =
    (sessionConfig?.bilingualEnable ?? globalConfig.bilingualEnable);

  const effectiveScopeCharacter =
    (sessionConfig?.scopeCharacter ?? globalConfig.scopeCharacter);

  // 模型模式状态（从 localStorage 初始化）
  const [modelMode, setModelMode] = useState<LLmMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('llmMode');
      return (saved as LLmMode) || 'general';
    }
    return 'general';
  });

  // 监听 localStorage 变化（跨组件同步）
  useEffect(() => {
    const handleStorageChange = () => {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('llmMode');
        if (saved) {
          setModelMode(saved as LLmMode);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 加载会话上下文（知识库、简历等）
  const { contextData, isLoading: isLoadingContext } = useSessionContext({
    sessionId: interviewId,
    sessionType: 'interview',
  });

  // 使用聊天会话 Hook
  const {
    messages,
    setMessages,
    streamingContent,
    isStreaming,
    isRequesting,
    sendPendingMessagesToAI,
    sendSingleMessageToAI,
    stopStreaming,
    history,
    selectedHistoryId,
    viewHistory,
    deleteHistoryItem,
  } = useChatSession({
    sessionId: interviewId,
    sessionType: 'interview',
    position,
    supportImage: true,  // 面试支持截图
    contextData,  // 传递上下文数据
    modelMode,  // 传递模型模式
    bilingualEnable: effectiveBilingualEnable,
    scopeCharacter: effectiveScopeCharacter,
  });

  // 使用侧边栏调整大小 Hook
  const {
    sidebarWidth,
    isResizing,
    handleMouseDown,
    handleSidebarClick,
    collapseSidebar,
  } = useSidebarResize({
    isMobile,
    initialWidth: 320,
    collapsedWidth: 30,
  });

  // 使用自动滚动 Hook
  const { messagesEndRef, manualScroll, scrollToBottomIfNeeded, enableAutoScroll } = useAutoScroll();

  // 使用命令处理 Hook
  const { handleExamCommand } = useCommandHandler({
    setMessages,
    sendPendingMessagesToAI,
    supportImage: true,  // 启用图片支持
    sessionType: 'interview',
    onScrollCommand: manualScroll,
  });

  // 使用面试会话 Hook
  const {
    deviceStatus,
    pairingCode,
    connectionState,
    microphoneVolume,
    systemAudioVolume,
    isModalVisible,
    setIsModalVisible,
    toggleDevice,
    disconnectWebRTC,
    connectWebRTC,
  } = useInterviewSession({
    setMessages,
    onExamCommand: handleExamCommand,
    showIntervieweeMessages: effectiveShowIntervieweeMessages,
  });

  // 快捷键指南弹窗状态（保留在组件中的简单 UI 状态）
  const [isShortcutGuideVisible, setIsShortcutGuideVisible] = useState(false);

  // 使用连接设备引导 Hook
  const {
    guideVisible,
    steps,
    handleClose: handleGuideClose,
    beforeStepChange,
    afterStepChange,
  } = useConnectionGuide({ isModalVisible });

  // WebRTC 连接成功时自动折叠侧边栏
  useEffect(() => {
    if (connectionState === 'connected' && !isMobile) {
      collapseSidebar();
    }
  }, [connectionState, isMobile, collapseSidebar]);

  // 智能滚动逻辑：仅在 AI 消息或流式输出时触发
  useEffect(() => {
    // 1. 流式内容变化时滚动
    if (streamingContent) {
      scrollToBottomIfNeeded();
      return;
    }

    // 2. 新增消息且最后一条不是用户消息时滚动
    // if (messages.length < 1) return;

    // const lastMessage = messages[messages.length - 1];
    // if (lastMessage.role !== 'user') {
    //   scrollToBottomIfNeeded();
    // }
  }, [messages, streamingContent, scrollToBottomIfNeeded]);

  // 监听 isRequesting 状态，在发送消息时恢复自动滚动
  useEffect(() => {
    if (isRequesting) {
      enableAutoScroll();
    }
  }, [isRequesting, enableAutoScroll]);

  // 拦截浏览器返回/前进操作
  useEffect(() => {
    // 添加一个历史记录状态
    window.history.pushState({ interviewSession: true }, '');

    const handlePopState = (e: PopStateEvent) => {
      // 重新推入当前状态，阻止默认导航
      window.history.pushState({ interviewSession: true }, '');

      // 显示确认对话框
      modal.confirm({
        title: '确认离开面试',
        content: '您确定要离开面试呢吗？客户端连接会立即断开，未发送的消息会丢失。',
        okText: '确认离开面试',
        cancelText: '继续面试',
        onOk() {
          // 直接路由到面试列表页
          router.push('/interview');
        },
        onCancel() {
          // 用户取消，什么都不做（已经重新推入了状态）
        },
      });
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [modal, router]);

  // 开发环境自动加载模拟数据
  const mockDataLoadedRef = useRef(false);

  useEffect(() => {
    // 仅在开发环境、消息为空且未加载过模拟数据时执行
    if (
      process.env.NODE_ENV === 'development' &&
      messages.length === 0 &&
      !mockDataLoadedRef.current
    ) {
      console.log('[开发环境] 自动加载模拟面试数据...');
      setMessages(mockInterviewMessages);
      mockDataLoadedRef.current = true;
    }
  }, [messages.length, setMessages]);

  // 删除历史记录确认对话框
  const showDeleteConfirm = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发列表项的点击事件
    modal.confirm({
      title: '确认删除',
      content: '此操作将永久删除该对话记录，且不可恢复。确定要删除吗？',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        deleteHistoryItem(id);
      },
    });
  };

  return (
    <>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column',top:'0px' }}>
        {/* 移动端：DeviceStatusPanel 在最顶部 */}
        {isMobile && (
          <div style={{
            padding: '8px 16px',
            borderBottom: '1px solid var(--color-border-secondary)',
            background: 'var(--color-bg-container)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}>
            <DeviceStatusPanel
              deviceStatus={{ local: deviceStatus.local, remote: deviceStatus.remote }}
              connectionState={connectionState}
              microphoneVolume={microphoneVolume}
              systemAudioVolume={systemAudioVolume}
              onToggleDevice={toggleDevice}
              onShowShortcutGuide={() => setIsShortcutGuideVisible(true)}
              isMobile={true}
            />

            <Tooltip title="局内设置">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsOpen(true)}
              />
            </Tooltip>
          </div>
        )}
      {/* 标题栏（桌面端） */}

        {/* 桌面端：DeviceStatusPanel 在最顶部 */}
        {!isMobile && (
          <div style={{
            // padding: '12px 16px',
            // top: '-100px',

            borderBottom: '1px solid var(--color-border-secondary)',
            background: 'var(--color-bg-container)',
            display: 'flex',

            // alignItems: 'center',
            justifyContent: 'space-between',
            // gap: '16px'
          }}>
            <div style={{ margin: 0, flex: '0 0 auto' }}>
              <Title level={5} style={{ margin: 0 }}>{interviewTitle}</Title>
              <Text type="secondary">职位：{position}</Text>
            </div>
            <DeviceStatusPanel
              deviceStatus={{ local: deviceStatus.local, remote: deviceStatus.remote }}
              connectionState={connectionState}
              microphoneVolume={microphoneVolume}
              systemAudioVolume={systemAudioVolume}
              onToggleDevice={toggleDevice}
              onShowShortcutGuide={() => setIsShortcutGuideVisible(true)}
              isMobile={false}
            />
          </div>
        )}

        {/* 主内容区域 */}
        <div style={{ flex: 1, display: 'flex', gap: '8px', overflow: 'hidden', minWidth: 0 }}>
          {/* 左侧：对话历史列表（桌面端可见） */}
          <ChatHistorySidebar
            isMobile={isMobile}
            sidebarWidth={sidebarWidth}
            isResizing={isResizing}
            handleMouseDown={handleMouseDown}
            handleSidebarClick={handleSidebarClick}
            history={history}
            selectedHistoryId={selectedHistoryId}
            viewHistory={viewHistory}
            deleteHistoryItem={deleteHistoryItem}
            onDeleteConfirm={showDeleteConfirm}
            messages={messages}
            sessionType="interview"
            sessionTitle={interviewTitle}
          />

          {/* 右侧：主要内容区域 */}
          <SessionMainContent
            sessionType="interview"
            sessionTitle={interviewTitle}
            position={position}
            isMobile={isMobile}
            messages={messages}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            isRequesting={isRequesting}
            modelMode={modelMode}
            onModelModeChange={setModelMode}
            messagesEndRef={messagesEndRef}
            sendPendingMessagesToAI={sendPendingMessagesToAI}
            sendSingleMessageToAI={sendSingleMessageToAI}
            stopStreaming={stopStreaming}
            ownerId={interviewId}
            settingsOpen={settingsOpen}
            onSettingsOpenChange={setSettingsOpen}
            onSessionConfigChange={setSessionConfig}
            onDeleteMessage={(messageId) => {
              setMessages((prev) => prev.filter(m => m.id !== messageId));
            }}
          />

        </div>


      </div>

      {/* 配对码弹窗 */}
      <PairingCodeDisplay
        code={pairingCode}
        connectionState={connectionState}
        isModalVisible={isModalVisible}
        onClose={async () => {
          await disconnectWebRTC();
        }}
        onRefresh={async () => {
          await disconnectWebRTC();
          await new Promise(resolve => setTimeout(resolve, 500));
          connectWebRTC();
        }}
      />

      {/* 快捷键指南弹窗 */}
      <ShortcutGuideModal
        open={isShortcutGuideVisible}
        onClose={() => setIsShortcutGuideVisible(false)}
      />

      {/* 连接设备引导 */}
      {guideVisible && (
        <Guide
          steps={steps}
          localKey="connection-guide"
          hotspot
          mask
          closable
          modalClassName="byte-guide-modal"
          maskClassName="byte-guide-mask"
          onClose={handleGuideClose}
          beforeStepChange={beforeStepChange}
          afterStepChange={afterStepChange}
        />
      )}

      <style jsx global>{`
        .history-item:hover {
          background-color: var(--color-list-item-hover) !important;
        }
        .history-item:hover .delete-button {
          opacity: 1 !important;
        }
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
      `}</style>
    </>
  );
}
