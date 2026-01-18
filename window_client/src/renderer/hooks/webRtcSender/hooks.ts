import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type React from 'react';
import { SIGNALING_SERVER_URL, PEER_CONNECTION_CONFIG } from '../../lib/webrtcConfig';
import { useSocketConnection } from '../useSocketConnection';
import { sendLargeData } from '../../utils/dataChannel';
import type {
  ConnectionState,
  SignalingCallbackResult,
  AnswerEvent,
  IceCandidateEvent,
  RecognitionTextMessage,
  VolumeMessage,
  UseWebRTCSenderResult,
  UseWebRTCSenderOptions
} from '../../types/webrtc';
import {
  processPendingIceCandidates,
  waitForSocketConnection,
  createAndSendOffer
} from '../../utils/webRtcSenderUtils';

/**
 * WebRTC 发送端 Hook（Electron 应用）
 * 功能：连接配对码，发送识别文字或命令数据
 * - channels: ['text'] - 发送识别文字
 * - channels: ['commands'] - 发送命令数据（截图、文本、快捷键）
 * - channels: ['text', 'commands'] - 同时发送两种数据
 */
export function useWebRTCSender(
  micStreamRef: React.RefObject<MediaStream | null>,
  systemStreamRef: React.RefObject<MediaStream | null>,
  options: UseWebRTCSenderOptions = {}
): UseWebRTCSenderResult {
  // 使用 useMemo 稳定 channels 引用
  const channelsKey = options.channels?.join(',') || 'text,commands';
  const channels = useMemo(() => {
    return options.channels || ['text', 'commands'];
  }, [channelsKey]);
  
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const currentPairingCodeRef = useRef<string>('');
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ICE 候选缓存队列（解决信令竞态问题）
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  // 使用 Socket 连接 Hook
  const { socket, initSocket, disconnectSocket } = useSocketConnection(SIGNALING_SERVER_URL);

  // DataChannel 引用
  const examCommandChannelRef = useRef<RTCDataChannel | null>(null);
  const textChannelRef = useRef<RTCDataChannel | null>(null);

  // 处理 Answer
  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC Sender] 处理 Answer 失败: PeerConnection 不存在');
      setConnectionState('failed');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC Sender] Remote Description (Answer) 已设置');
    } catch (error) {
      console.error('[WebRTC Sender] 设置 Remote Description 失败:', error);
      setConnectionState('failed');
      return;
    }
    
    await processPendingIceCandidates(pc, pendingIceCandidatesRef.current);
    pendingIceCandidatesRef.current = [];
  };

  // 处理 ICE Candidate
  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionRef.current;
      
      if (pc && pc.remoteDescription) {
        // Remote Description 已设置，直接添加
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC Sender] ICE 候选已添加');
      } else {
        // Remote Description 未设置，加入缓存队列
        pendingIceCandidatesRef.current.push(candidate);
        console.log('[WebRTC Sender] ICE 候选已缓存，队列长度:', pendingIceCandidatesRef.current.length);
      }
    } catch (error) {
      console.error('[WebRTC Sender] 添加 ICE Candidate 失败:', error);
    }
  };

  // 注册 Socket 事件监听
  useEffect(() => {
    if (!socket) return;

    const handleAnswerEvent = async (data: AnswerEvent) => {
      console.log('[WebRTC Sender] 收到 Answer');
      await handleAnswer(data.answer);
    };

    const handleIceCandidateEvent = async (data: IceCandidateEvent) => {
      await handleIceCandidate(data.candidate);
    };

    const handlePeerDisconnected = () => {
      console.log('[WebRTC Sender] 对方已断开');
      cleanupPeerConnection();
      setConnectionState('disconnected');
    };

    socket.on('answer', handleAnswerEvent);
    socket.on('ice-candidate', handleIceCandidateEvent);
    socket.on('peer-disconnected', handlePeerDisconnected);

    return () => {
      socket.off('answer', handleAnswerEvent);
      socket.off('ice-candidate', handleIceCandidateEvent);
      socket.off('peer-disconnected', handlePeerDisconnected);
    };
  }, [socket]);

  // 创建命令 DataChannel
  const createCommandDataChannel = useCallback((pc: RTCPeerConnection) => {
    if (!channels.includes('commands')) {
      return;
    }
    
    const examChannel = pc.createDataChannel('exam-commands', {
      ordered: true
    });
    
    examCommandChannelRef.current = examChannel;
    
    examChannel.onopen = () => {
      console.log('[WebRTC Sender] 笔试命令 DataChannel 已打开');
    };
    
    examChannel.onclose = () => {
      console.log('[WebRTC Sender] 笔试命令 DataChannel 已关闭');
    };
    
    examChannel.onerror = (error) => {
      if (examChannel.readyState !== 'closing' && examChannel.readyState !== 'closed') {
        console.error('[WebRTC Sender] 笔试命令 DataChannel 错误:', error);
      }
    };
  }, [channels]);

  // 创建文字传输 DataChannel
  const createTextDataChannel = useCallback((pc: RTCPeerConnection) => {
    if (!channels.includes('text')) {
      return;
    }
    
    const textChannel = pc.createDataChannel('recognition-text', {
      ordered: true,
      maxRetransmits: 3
    });
    
    textChannelRef.current = textChannel;
    
    textChannel.onopen = () => {
      console.log('[WebRTC Sender] 文字传输 DataChannel 已打开');
    };
    
    textChannel.onclose = () => {
      console.log('[WebRTC Sender] 文字传输 DataChannel 已关闭');
    };
    
    textChannel.onerror = (error) => {
      if (textChannel.readyState !== 'closing' && textChannel.readyState !== 'closed') {
        console.error('[WebRTC Sender] 文字传输 DataChannel 错误:', error);
      }
    };
  }, [channels]);

  // 设置 PeerConnection 监听器
  const setupPeerConnectionListeners = useCallback((pc: RTCPeerConnection) => {
    // 监听 ICE Candidate
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      
      socket?.emit('ice-candidate', {
        candidate: event.candidate.toJSON()
      });
    };

    // 监听连接状态变化
    pc.onconnectionstatechange = () => {
      switch (pc.connectionState) {
        case 'connected':
          console.log('[WebRTC Sender] WebRTC 连接建立成功');
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setConnectionState('connected');
          break;
        case 'disconnected':
        case 'closed':
          console.log('[WebRTC Sender] WebRTC 连接已断开');
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setConnectionState('disconnected');
          break;
        case 'failed':
          console.error('[WebRTC Sender] WebRTC 连接失败');
          if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
          }
          setConnectionState('failed');
          break;
        default:
          setConnectionState('connecting');
      }
    };

    // 监听 ICE 连接状态变化
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.error('[WebRTC Sender] ICE 连接失败，请检查网络配置');
      }
    };
  }, [socket]);

  // 创建 PeerConnection
  const createPeerConnection = useCallback(() => {
    console.log('[WebRTC Sender] 创建 PeerConnection, 启用通道:', channels.join(', '));
    const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
    peerConnectionRef.current = pc;
    
    // 创建 DataChannel
    createCommandDataChannel(pc);
    createTextDataChannel(pc);
    
    // 设置监听器
    setupPeerConnectionListeners(pc);

    return pc;
  }, [channels, createCommandDataChannel, createTextDataChannel, setupPeerConnectionListeners]);

  // 清理 PeerConnection
  const cleanupPeerConnection = () => {
    if (examCommandChannelRef.current) {
      examCommandChannelRef.current.close();
      examCommandChannelRef.current = null;
    }
    
    if (textChannelRef.current) {
      textChannelRef.current.close();
      textChannelRef.current = null;
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // 清空 ICE 候选缓存队列
    pendingIceCandidatesRef.current = [];
  };

  // 发送笔试命令
  const sendExamCommand = useCallback(async (type: string, data: string) => {
    if (!channels.includes('commands')) {
      console.warn('[WebRTC Sender] 当前配置不包含命令通道');
      return;
    }
    
    const channel = examCommandChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      console.warn('[WebRTC Sender] 笔试命令 DataChannel 未打开');
      return;
    }
    
    try {
      await sendLargeData(type, data, channel);
    } catch (error) {
      console.error('[WebRTC Sender] 发送命令失败:', error);
    }
  }, [channels]);

  // 发送识别文字
  const sendRecognitionText = useCallback((message: RecognitionTextMessage) => {
    if (!channels.includes('text')) {
      console.warn('[WebRTC Sender] 当前配置不包含文字通道');
      return;
    }
    
    const channel = textChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      console.warn('[WebRTC Sender] 文字传输 DataChannel 未打开');
      return;
    }
    
    try {
      const messageStr = JSON.stringify(message);
      channel.send(messageStr);
      console.log(`[WebRTC Sender] 发送文字: [${message.role}] ${message.text.substring(0, 20)}...`);
    } catch (error) {
      console.error('[WebRTC Sender] 发送文字失败:', error);
    }
  }, [channels]);

  // 发送音量更新
  const sendVolumeUpdate = useCallback((role: 'interviewee' | 'interviewer', volume: number) => {
    if (!channels.includes('text')) {
      return;
    }
    
    const channel = textChannelRef.current;
    if (!channel || channel.readyState !== 'open') {
      return;
    }
    
    try {
      const volumeMessage: VolumeMessage = {
        type: 'volume',
        role,
        volume,
        timestamp: Date.now()
      };
      channel.send(JSON.stringify(volumeMessage));
    } catch (error) {
      console.error('[WebRTC Sender] 发送音量失败:', error);
    }
  }, [channels]);

  // 设置连接超时保护
  const setupConnectionTimeout = useCallback(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    connectionTimeoutRef.current = setTimeout(() => {
      const pc = peerConnectionRef.current;
      if (pc && pc.connectionState === 'connecting') {
        console.error('[WebRTC Sender] 连接超时（30秒）');
        setConnectionState('failed');
        cleanupPeerConnection();
      }
    }, 30000);
  }, []);

  // 连接（使用配对码）
  const connect = useCallback(async (pairingCode: string) => {
    setConnectionState('connecting');
    currentPairingCodeRef.current = pairingCode;

    const currentSocket = initSocket();
    
    try {
      await waitForSocketConnection(currentSocket);
    } catch (error) {
      console.error('[WebRTC Sender] Socket 连接失败:', error);
      setConnectionState('failed');
      throw error;
    }

    // 连接到配对码
    console.log('[WebRTC Sender] 请求连接配对码:', pairingCode);
    
    try {
      await new Promise<void>((resolve, reject) => {
        currentSocket.emit('connect-with-code', pairingCode, async (result: SignalingCallbackResult) => {
          if (!result.success) {
            console.error('[WebRTC Sender] 配对码连接失败:', result.error);
            setConnectionState('failed');
            reject(new Error('配对码不存在'));
            return;
          }

          console.log('[WebRTC Sender] 配对码连接成功');

          try {
            const pc = createPeerConnection();
            setupConnectionTimeout();
            await createAndSendOffer(pc, currentSocket, pairingCode, setConnectionState);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    } catch (error) {
      console.error('[WebRTC Sender] 配对码连接失败:', error);
      setConnectionState('failed');
      throw error;
    }
  }, [initSocket, createPeerConnection, setupConnectionTimeout]);

  // 断开连接
  const disconnect = useCallback(() => {
    console.log('[WebRTC Sender] 断开连接');
    
    // 清除连接超时定时器
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
      connectionTimeoutRef.current = null;
    }
    
    // 发送断开信令
    if (socket) {
      socket.emit('manual-disconnect');
    }
    
    // 清理 PeerConnection
    cleanupPeerConnection();
    
    // 断开 Socket 连接
    disconnectSocket();

    currentPairingCodeRef.current = '';
    setConnectionState('disconnected');
  }, [socket, disconnectSocket]);

  // 使用 ref 保存最新的 disconnect 函数
  const disconnectRef = useRef(disconnect);

  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      disconnectRef.current();
    };
  }, []);

  return {
    connectionState,
    connect,
    disconnect,
    ...(channels.includes('commands') && { sendExamCommand }),
    ...(channels.includes('text') && { sendRecognitionText, sendVolumeUpdate })
  };
}

