import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Select, Button, Space, message, Badge, Tag } from 'antd';
import { ReloadOutlined, PlusOutlined, QuestionCircleOutlined, DisconnectOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import DeviceConnection from '../components/DeviceConnection';
import { useWebRTCSender } from '../hooks/webRtcSender';
import { useElectronEvents } from '../hooks/useElectronEvents';
import { useAudioDevices } from '../hooks/useAudioDevices';
import { useRecognitionSession } from '../hooks/useRecognitionSession';
import { SystemAudioMock } from '../test/mocks/systemaudiomock';

const AudioPanel: React.FC = () => {
  const [connectModalVisible, setConnectModalVisible] = useState(false);

  // 音频流引用
  const micStreamRef = useRef<MediaStream | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);

  // 音频流状态（用于触发 Hook 重新启动采集，支持连接后切换）
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [systemStream, setSystemStream] = useState<MediaStream | null>(null);

  // 本地音量状态（用于 UI 显示）
  const [microphoneVolume, setMicrophoneVolume] = useState<number>(0);
  const [systemAudioVolume, setSystemAudioVolume] = useState<number>(0);

  // 测试音频相关状态
  const [testAudioPlaying, setTestAudioPlaying] = useState(false);
  const speakerMockRef = useRef<SystemAudioMock | null>(null);

  // 使用音频设备管理 Hook
  const {
    microphoneDevices,
    systemAudioSources,
    outputDeviceType,
    selectedMicrophone,
    selectedSystemAudio,
    setSelectedMicrophone,
    setSelectedSystemAudio,
    refreshDevices
  } = useAudioDevices();

  // WebRTC 发送端 Hook - 使用文字和命令通道（Electron 识别模式）
  const {
    connectionState,
    connect: connectWebRTC,
    disconnect: disconnectWebRTC,
    sendExamCommand,
    sendRecognitionText,
    sendVolumeUpdate
  } = useWebRTCSender(micStreamRef, systemStreamRef, { channels: ['text', 'commands'] });
  
  // 语音识别会话 Hook（自动管理识别生命周期）
  useRecognitionSession({
    connectionState,
    micStream,
    systemStream,
    sendRecognitionText,
    sendVolumeUpdate,
    onMicVolumeUpdate: setMicrophoneVolume,
    onSystemVolumeUpdate: setSystemAudioVolume
  });

  // 使用 Electron 事件监听 Hook
  useElectronEvents({
    sendExamCommand,
    connectionState,
    enabled: true
  });

  const handleShowTutorial = () => {
    // 使用系统默认浏览器打开链接
    window.electronAPI.shell.openExternal('https://docs.offercar.cn');
  };

  const handleConnectDevice = () => {
    setConnectModalVisible(true);
  };

  // 创建并启动麦克风流
  const handleMicrophoneChange = useCallback(async (deviceId: string) => {
    try {
      // 停止之前的流
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      setMicStream(null);
      setMicrophoneVolume(0);

      console.log('[AudioPanel] 开始捕获麦克风音频，设备ID:', deviceId);

      let stream: MediaStream | null = null;
      
      // 尝试使用 exact 约束强制启用 AEC
      try {
        console.log('[AEC] 尝试使用 exact 约束启用 AEC...');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
            echoCancellation: { exact: true },     // 强制启用回声消除
            noiseSuppression: { exact: true },     // 强制启用噪声抑制
            autoGainControl: { exact: true },      // 强制启用自动增益控制
            sampleRate: 16000,                     // 匹配 AudioContext 采样率
            channelCount: 1                        // 单声道
          }
        });
        console.log('[AEC] ✓ exact 约束成功');
      } catch (exactError) {
        // 降级策略：如果设备不支持 exact 约束，使用普通 true
        console.warn('[AEC] exact 约束失败，降级为普通约束:', exactError);
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: deviceId === 'default' ? undefined : { exact: deviceId },
            echoCancellation: true,      // 启用回声消除
            noiseSuppression: true,      // 启用噪声抑制
            autoGainControl: true        // 启用自动增益控制
          }
        });
        console.log('[AEC] ✓ 普通约束成功');
      }

      // 验证 AEC 是否真正应用
      // const audioTrack = stream.getAudioTracks()[0];
      // const settings = audioTrack.getSettings();
      // const capabilities = audioTrack.getCapabilities();


      // 存储到 ref（供 WebRTC 使用）
      micStreamRef.current = stream;
      setMicStream(stream);
      // console.log('[AudioPanel] ✓ 麦克风流已创建并存储到 ref');

      message.success('麦克风已启动');
    } catch (error) {
      console.error('[AudioPanel] 麦克风启动失败:', error);
      message.error('麦克风启动失败，请检查权限');
    }
  }, []);

  // 创建并启动系统音频流
  const handleSystemAudioChange = useCallback(async (sourceId: string) => {
    try {
      // 停止之前的流
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
        systemStreamRef.current = null;
      }
      setSystemStream(null);
      setSystemAudioVolume(0);

      console.log('[AudioPanel] 开始捕获系统音频...');

      // 获取系统音频流（必须 video: true，系统音频编码在其中）
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } as any,
        video: true  // 必须为 true，否则无法捕获系统音频
      } as any);

      // 提取音频轨道
      const audioTracks = displayStream.getAudioTracks();

      if (audioTracks.length === 0) {
        console.error('[AudioPanel] ❌ 未捕获到音频轨道');
        message.error('未检测到系统音频，请重新选择并勾选"分享系统音频"');
        throw new Error('No audio tracks in display stream');
      }

      // 创建纯音频流
      const audioOnlyStream = new MediaStream(audioTracks);
      console.log('[AudioPanel] ✓ 系统音频流已创建，轨道数:', audioOnlyStream.getAudioTracks().length);

      // 停止 video 轨道（节省资源）
      displayStream.getVideoTracks().forEach(track => track.stop());

      // 存储到 ref（供 WebRTC 使用）
      systemStreamRef.current = audioOnlyStream;
      setSystemStream(audioOnlyStream);
      console.log('[AudioPanel] ✓ 系统音频流已存储到 ref');

      message.success('系统音频已启动');
    } catch (error) {
      console.error('[AudioPanel] 系统音频启动失败:', error);
      message.error('系统音频启动失败，请检查权限');
    }
  }, []);

  // 连接处理函数
  const handleConnectWithCode = async (code: string) => {
    await connectWebRTC(code);
  };

  // 断开连接
  const handleDisconnect = () => {
    disconnectWebRTC();
    message.info('连接已断开');
  };

  // 播放测试音频
  const handlePlayTestAudio = useCallback(async () => {
    try {
      console.log('[AudioPanel] 开始播放测试音频...');

      // 创建 Mock 实例
      if (!speakerMockRef.current) {
        speakerMockRef.current = new SystemAudioMock();
      }

      // 播放音频到扬声器
      await speakerMockRef.current.play({
        audioFilePath: '/mock/question_mock.mp3',
        loop: true,
        volume: 0.8
      });

      setTestAudioPlaying(true);
      message.success('测试音频播放中');
      console.log('[AudioPanel] ✓ 测试音频播放成功');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[AudioPanel] 测试音频播放失败:', err);
      message.error(`测试音频播放失败: ${errorMsg}`);
      setTestAudioPlaying(false);
    }
  }, []);

  // 停止测试音频
  const handleStopTestAudio = useCallback(() => {
    console.log('[AudioPanel] 停止测试音频...');

    if (speakerMockRef.current) {
      speakerMockRef.current.stop();
      speakerMockRef.current = null;
    }

    setTestAudioPlaying(false);
    message.info('测试音频已停止');
    console.log('[AudioPanel] ✓ 测试音频已停止');
  }, []);

  // 监听麦克风设备变化
  useEffect(() => {
    if (selectedMicrophone && selectedMicrophone !== 'default') {
      handleMicrophoneChange(selectedMicrophone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicrophone]);

  // 监听系统音频源变化
  useEffect(() => {
    if (selectedSystemAudio && selectedSystemAudio !== 'default') {
      handleSystemAudioChange(selectedSystemAudio);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSystemAudio]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 停止音频流
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (systemStreamRef.current) {
        systemStreamRef.current.getTracks().forEach(track => track.stop());
        systemStreamRef.current = null;
      }
      setMicStream(null);
      setSystemStream(null);
      setMicrophoneVolume(0);
      setSystemAudioVolume(0);

      // 停止测试音频
      if (speakerMockRef.current) {
        speakerMockRef.current.stop();
        speakerMockRef.current = null;
      }

      // 断开 WebRTC
      disconnectWebRTC();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: '0' }}>
      <Card
        // title="音频设备选择"
        style={{ marginBottom: 0 }}
      // extra={

      // }

      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {/* 麦克风选择 */}
          <div>
            <div style={{ 
              marginBottom: 8, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center' 
            }}>
              <span style={{ fontWeight: 500 }}>麦克风:</span>
              <Button
                icon={<ReloadOutlined />}
                onClick={refreshDevices}
                size="small"
              >
                刷新
              </Button>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Select
                style={{ flex: 1 }}
                value={selectedMicrophone}
                onChange={setSelectedMicrophone}
                placeholder="选择麦克风设备"
                options={microphoneDevices.map(device => ({
                  key: device.deviceId,
                  value: device.deviceId,
                  label: device.label
                }))}
              />
              <div style={{ width: '8px', height: '32px', position: 'relative' }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${microphoneVolume}%`,
                    background: '#52c41a',
                    transition: 'height 0.1s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>

          {/* 系统音频选择 */}
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>系统音频:</div>
            <div style={{
              marginBottom: 8,
              fontSize: 12,
              padding: '6px 10px',
              background: outputDeviceType === 'headphone' ? '#f6ffed' : '#fff7e6',
              border: outputDeviceType === 'headphone' ? '1px solid #b7eb8f' : '1px solid #ffd591',
              borderRadius: 4
            }}>
              {outputDeviceType === 'headphone' && (
                <>
                  <span style={{ color: '#52c41a', fontWeight: 500 }}>✓ 检测到耳机设备</span>
                  <span style={{ color: '#8c8c8c' }}> - 音频体验最佳</span>
                </>
              )}
              {outputDeviceType === 'speaker' && (
                <>
                  <span style={{ color: '#fa8c16', fontWeight: 500 }}>⚠ 当前使用扬声器播放</span>
                  <span style={{ color: '#8c8c8c' }}> - 建议使用耳机以获得最佳音频体验</span>
                </>
              )}
              {outputDeviceType === 'unknown' && (
                <span style={{ color: '#8c8c8c' }}>正在检测音频输出设备...</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Select
                style={{ flex: 1 }}
                value={selectedSystemAudio}
                onChange={setSelectedSystemAudio}
                placeholder="选择系统音频源"
                options={systemAudioSources.map(source => ({
                  key: source.id,
                  value: source.id,
                  label: source.name
                }))}
              />
              <div style={{ width: '8px', height: '32px', position: 'relative' }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  background: '#f0f0f0',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${systemAudioVolume}%`,
                    background: '#52c41a',
                    transition: 'height 0.1s ease'
                  }} />
                </div>
              </div>
            </div>
          </div>
        </Space>
      </Card>

      {/* <Divider /> */}

      {/* 连接其他设备 */}
      <Card
        // title="连接其他设备" 
        style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <Space>
            <Badge
              status={connectionState === 'connected' ? 'success' : connectionState === 'connecting' ? 'processing' : 'default'}
              text={
                connectionState === 'connected' ? '已连接 1 台设备' :
                  connectionState === 'connecting' ? '连接中...' :
                    '已连接 0 台设备'
              }
            />
          </Space>
        </div>

        <Space>
          <Button
            icon={<QuestionCircleOutlined />}
            onClick={handleShowTutorial}
          >
            使用教程
          </Button>

          {connectionState === 'disconnected' || connectionState === 'failed' ? (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleConnectDevice}
            >
              连接设备
            </Button>
          ) : (
            <Button
              danger
              icon={<DisconnectOutlined />}
              onClick={handleDisconnect}
            >
              断开连接
            </Button>
          )}

          {!testAudioPlaying ? (
            <Button
              icon={<PlayCircleOutlined />}
              onClick={handlePlayTestAudio}
            >
              播放测试音频
            </Button>
          ) : (
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStopTestAudio}
            >
              停止测试音频
            </Button>
          )}
          
        </Space>

        {/* 音频源状态提示 */}
        {/* {(micStreamRef.current || systemStreamRef.current) && (
          <div style={{
            marginTop: 12,
            padding: 8,
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            borderRadius: 4,
            fontSize: 12,
            color: '#0958d9'
          }}>
            {micStreamRef.current && ' 麦克风（面试者）'}
            {micStreamRef.current && systemStreamRef.current && ' + '}
            {systemStreamRef.current && ' 系统音频（面试官）'}
          </div>
        )} */}
      </Card>

      {/* 底部版本信息 */}
      <div style={{
        textAlign: 'center',
        marginTop: 20,
        color: '#999',
        fontSize: 12
      }}>
        OfferCar 版权所有 v1.0.1
      </div>

      {/* 设备连接弹窗 */}
      <DeviceConnection
        visible={connectModalVisible}
        onClose={() => setConnectModalVisible(false)}
        onConnect={handleConnectWithCode}
        isConnecting={connectionState === 'connecting'}
      />
    </div>
  );
};

export default AudioPanel;

