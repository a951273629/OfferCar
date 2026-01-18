import { useState, useRef, useEffect, useCallback } from 'react';
import { Modal } from 'antd';
import { io, Socket } from 'socket.io-client';
import {
  SIGNALING_SERVER_URL,
  PEER_CONNECTION_CONFIG,
  generatePairingCode
} from '@/lib/webrtc/config';
import type {
  ConnectionState,
  OfferEvent,
  IceCandidateEvent,
  SignalingCallbackResult,
  ExamCommandMessage,
  RecognitionTextMessage,
  VolumeMessage,
  UseWebRTCReceiverOptions,
  UseWebRTCReceiverResult
} from '@/types/webrtc';
import {
  processPendingIceCandidates,
  handleChunkMessage,
  handleCompleteExamMessage,
  handleVolumeMessage,
  handleTextMessage
} from '@/lib/utils/webRtcReceiverUtils';

/**
 * 检查 DataChannel 错误是否为正常关闭事件
 * @param error RTCError 对象
 * @returns 如果是正常关闭返回 true，否则返回 false
 */
function isNormalDataChannelClose(error: RTCError | null): boolean {
  if (!error) {
    return true;
  }

  return error.name === 'OperationError' &&
    (error.message.includes('User-Initiated Abort') || error.message.includes('Close called'));
}

/**
 * WebRTC 接收端 Hook（Next.js Web 应用）
 * 功能：生成配对码，接收来自 Electron 的音频数据或命令数据
 * - channels: ['audio'] - 接收音频数据通道（面试者 + 面试官）
 * - channels: ['commands'] - 接收命令数据通道（截图、文本、快捷键）
 * - channels: ['audio', 'commands'] - 同时接收两种通道
 */
export function useWebRTCReceiver(options: UseWebRTCReceiverOptions = {}): UseWebRTCReceiverResult {
  const { channels = ['text', 'commands'], onExamCommand, onRecognitionText, onPeerDisconnected } = options;

  const [pairingCode, setPairingCode] = useState<string>('');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [socketConnected, setSocketConnected] = useState<boolean>(false);
  const [isModalVisible, setIsModalVisible] = useState<boolean>(false);

  // 音量状态
  const [microphoneVolume, setMicrophoneVolume] = useState<number>(0);
  const [systemAudioVolume, setSystemAudioVolume] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // ICE 候选缓存队列（解决信令竞态问题）
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  // Socket 连接超时定时器引用
  const socketTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Exam 命令回调引用（命令模式）
  const examCommandCallbackRef = useRef<((message: ExamCommandMessage) => void) | null>(null);

  // 文字回调引用（文字模式）
  const textCallbackRef = useRef<((message: RecognitionTextMessage) => void) | null>(null);

  // 分片缓存（用于接收大数据）
  const chunkBufferRef = useRef<Map<string, { chunks: string[], total: number }>>(new Map());

  // disconnect 函数引用（用于组件卸载清理）
  const disconnectRef = useRef<(() => Promise<void>) | null>(null);

  // 手动断开标志（区分用户主动断开和 Safari 后台自动断开）
  const isManualDisconnectRef = useRef<boolean>(false);

  // 注册 exam 命令回调（命令模式）
  useEffect(() => {
    if (channels.includes('commands') && onExamCommand) {
      examCommandCallbackRef.current = onExamCommand;
    }
  }, [channels, onExamCommand]);

  // 注册文字回调（文字模式）
  useEffect(() => {
    if (channels.includes('text') && onRecognitionText) {
      textCallbackRef.current = onRecognitionText;
    }
  }, [channels, onRecognitionText]);

  // 注册文字回调函数（供外部调用）
  const registerTextCallback = useCallback((callback: (message: RecognitionTextMessage) => void) => {
    console.log('[WebRTC Receiver] 注册文字回调');
    textCallbackRef.current = callback;
  }, []);

  // 设置基础 Socket 事件监听器
  const setupSocketEventListeners = useCallback((socket: Socket, resolve: (socket: Socket) => void, reject: (error: Error) => void) => {
    // 清除超时定时器的辅助函数
    const clearSocketTimeout = () => {
      if (!socketTimeoutRef.current) {
        return;
      }

      clearTimeout(socketTimeoutRef.current);
      socketTimeoutRef.current = null;
    };

    socket.on('connect', () => {
      console.log('[WebRTC Receiver] 信令服务器已连接');
      clearSocketTimeout();
      setSocketConnected(true);
      resolve(socket);
    });

    socket.on('disconnect', () => {
      console.log('[WebRTC Receiver] Socket 已断开');
      setSocketConnected(false);

      // Guard Clause: 如果是手动断开，执行完整清理后立即返回
      if (isManualDisconnectRef.current) {
        console.log('[WebRTC Receiver] 手动断开，执行完整清理');
        setConnectionState('disconnected');
        cleanupPeerConnection();
        setPairingCode('');
        return;
      }

      // 非手动断开（可能是后台断开），保留 PeerConnection 和配对码
      console.log('[WebRTC Receiver] 非手动断开（可能是后台断开），保留 PeerConnection 和配对码');

      // 检查 PeerConnection 状态并相应设置连接状态
      const pc = peerConnectionRef.current;
      const newState = pc?.connectionState === 'connected' ? 'connected' : 'disconnected';

      if (newState === 'connected') {
        console.log('[WebRTC Receiver] PeerConnection 仍然连接，保持 connected 状态');
      }

      setConnectionState(newState);
    });

    socket.on('connect_error', (error) => {
      console.error('[WebRTC Receiver] 信令服务器连接错误:', error);
      clearSocketTimeout();
      reject(error);
    });

    // 设置超时保护（10秒）
    socketTimeoutRef.current = setTimeout(() => {
      if (socket.connected) {
        return;
      }

      console.error('[WebRTC Receiver] Socket 连接超时');
      clearSocketTimeout();
      reject(new Error('Socket 连接超时'));
    }, 10000);
  }, []);

  // 清理 PeerConnection
  const cleanupPeerConnection = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // 清空 ICE 候选缓存队列
    pendingIceCandidatesRef.current = [];
  };

  // 设置信令相关监听器
  const setupSignalingListeners = useCallback((socket: Socket) => {
    socket.on('peer-connected', (data) => {
      // console.log('[WebRTC Receiver] 对方已连接，等待 Offer...', data);
      console.log('[WebRTC Receiver] 当前配对码:', pairingCode);
      setConnectionState('connecting');
    });

    socket.on('offer', async (data: OfferEvent) => {
      console.log('[WebRTC Receiver] 收到 Offer');
      await handleOffer(data.offer);
    });

    socket.on('ice-candidate', async (data: IceCandidateEvent) => {
      console.log('[WebRTC Receiver] 收到 ICE Candidate');
      await handleIceCandidate(data.candidate);
    });

    socket.on('peer-disconnected', () => {
      console.log('[WebRTC Receiver] 对方已断开，执行完全断开...');

      cleanupPeerConnection();
      setPairingCode('');
      setConnectionState('disconnected');
      setSocketConnected(false);
      setIsModalVisible(false);

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (onPeerDisconnected) {
        onPeerDisconnected();
      }

      console.log('[WebRTC Receiver] 完全断开完成');
    });
  }, [pairingCode, onPeerDisconnected]);

  // 初始化 Socket.IO 连接
  const initSocketConnection = useCallback((): Promise<Socket> => {
    return new Promise((resolve, reject) => {
      if (socketRef.current?.connected) {
        console.log('[WebRTC Receiver] Socket 已连接，复用现有连接');
        resolve(socketRef.current);
        return;
      }

      console.log('[WebRTC Receiver] 连接信令服务器:', SIGNALING_SERVER_URL);
      const socket = io(SIGNALING_SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5
      });

      socketRef.current = socket;

      setupSocketEventListeners(socket, resolve, reject);
      setupSignalingListeners(socket);
    });
  }, [setupSocketEventListeners, setupSignalingListeners]);

  // 处理 Offer
  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC Receiver] 开始处理 Offer，SDP 信息:', {
      type: offer.type,
      sdpLength: offer.sdp?.length,
      hasAudio: offer.sdp?.includes('m=audio'),
      audioLines: offer.sdp?.split('\n').filter(line => line.includes('m=audio')).length
    });

    if (!peerConnectionRef.current) {
      createPeerConnection();
    }

    const pc = peerConnectionRef.current;
    if (!pc) {
      console.error('[WebRTC Receiver] PeerConnection 创建失败');
      setConnectionState('failed');
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC Receiver] Remote Description 已设置');
    } catch (error) {
      console.error('[WebRTC Receiver] 设置 Remote Description 失败:', error);
      setConnectionState('failed');
      return;
    }

    await processPendingIceCandidates(pc, pendingIceCandidatesRef.current);
    pendingIceCandidatesRef.current = [];

    let answer;
    try {
      answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[WebRTC Receiver] Local Description (Answer) 已设置，SDP 长度:', answer.sdp?.length);
    } catch (error) {
      console.error('[WebRTC Receiver] 创建 Answer 失败:', error);
      setConnectionState('failed');
      return;
    }

    socketRef.current?.emit('answer', { answer }, (result: SignalingCallbackResult) => {
      if (!result.success) {
        console.error('[WebRTC Receiver] Answer 发送失败:', result.error);
        return;
      }
      console.log('[WebRTC Receiver] Answer 已发送');
    });
  };

  // 处理 ICE Candidate
  const handleIceCandidate = async (candidate: RTCIceCandidateInit) => {
    try {
      const pc = peerConnectionRef.current;

      if (pc && pc.remoteDescription) {
        // Remote Description 已设置，直接添加
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC Receiver] ICE 候选已添加');
      } else {
        // Remote Description 未设置，加入缓存队列
        pendingIceCandidatesRef.current.push(candidate);
        console.log('[WebRTC Receiver] ICE 候选已缓存，队列长度:', pendingIceCandidatesRef.current.length);
      }
    } catch (error) {
      console.error('[WebRTC Receiver] 添加 ICE Candidate 失败:', error);
    }
  };

  // 设置 PeerConnection 监听器
  const setupPeerConnectionListeners = useCallback((pc: RTCPeerConnection) => {
    pc.onicecandidate = (event) => {
      if (!event.candidate) {
        console.log('[WebRTC Receiver] ICE 候选收集完成（candidate 为 null）');
        return;
      }

      console.log('[WebRTC Receiver] 生成 ICE Candidate:', {
        type: event.candidate.type,
        protocol: event.candidate.protocol,
        address: event.candidate.address
      });
      socketRef.current?.emit('ice-candidate', {
        candidate: event.candidate.toJSON()
      });
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC Receiver] PeerConnection 状态变更:', {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        iceGatheringState: pc.iceGatheringState,
        signalingState: pc.signalingState
      });

      switch (pc.connectionState) {
        case 'connected':
          console.log('[WebRTC Receiver] ✓ WebRTC 连接建立成功');
          setConnectionState('connected');
          setIsModalVisible(false);
          break;
        case 'disconnected':
        case 'closed':
          console.log('[WebRTC Receiver] WebRTC 连接已断开');
          setConnectionState('disconnected');
          break;
        case 'failed':
          console.error('[WebRTC Receiver] ✗ WebRTC 连接失败');
          setConnectionState('failed');
          break;
        default:
          setConnectionState('connecting');
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC Receiver] ICE 连接状态:', pc.iceConnectionState);

      if (pc.iceConnectionState === 'failed') {
        console.error('[WebRTC Receiver] ❌ ICE 连接失败，可能的原因：');
        console.error('  1. STUN 服务器不可达');
        console.error('  2. 网络 NAT 配置严格，需要 TURN 服务器');
        console.error('  3. 防火墙阻止 UDP 连接');
      } else if (pc.iceConnectionState === 'connected') {
        console.log('[WebRTC Receiver] ✓ ICE 连接成功');
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC Receiver] ICE 收集状态:', pc.iceGatheringState);
    };
  }, []);

  // 处理 DataChannel 事件
  const handleDataChannelEvent = useCallback((event: RTCDataChannelEvent) => {
    const channel = event.channel;

    console.log('═'.repeat(50));
    console.log('[WebRTC Receiver] 收到 DataChannel:', channel.label);
    console.log('[WebRTC Receiver] DataChannel 状态:', channel.readyState);
    console.log('[WebRTC Receiver] 启用的通道:', channels.join(', '));

    if (channels.includes('commands') && channel.label === 'exam-commands') {
      console.log('[WebRTC Receiver] ✓ 设置笔试命令 DataChannel');
      setupExamCommandChannel(channel);
    }

    if (channels.includes('text') && channel.label === 'recognition-text') {
      console.log('[WebRTC Receiver] ✓ 设置文字传输 DataChannel');
      setupTextChannel(channel);
    }

    console.log('═'.repeat(50));
  }, [channels]);

  // 创建 PeerConnection
  const createPeerConnection = () => {
    console.log('[WebRTC Receiver] 创建 PeerConnection...');
    const pc = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
    peerConnectionRef.current = pc;

    setupPeerConnectionListeners(pc);
    pc.ondatachannel = handleDataChannelEvent;

    return pc;
  };

  // 设置笔试命令 DataChannel 处理
  const setupExamCommandChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log('[WebRTC Receiver] 📝 笔试命令 DataChannel 已打开');
    };

    channel.onclose = () => {
      console.log('[WebRTC Receiver] 📝 笔试命令 DataChannel 已关闭');
      chunkBufferRef.current.clear();
    };

    channel.onerror = (event) => {
      const error = (event as RTCErrorEvent).error;
      if (isNormalDataChannelClose(error)) {
        return;
      }

      console.error('[WebRTC Receiver] 📝 笔试命令 DataChannel 错误:', error);
    };

    channel.onmessage = (event) => {
      try {
        const messageStr = event.data as string;
        const message = JSON.parse(messageStr);

        if (message.type.endsWith('-chunk')) {
          handleChunkMessage(
            message,
            chunkBufferRef.current,
            (completeMessage) => {
              handleCompleteExamMessage(completeMessage, examCommandCallbackRef.current);
            }
          );
        } else {
          handleCompleteExamMessage(message, examCommandCallbackRef.current);
        }
      } catch (error) {
        console.error('[WebRTC Receiver] 解析笔试命令失败:', error);
      }
    };
  };

  // 设置文字传输 DataChannel 处理
  const setupTextChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log('[WebRTC Receiver] 💬 文字传输 DataChannel 已打开');
    };

    channel.onclose = () => {
      console.log('[WebRTC Receiver] 💬 文字传输 DataChannel 已关闭');
      setMicrophoneVolume(0);
      setSystemAudioVolume(0);
    };

    channel.onerror = (event) => {
      const error = (event as RTCErrorEvent).error;
      if (isNormalDataChannelClose(error)) {
        return;
      }

      console.error('[WebRTC Receiver] 💬 文字传输 DataChannel 错误:', error);
    };

    channel.onmessage = (event) => {
      try {
        const messageStr = event.data as string;
        const message = JSON.parse(messageStr);

        if (message.type === 'volume') {
          handleVolumeMessage(
            message as VolumeMessage,
            setMicrophoneVolume,
            setSystemAudioVolume
          );
        } else {
          handleTextMessage(message as RecognitionTextMessage, textCallbackRef.current);
        }
      } catch (error) {
        console.error('[WebRTC Receiver] 解析消息失败:', error);
      }
    };
  };

  // 连接（生成配对码并注册）
  const connect = useCallback(async () => {
    try {
      console.log('[WebRTC Receiver] 开始连接流程...');

      // 打开Modal
      setIsModalVisible(true);

      // 等待 Socket 连接完成
      const socket = await initSocketConnection();
      console.log('[WebRTC Receiver] Socket 连接已就绪, Socket ID:', socket.id);

      // 生成配对码
      const code = generatePairingCode();
      console.log('[WebRTC Receiver] 生成新配对码:', code);

      // 立即设置配对码
      setPairingCode(code);

      // 注册配对码到信令服务器
      console.log('[WebRTC Receiver] 向服务器注册配对码:', code);

      socket.emit('register-pairing-code', code, (result: SignalingCallbackResult) => {
        if (result.success) {
          console.log('[WebRTC Receiver] ✓ 配对码注册成功:', code);
          setConnectionState('connecting');
        } else {
          console.error('[WebRTC Receiver] ✗ 配对码注册失败:', result.error);
          setPairingCode('');
          setConnectionState('failed');
          setIsModalVisible(false);
        }
      });
    } catch (error) {
      console.error('[WebRTC Receiver] 连接失败:', error);
      setPairingCode('');
      setConnectionState('failed');
      setIsModalVisible(false);
    }
  }, [initSocketConnection]);

  // 断开连接
  const disconnect = useCallback(async (): Promise<void> => {
    return new Promise((resolve) => {
      console.log('[WebRTC Receiver] 断开连接');

      // 设置手动断开标志（确保 socket.on('disconnect') 能正确识别）
      isManualDisconnectRef.current = true;

      // 关闭Modal
      setIsModalVisible(false);

      // 清理 Socket 连接超时定时器
      if (socketTimeoutRef.current) {
        clearTimeout(socketTimeoutRef.current);
        socketTimeoutRef.current = null;
      }

      // Guard Clause: Socket 不存在时直接清理状态
      if (!socketRef.current) {
        console.log('[WebRTC Receiver] Socket 不存在，直接清理状态');
        setPairingCode('');
        setSocketConnected(false);
        setConnectionState('disconnected');
        resolve();
        return;
      }

      // 捕获本次要断开的 socket，避免 disconnect 的晚到回调误伤新连接
      const socketAtDisconnect = socketRef.current;

      // 注册断开监听（仅做收尾，不影响本次 Promise）
      socketAtDisconnect.once('disconnect', () => {
        console.log('[WebRTC Receiver] Socket 已完全断开');

        // 仅当"当前 socket 仍然是本次断开的 socket"时，才允许清理全局状态
        if (socketRef.current === socketAtDisconnect) {
          socketRef.current = null;
          setPairingCode('');
          setSocketConnected(false);
          setConnectionState('disconnected');
        }

        // 重置手动断开标志
        isManualDisconnectRef.current = false;
      });

      // 发送断开信令
      socketAtDisconnect.emit('manual-disconnect');

      // 清理 PeerConnection
      cleanupPeerConnection();

      // 断开 Socket 连接
      socketAtDisconnect.disconnect();

      // 快速重连语义：发起断开后立即完成，避免刷新流程卡住
      resolve();
    });
  }, []);

  // 重连 Socket（复用配对码，用于 iOS Safari 后台恢复）
  const reconnectSocket = useCallback(async (code: string) => {
    console.log('[WebRTC Receiver] 开始重连 Socket，配对码:', code);

    // Guard Clause: 如果 Socket 已连接，直接返回
    if (socketRef.current?.connected) {
      console.log('[WebRTC Receiver] Socket 已连接，无需重连');
      return;
    }

    // 重新建立 Socket 连接
    console.log('[WebRTC Receiver] 重新建立 Socket 连接...');
    let socket;
    try {
      socket = await initSocketConnection();
    } catch (error) {
      console.error('[WebRTC Receiver] Socket 重连过程出错:', error);
      Modal.error({
        title: '重连失败',
        content: '连接过程出现错误，请刷新页面重新建立连接。',
        okText: '知道了'
      });
      manualDisconnect();
      return;
    }

    // 重新注册配对码
    console.log('[WebRTC Receiver] 重新注册配对码:', code);
    socket.emit('register-pairing-code', code, (result: SignalingCallbackResult) => {
      if (result.success) {
        console.log('[WebRTC Receiver] ✓ Socket 重连成功');
        setSocketConnected(true);
        setConnectionState('connected');
        return;
      }

      // 配对码注册失败
      console.error('[WebRTC Receiver] ✗ 重连失败:', result.error);
      Modal.error({
        title: '重连失败',
        content: `连接失败：${result.error}\n\n请刷新页面重新建立连接。`,
        okText: '知道了'
      });
      manualDisconnect();
    });
  }, [initSocketConnection]);

  // 手动断开（明确的用户操作触发）
  const manualDisconnect = useCallback(async () => {
    console.log('[WebRTC Receiver] 执行手动断开');

    // 设置手动断开标志
    isManualDisconnectRef.current = true;

    // 发送手动断开信令到服务器
    if (socketRef.current?.connected) {
      socketRef.current.emit('manual-disconnect');
    }

    // 执行正常的 disconnect 逻辑
    await disconnect();

    // 重置标志（供下次使用）
    isManualDisconnectRef.current = false;
  }, [disconnect]);

  // 保持 disconnect 引用最新
  useEffect(() => {
    disconnectRef.current = disconnect;
  }, [disconnect]);

  // 监听页面可见性变化（iOS Safari 后台重连支持）
  useEffect(() => {
    const handleVisibilityChange = () => {
      // Guard Clause: 只处理页面变为可见的情况
      if (document.visibilityState !== 'visible') {
        return;
      }

      console.log('[WebRTC Receiver] 页面恢复到前台');

      const pc = peerConnectionRef.current;
      const socket = socketRef.current;

      // Guard Clause: 检查是否需要重连（PeerConnection 仍连接，但 Socket 断开，且配对码存在）
      const needReconnect = pc?.connectionState === 'connected' && !socket?.connected && pairingCode;
      if (!needReconnect) {
        return;
      }

      console.log('[WebRTC Receiver] 检测到 DataChannel 连接但 Socket 断开，询问用户是否重连');

      // 弹出 Modal 询问用户是否重连
      Modal.confirm({
        title: '设备连接已断开',
        content: '检测到您的设备连接中断。\n\n是否重新连接？',
        okText: '重新连接',
        cancelText: '断开连接',
        onOk: () => {
          reconnectSocket(pairingCode);
        },
        onCancel: () => {
          // 用户选择不重连，执行手动断开
          manualDisconnect();
        }
      });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [pairingCode, reconnectSocket, manualDisconnect]);

  // 组件卸载时清理（只在卸载时运行一次）
  useEffect(() => {
    return () => {
      // 组件卸载时执行手动断开
      console.log('[WebRTC Receiver] 组件卸载，执行手动断开');
      isManualDisconnectRef.current = true;

      if (disconnectRef.current) {
        disconnectRef.current();
      }
    };
  }, []); // 空依赖数组，只在组件卸载时运行

  return {
    pairingCode,
    connectionState,
    socketConnected,
    microphoneVolume,
    systemAudioVolume,
    isModalVisible,
    setIsModalVisible,
    ...(channels.includes('text') && { registerTextCallback }),
    connect,
    disconnect,
    manualDisconnect  // 新增：手动断开函数
  };
}

