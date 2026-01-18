import { useEffect, useRef } from 'react';
import { message } from 'antd';
import type { ConnectionState } from '../types/webrtc';

interface UseElectronEventsOptions {
  sendExamCommand?: (type: string, data: string) => void;
  connectionState: ConnectionState;
  enabled?: boolean; // 是否启用监听
}

/**
 * Electron 事件监听 Hook
 * 统一管理 Electron IPC 事件（截图、快速回答、剪贴板）
 */
export function useElectronEvents(options: UseElectronEventsOptions): void {
  const { sendExamCommand, connectionState, enabled = true } = options;

  // 使用 ref 保存最新值，避免 useEffect 依赖循环
  const connectionStateRef = useRef(connectionState);
  const sendExamCommandRef = useRef(sendExamCommand);

  // 同步更新 ref
  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    sendExamCommandRef.current = sendExamCommand;
  }, [sendExamCommand]);

  // 注册事件监听器（只注册一次）
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (!window.electronAPI || !window.electronAPI.on) {
      console.error('[useElectronEvents] ❌ electronAPI 未正确加载！');
      return;
    }

    // 监听截图事件
    const handleScreenshot = (base64: string) => {
      console.log('[useElectronEvents] 收到截图事件');
      
      if (connectionStateRef.current !== 'connected' || !sendExamCommandRef.current) {
        message.warning('WebRTC 未连接，无法发送截图');
        return;
      }
      
      sendExamCommandRef.current('screenshot', base64);
      message.success('截图已发送');
    };

    // 监听快速回答事件
    const handleQuickAnswer = () => {
      console.log('[useElectronEvents] ⚡ 收到快速回答事件!');
      console.log('[useElectronEvents] connectionState:', connectionStateRef.current);
      
      if (connectionStateRef.current !== 'connected' || !sendExamCommandRef.current) {
        console.warn('[useElectronEvents] ⚠️ WebRTC 未连接');
        message.warning('WebRTC 未连接，无法触发快速回答');
        return;
      }
      
      sendExamCommandRef.current('quick-answer', '');
      message.info('触发快速回答');
    };

    // 监听剪贴板文本变化
    const handleClipboardText = (text: string) => {
      console.log('[useElectronEvents] 📋 收到剪贴板文本事件!');
      console.log('[useElectronEvents] 文本长度:', text?.length);
      console.log('[useElectronEvents] 文本前50字符:', text?.substring(0, 50));
      
      if (connectionStateRef.current !== 'connected' || !sendExamCommandRef.current) {
        console.warn('[useElectronEvents] ⚠️ WebRTC 未连接');
        message.warning('WebRTC 未连接，无法同步文本');
        return;
      }
      
      sendExamCommandRef.current('text', text);
      message.success('文本已同步');
    };

    // 监听向上滚动事件
    const handleScrollUp = () => {
      console.log('[useElectronEvents] ⬆️ 收到向上滚动事件');
      
      if (connectionStateRef.current !== 'connected' || !sendExamCommandRef.current) {
        console.warn('[useElectronEvents] ⚠️ WebRTC 未连接');
        return;
      }
      
      sendExamCommandRef.current('scroll-up', '');
    };

    // 监听向下滚动事件
    const handleScrollDown = () => {
      console.log('[useElectronEvents] ⬇️ 收到向下滚动事件');
      
      if (connectionStateRef.current !== 'connected' || !sendExamCommandRef.current) {
        console.warn('[useElectronEvents] ⚠️ WebRTC 未连接');
        return;
      }
      
      sendExamCommandRef.current('scroll-down', '');
    };

    // 注册事件监听
    console.log('[useElectronEvents] 📝 正在注册事件监听器...');
    window.electronAPI.on.examScreenshotCaptured(handleScreenshot);
    // console.log('[useElectronEvents] ✅ examScreenshotCaptured 已注册');
    
    window.electronAPI.on.examQuickAnswerTriggered(handleQuickAnswer);
    // console.log('[useElectronEvents] ✅ examQuickAnswerTriggered 已注册');
    
    window.electronAPI.on.clipboardTextChanged(handleClipboardText);
    // console.log('[useElectronEvents] ✅ clipboardTextChanged 已注册');
    
    window.electronAPI.on.examScrollUp(handleScrollUp);
    // console.log('[useElectronEvents] ✅ examScrollUp 已注册');
    
    window.electronAPI.on.examScrollDown(handleScrollDown);
    // console.log('[useElectronEvents] ✅ examScrollDown 已注册');

    // console.log('[useElectronEvents] ✨ 快捷键监听已启动');

    // 清理函数
    return () => {
      console.log('[useElectronEvents] 🧹 正在清理快捷键监听器...');
      window.electronAPI.removeListener.examScreenshotCaptured();
      window.electronAPI.removeListener.examQuickAnswerTriggered();
      window.electronAPI.removeListener.clipboardTextChanged();
      window.electronAPI.removeListener.examScrollUp();
      window.electronAPI.removeListener.examScrollDown();
      console.log('[useElectronEvents] 快捷键监听已停止');
    };
  }, [enabled]); // 只依赖 enabled，从 ref 读取最新值
}

