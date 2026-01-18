import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useWebRTCReceiver } from './webRtcReceiver';
import type { ConnectionState, ExamCommandMessage } from '@/types/webrtc';

export interface UseExamSessionOptions {
  onExamCommand?: (commandMessage: ExamCommandMessage) => void;
}

export interface UseExamSessionResult {
  // WebRTC 状态
  pairingCode: string;
  connectionState: ConnectionState;
  // 配对码弹窗状态
  isModalVisible: boolean;
  setIsModalVisible: (visible: boolean) => void;
  // 操作函数
  handleConnectDevice: () => void;
  // 断开连接函数（用于刷新配对码）
  disconnectWebRTC: () => void;
  connectWebRTC: () => void;
}

/**
 * 自定义 Hook：笔试会话业务逻辑
 * 整合配对码弹窗、WebRTC 连接等核心功能
 * 
 * @param options - 配置选项
 * @returns 笔试会话状态和操作函数
 */
export function useExamSession(options: UseExamSessionOptions = {}): UseExamSessionResult {
  const { onExamCommand } = options;

  // WebRTC 接收端 Hook（笔试模式 - 只使用命令通道）
  const {
    pairingCode,
    connectionState,
    isModalVisible,
    setIsModalVisible,
    connect: connectWebRTC,
    disconnect: disconnectWebRTC,
  } = useWebRTCReceiver({
    channels: ['commands'],
    onExamCommand,
    onPeerDisconnected: () => {
      console.log('[Exam Session] 对方已断开连接');
    }
  });

  // 连接设备按钮处理
  const handleConnectDevice = useCallback(() => {
    if (connectionState === 'disconnected') {
      // 启动 WebRTC 连接（connect内部会打开Modal）
      connectWebRTC();
      // message.success('正在生成配对码...');
    } else {
      // 断开连接（disconnect内部会关闭Modal）
      disconnectWebRTC();
      message.info('连接已断开');
    }
  }, [connectionState, connectWebRTC, disconnectWebRTC]);

  // 配对成功提示（Modal已在useWebRTCReceiver中关闭）
  useEffect(() => {
    if (connectionState === 'connected') {
      message.success('设备配对成功！');
    }
  }, [connectionState]);

  return {
    pairingCode,
    connectionState,
    isModalVisible,
    setIsModalVisible,
    handleConnectDevice,
    disconnectWebRTC,
    connectWebRTC,
  };
}

