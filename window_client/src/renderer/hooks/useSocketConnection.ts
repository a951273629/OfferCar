import { useState, useRef, useEffect, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketConnectionResult {
  socket: Socket | null;
  isConnected: boolean;
  initSocket: () => Socket;
  disconnectSocket: () => void;
}

/**
 * Socket.IO 连接管理 Hook
 * 管理信令服务器连接的生命周期
 */
export function useSocketConnection(signalingUrl: string): UseSocketConnectionResult {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // 初始化 Socket 连接
  const initSocket = useCallback(() => {
    // 如果已存在连接且状态正常，直接返回
    if (socketRef.current) {
      const socket = socketRef.current;
      
      if (socket.connected) {
        return socket;
      }
      
      // 如果 socket 已断开或关闭，清理并重新创建
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }

    console.log('[Socket] 创建新连接:', signalingUrl);
    const socket = io(signalingUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    socketRef.current = socket;

    // 注册基础事件
    socket.on('connect', () => {
      console.log('[Socket] 信令服务器已连接');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Socket] 信令服务器已断开');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] 连接错误:', error);
      setIsConnected(false);
    });

    return socket;
  }, [signalingUrl]);

  // 断开 Socket 连接
  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      console.log('[Socket] 断开连接');
      const socket = socketRef.current;
      
      socket.removeAllListeners();
      socket.disconnect();
      
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, [disconnectSocket]);

  return {
    socket: socketRef.current,
    isConnected,
    initSocket,
    disconnectSocket
  };
}
