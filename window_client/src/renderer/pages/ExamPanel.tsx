import React, { useState, useEffect, useRef } from 'react';
import { Card, Button, Space, Badge, message } from 'antd';
import { PlusOutlined, QuestionCircleOutlined, DisconnectOutlined } from '@ant-design/icons';
import DeviceConnection from '../components/DeviceConnection';
import { useWebRTCSender } from '../hooks/webRtcSender';
import { useElectronEvents } from '../hooks/useElectronEvents';

const ExamPanel: React.FC = () => {
  const [connectModalVisible, setConnectModalVisible] = useState(false);
  
  // 笔试模式不需要音频流，创建空 ref
  const emptyMicRef = useRef<MediaStream | null>(null);
  const emptySystemRef = useRef<MediaStream | null>(null);

  // WebRTC 发送端 Hook - 笔试模式（只使用命令通道）
  const {
    connectionState,
    connect: connectWebRTC,
    disconnect: disconnectWebRTC,
    sendExamCommand
  } = useWebRTCSender(emptyMicRef, emptySystemRef, { channels: ['commands'] });

  const handleShowTutorial = () => {
    message.info('使用教程功能开发中');
  };

  const handleConnectDevice = () => {
    setConnectModalVisible(true);
  };

  // 连接处理函数
  const handleConnectWithCode = async (code: string) => {
    await connectWebRTC(code);
  };

  // 断开连接
  const handleDisconnect = () => {
    disconnectWebRTC();
    message.info('连接已断开');
  };

  // 使用 Electron 事件监听 Hook
  useElectronEvents({
    sendExamCommand,
    connectionState,
    enabled: true
  });

  // 组件卸载时断开连接
  useEffect(() => {
    return () => {
      disconnectWebRTC();
    };
  }, [disconnectWebRTC]);

  return (
    <div style={{ padding: '0' }}>
      {/* 笔试模式说明 */}
      <Card style={{ marginBottom: 8 }}>
        <div style={{ 
          padding: 8, 
          background: '#e6f7ff', 
          border: '1px solid #91d5ff',
          borderRadius: 4,
          marginBottom: 8
        }}>
          <div style={{ marginBottom: 6, fontWeight: 500, color: '#0958d9' }}>
             笔试模式说明
          </div>
          <div style={{ fontSize: 12, color: '#595959', lineHeight: 1.6 }}>
            <p style={{ margin: '4px 0' }}>• Ctrl+Shift+Space: 截取屏幕并发送到 Web 端</p>
            <p style={{ margin: '4px 0' }}>• Ctrl+Shift+Enter: 触发快速回答</p>
            <p style={{ margin: '4px 0' }}>• Ctrl+C: 复制的文本会自动同步到 Web 端</p>
          </div>
        </div>
      </Card>

      {/* 连接设备 */}
      <Card title="连接其他设备" style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: 12 }}>
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
        </Space>
        
        {/* 连接状态提示 */}
        {connectionState === 'connected' && (
          <div style={{ 
            marginTop: 8, 
            padding: 8, 
            background: '#f6ffed', 
            border: '1px solid #b7eb8f',
            borderRadius: 4,
            fontSize: 12,
            color: '#389e0d'
          }}>
            ✓ 设备已连接，快捷键已激活
          </div>
        )}
      </Card>

      {/* 底部版本信息 */}
      <div style={{ 
        textAlign: 'center', 
        // marginTop: 12, 
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

export default ExamPanel;

