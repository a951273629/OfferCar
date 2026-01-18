import { useState, useRef, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { nanoid } from 'nanoid';
import { ChatMessage } from '@/types/api';
import { useWebRTCReceiver } from './webRtcReceiver';
import { useConsume } from './useConsume';
import type { ConnectionState } from '@/types/webrtc';

export interface UseInterviewSessionOptions {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  onExamCommand?: (commandMessage: import('@/types/webrtc').ExamCommandMessage) => void;
  showIntervieweeMessages?: boolean; // 是否允许接收并加入面试者消息（实时过滤）
}

export interface UseInterviewSessionResult {
  // 设备状态
  deviceStatus: {
    local: boolean;
    remote: boolean;
    connected: boolean;
  };
  // WebRTC 状态
  pairingCode: string;
  connectionState: ConnectionState;
  microphoneVolume: number;
  systemAudioVolume: number;
  // 配对码弹窗状态
  isModalVisible: boolean;
  setIsModalVisible: (visible: boolean) => void;
  // 操作函数
  toggleDevice: (device: 'local' | 'remote' | 'connected') => void;
  // 连接/断开函数（用于刷新配对码）
  disconnectWebRTC: () => Promise<void>;
  connectWebRTC: () => Promise<void>;
}

/**
 * 自定义 Hook：面试会话业务逻辑
 * 整合设备状态、WebRTC 连接、音频识别等核心功能
 * 
 * @param options - 配置选项
 * @returns 面试会话状态和操作函数
 */
export function useInterviewSession(options: UseInterviewSessionOptions): UseInterviewSessionResult {
  const { setMessages, onExamCommand, showIntervieweeMessages = true } = options;

  // 标志位：防止重复启动识别
  const recognitionStartedRef = useRef<boolean>(false);

  // 计费定时器和开始时间引用
  const billingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const connectionStartTimeRef = useRef<number | null>(null);

  // WebRTC 接收端 Hook（接收文字和命令）
  const {
    pairingCode,
    connectionState,
    socketConnected,
    microphoneVolume,
    systemAudioVolume,
    isModalVisible,
    setIsModalVisible,
    registerTextCallback,
    connect: connectWebRTC,
    disconnect: disconnectWebRTC,
  } = useWebRTCReceiver({
    channels: ['text', 'commands'],
    onExamCommand,
    onPeerDisconnected: () => {
      console.log('[Interview Session] 对方已断开连接');
    }
  });

  // 余额不足回调（使用 useCallback 避免循环依赖）
  const handleInsufficientBalance = useCallback(() => {
    // 余额不足时立即断开连接
    console.warn('[Interview Session] 余额不足，断开连接');
    disconnectWebRTC();
    
    // 清理定时器
    if (billingTimerRef.current) {
      clearInterval(billingTimerRef.current);
      billingTimerRef.current = null;
    }
  }, [disconnectWebRTC]);

  // 消费 Hook（用于语音识别计费）
  const { consume } = useConsume({
    onInsufficientBalance: handleInsufficientBalance,
    showErrorMessage: true,  // 显示错误提示
  });

  // 设备状态（基于WebRTC状态的计算属性）
  const deviceStatus = {
    local: socketConnected,  // 本机连接状态：基于Socket.IO连接
    remote: connectionState === 'connected',  // 客户端连接状态：基于WebRTC连接
    connected: connectionState === 'connected',
  };

  // 切换设备状态
  const toggleDevice = useCallback((device: 'local' | 'remote' | 'connected') => {
    if (device === 'connected') {
      // 连接设备按钮
      if (connectionState === 'disconnected') {
        // 启动 WebRTC 连接（connect内部会打开Modal）
        connectWebRTC();
        // message.success('正在生成配对码...');
      } else {
        // 断开连接（disconnect内部会关闭Modal）
        disconnectWebRTC();
        message.info('连接已断开');
      }
    }
    // 移除 local 和 remote 的手动切换逻辑（它们是只读状态）
  }, [connectionState, connectWebRTC, disconnectWebRTC]);

  // 当 WebRTC 连接成功后，注册文字回调
  useEffect(() => {
    // 只在连接成功且未启动识别时执行
    if (connectionState === 'connected' && !recognitionStartedRef.current) {
      console.log('[Interview Session] WebRTC 已连接，注册文字回调...');

      // 标记识别已启动
      recognitionStartedRef.current = true;
      
      // 记录连接开始时间（用于计费）
      connectionStartTimeRef.current = Date.now();
      console.log('[Interview Session] 开始计费时间:', new Date().toLocaleString());

      // 注册文字回调
      if (registerTextCallback) {
        registerTextCallback((message) => {
          // 实时过滤：关闭 showIntervieweeMessages 时，不加入面试者消息
          if (!showIntervieweeMessages && message.role === 'interviewee') {
            return;
          }

          // 过滤空白消息
          if (!message.text || message.text.trim().length === 0) {
            return;
          }

          setMessages((prev) => {
            // 查找最后一条相同说话人的 pending 消息
            const lastPendingIndex = prev.findLastIndex(
              m => m.role === 'user' && m.status === 'pending' && m.speaker === message.role
            );

            if (lastPendingIndex >= 0) {
              // 更新现有消息
              const updated = [...prev];
              updated[lastPendingIndex] = {
                ...updated[lastPendingIndex],
                content: message.text,
                status: message.status,  // 使用 message.status
              };
              return updated;
            } else {
              // 没有找到 pending 消息，创建新消息
              return [...prev, {
                id: nanoid(),
                role: 'user',
                content: message.text,
                date: new Date().toISOString(),
                status: message.status,  // 使用 message.status
                speaker: message.role,
              }];
            }
          });
        });
        
        console.log('[Interview Session] ✓ 文字回调已注册');
      } else {
        console.error('[Interview Session] ❌ registerTextCallback 不可用');
      }
      
      // 启动语音识别计费定时器（每 60 秒扣 3 点）
      billingTimerRef.current = setInterval(async () => {
        console.log('[Interview Session] 语音识别计费：扣除 3 点...');
        
        const success = await consume(3, 'voice_recognition', '语音识别服务（1分钟）');
        
        if (!success) {
          // 消费失败（余额不足或其他错误），清理定时器
          // 注意：disconnectWebRTC 已在 useConsume 的 onInsufficientBalance 中调用
          if (billingTimerRef.current) {
            clearInterval(billingTimerRef.current);
            billingTimerRef.current = null;
          }
        }
      }, 60000); // 每 60 秒执行一次
      
      console.log('[Interview Session] ✓ 语音识别计费定时器已启动');
    }

    // 当连接断开时清理定时器
    if (connectionState === 'disconnected' && recognitionStartedRef.current) {
      console.log('[Interview Session] 连接已断开...');
      recognitionStartedRef.current = false;
      
      // 清理计费定时器
      if (billingTimerRef.current) {
        clearInterval(billingTimerRef.current);
        billingTimerRef.current = null;
        console.log('[Interview Session] 计费定时器已清理');
      }
      
      // 处理不满 1 分钟的计费（不满 1 分钟按 1 分钟计费）
      if (connectionStartTimeRef.current) {
        const connectionDuration = Date.now() - connectionStartTimeRef.current;
        const durationInMinutes = connectionDuration / 60000;
        
        console.log(`[Interview Session] 连接时长: ${durationInMinutes.toFixed(2)} 分钟`);
        
        // 如果连接时长不满 1 分钟，需要补扣费
        if (durationInMinutes < 1) {
          console.log('[Interview Session] 连接时长不满 1 分钟，补扣 3 点...');
          
          // 静默处理补扣费，避免在断开连接时抛出异常
          consume(3, 'voice_recognition', '语音识别服务（不满1分钟按1分钟计费）').catch(error => {
            // 断开连接场景下的补扣费失败不应影响用户体验
            console.warn('[Interview Session] 补扣费失败（断开场景，静默处理）:', error instanceof Error ? error.message : error);
          });
        }
        
        connectionStartTimeRef.current = null;
      }
    }

    // Cleanup 函数：组件卸载或依赖变化时清理
    return () => {
      if (recognitionStartedRef.current) {
        console.log('[Interview Session] Cleanup: 清理标志');
        recognitionStartedRef.current = false;
      }
      
      // 清理计费定时器
      if (billingTimerRef.current) {
        clearInterval(billingTimerRef.current);
        billingTimerRef.current = null;
        console.log('[Interview Session] Cleanup: 计费定时器已清理');
      }
      
      // 清理连接时间记录
      if (connectionStartTimeRef.current) {
        console.log('[Interview Session] Cleanup: 清理连接时间记录');
        connectionStartTimeRef.current = null;
      }
    };
  }, [connectionState, registerTextCallback, setMessages, disconnectWebRTC, consume, showIntervieweeMessages]);

  // 配对成功提示（Modal已在useWebRTCReceiver中关闭）
  useEffect(() => {
    if (connectionState === 'connected') {
      message.success('设备配对成功！');
    }
  }, [connectionState]);

  return {
    deviceStatus,
    pairingCode,
    connectionState,
    microphoneVolume,  // 从 Electron 端接收的实时音量
    systemAudioVolume,  // 从 Electron 端接收的实时音量
    isModalVisible,
    setIsModalVisible,
    toggleDevice,
    disconnectWebRTC,
    connectWebRTC,
  };
}

