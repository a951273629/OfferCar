import React from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  LinkOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import type { ConnectionState } from '@/types/webrtc';

interface ExamDeviceStatusPanelProps {
  connectionState: ConnectionState;
  onConnectDevice: () => void;
  onShowShortcutGuide: () => void;
}

/**
 * 笔试设备状态面板组件（移动端专用）
 * 显示快捷键指南和连接设备按钮
 */
export function ExamDeviceStatusPanel({
  connectionState,
  onConnectDevice,
  onShowShortcutGuide,
}: ExamDeviceStatusPanelProps) {
  // 触摸设备上 Tooltip 往往由“点击外部”关闭，但引导遮罩可能拦截触摸导致 Tooltip 长驻
  const isTouchDevice = typeof window !== 'undefined' && (
    'ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0
  );

  return (
    <Space size="small" style={{ width: '100%', justifyContent: 'center' }}>
      {/* 快捷键指南按钮 */}
      <Tooltip title="查看快捷键说明">
        <Button
          shape="round"
          icon={<InfoCircleOutlined />}
          onClick={onShowShortcutGuide}
          size="small"
        />
      </Tooltip>

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
          icon={<LinkOutlined />}
          onClick={onConnectDevice}
          loading={connectionState === 'connecting'}
          size="small"
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
    </Space>
  );
}

