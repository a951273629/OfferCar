import type { SignalingCallbackResult } from '../types/webrtc';

/**
 * 处理缓存的 ICE 候选队列
 */
export async function processPendingIceCandidates(
  pc: RTCPeerConnection,
  pendingCandidates: RTCIceCandidateInit[]
): Promise<void> {
  if (pendingCandidates.length === 0) {
    return;
  }
  
  console.log('[WebRTC Sender] 开始处理缓存的 ICE 候选，数量:', pendingCandidates.length);
  
  for (const [index, candidate] of pendingCandidates.entries()) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log(`[WebRTC Sender] 处理缓存候选 ${index + 1}/${pendingCandidates.length}`);
    } catch (err) {
      console.error(`[WebRTC Sender] 处理缓存候选失败 ${index + 1}:`, err);
    }
  }
  
  console.log('[WebRTC Sender] 缓存的 ICE 候选已全部处理完成');
}

/**
 * 等待 Socket 连接就绪
 */
export async function waitForSocketConnection(currentSocket: any): Promise<void> {
  if (currentSocket.connected) {
    return;
  }
  
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      currentSocket.off('connect', onConnect);
      currentSocket.off('disconnect', onDisconnect);
      currentSocket.off('connect_error', onError);
      reject(new Error('信令服务器连接超时'));
    }, 5000);

    const onConnect = () => {
      clearTimeout(timeout);
      currentSocket.off('disconnect', onDisconnect);
      currentSocket.off('connect_error', onError);
      console.log('[WebRTC Sender] Socket 连接成功');
      resolve();
    };

    const onDisconnect = () => {
      clearTimeout(timeout);
      currentSocket.off('connect', onConnect);
      currentSocket.off('connect_error', onError);
      reject(new Error('Socket 连接被中断'));
    };

    const onError = (error: Error) => {
      clearTimeout(timeout);
      currentSocket.off('connect', onConnect);
      currentSocket.off('disconnect', onDisconnect);
      reject(new Error(`Socket 连接错误: ${error.message}`));
    };

    currentSocket.once('connect', onConnect);
    currentSocket.once('disconnect', onDisconnect);
    currentSocket.once('connect_error', onError);
  });
}

/**
 * 创建并发送 Offer
 */
export async function createAndSendOffer(
  pc: RTCPeerConnection,
  currentSocket: any,
  pairingCode: string,
  setConnectionState: (state: any) => void
): Promise<void> {
  if (!pc) {
    throw new Error('PeerConnection 不存在');
  }
  
  const offer = await pc.createOffer({});
  await pc.setLocalDescription(offer);
  console.log('[WebRTC Sender] Local Description (Offer) 已设置');

  return new Promise<void>((resolve, reject) => {
    currentSocket.emit('offer', { offer, code: pairingCode }, (result: SignalingCallbackResult) => {
      if (!result.success) {
        console.error('[WebRTC Sender] Offer 发送失败:', result.error);
        setConnectionState('failed');
        reject(new Error(result.error || 'Offer发送失败'));
        return;
      }
      
      console.log('[WebRTC Sender] Offer 已发送');
      resolve();
    });
  });
}

/**
 * 连接到配对码
 */
export async function connectToPairingCode(
  currentSocket: any,
  pairingCode: string,
  createPeerConnection: () => RTCPeerConnection,
  setupConnectionTimeout: () => void,
  createAndSendOfferWrapper: (pc: RTCPeerConnection) => Promise<void>,
  setConnectionState: (state: any) => void
): Promise<void> {
  console.log('[WebRTC Sender] 请求连接配对码:', pairingCode);
  
  return new Promise<void>((resolve, reject) => {
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
        await createAndSendOfferWrapper(pc);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

