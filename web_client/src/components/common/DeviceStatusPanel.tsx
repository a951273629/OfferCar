import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  LaptopOutlined,
  TeamOutlined,
  ApiOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ConnectionState } from '@/types/webrtc';

interface DeviceStatusPanelProps {
  deviceStatus: {
    local: boolean;
    remote: boolean;
  };
  connectionState: ConnectionState;
  microphoneVolume: number;  // 0-100
  systemAudioVolume: number; // 0-100
  onToggleDevice: (device: 'local' | 'remote' | 'connected') => void;
  onShowShortcutGuide: () => void;
  isMobile?: boolean;  // 是否为移动端模式
}

/**
 * 设备状态面板组件
 * 显示设备连接状态和实时音量
 */
export function DeviceStatusPanel({
  deviceStatus,
  connectionState,
  microphoneVolume,
  systemAudioVolume,
  onToggleDevice,
  onShowShortcutGuide,
  isMobile = false,
}: DeviceStatusPanelProps) {
  const buttonSize = isMobile ? 'small' : 'middle';
  const spacing = isMobile ? 'small' : 'middle';
  // 触摸设备上 Tooltip 往往由“点击外部”关闭，但引导遮罩可能拦截触摸导致 Tooltip 长驻
  const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0
  );
  
  return (
    <Space size={spacing}>
      {/* 本机按钮 + 麦克风音量柱 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
        <Tooltip title={deviceStatus.local ? '本机已连接' : '本机未连接'}>
          <Button
            type={deviceStatus.local ? 'primary' : 'default'}
            shape="round"
            icon={<LaptopOutlined />}
            size={buttonSize}
          >
            {!isMobile && '本机'}
          </Button>
        </Tooltip>
        
        {/* 麦克风音量柱 */}
        <Tooltip title={`面试者音量: ${microphoneVolume}%`}>
          <div style={{ width: isMobile ? '6px' : '8px', height: isMobile ? '24px' : '32px', position: 'relative' }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-bg-gray-3)',
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
                background: microphoneVolume > 0 ? 'var(--color-interviewee)' : 'var(--color-bg-gray-3)',  // 紫色表示面试者
                transition: 'height 0.1s ease'
              }} />
            </div>
          </div>
        </Tooltip>
      </div>
      
      {/* 客户端按钮 + 系统音频音量柱 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '8px' }}>
        <Tooltip title={deviceStatus.remote ? '客户端已连接' : '客户端未连接'}>
          <Button
            type={deviceStatus.remote ? 'primary' : 'default'}
            shape="round"
            icon={<TeamOutlined />}
            size={buttonSize}
          >
            {!isMobile && '客户端'}
          </Button>
        </Tooltip>
        
        {/* 系统音频音量柱 */}
        <Tooltip title={`面试官音量: ${systemAudioVolume}%`}>
          <div style={{ width: isMobile ? '6px' : '8px', height: isMobile ? '24px' : '32px', position: 'relative' }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: 'var(--color-bg-gray-3)',
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
                background: systemAudioVolume > 0 ? 'var(--color-interviewer)' : 'var(--color-bg-gray-3)',  // 蓝色表示面试官
                transition: 'height 0.1s ease'
              }} />
            </div>
          </div>
        </Tooltip>
      </div>
      
      {/* 连接设备按钮 */}
      <Tooltip
        open={isTouchDevice ? false : undefined}
        title={
          connectionState === 'disconnected' ? '点击生成配对码' :
          connectionState === 'connected' ? '设备已连接' :
          '连接中...'
        }
      >
        <Button
          id="connect-device-button"
          type={connectionState === 'connected' ? 'primary' : 'default'}
          shape="round"
          icon={<ApiOutlined />}
          onClick={() => onToggleDevice('connected')}
          loading={connectionState === 'connecting'}
          size={buttonSize}
          style={{
            background: connectionState === 'connected' ? '#52c41a' : undefined,
            borderColor: connectionState === 'connected' ? '#52c41a' : undefined,
          }}
        >
          {connectionState === 'disconnected' ? '连接设备' : 
           connectionState === 'connected' ? '已连接' : 
           '连接中'}
        </Button>
      </Tooltip>
      
      {/* 快捷键指南按钮 */}
      <Tooltip title="查看快捷键说明">
        <Button
          shape="round"
          icon={<InfoCircleOutlined />}
          onClick={onShowShortcutGuide}
          size={buttonSize}
        >
          {!isMobile && '快捷键指南'}
        </Button>
      </Tooltip>
    </Space>
  );
}


