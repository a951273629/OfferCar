'use client';

import { Card, Typography, Space, Button, Modal, App, Input, Alert } from 'antd';
import { CopyOutlined, ReloadOutlined } from '@ant-design/icons';
import { message } from 'antd';
import Link from 'next/link';
import type { ConnectionState } from '@/types/webrtc';

const { Text, Paragraph } = Typography;

interface PairingCodeDisplayProps {
  code: string;
  connectionState: ConnectionState;
  isModalVisible: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

// 文档链接常量
const DOCS_BASE_URL = process.env.NEXT_PUBLIC_DOCS_URL;
const DOCS_LINKS = {
  deviceConnection: `${DOCS_BASE_URL}/docs/device-connection`,
  installation: `${DOCS_BASE_URL}/docs/installation`,
  contact: `${DOCS_BASE_URL}/docs/contact`,
};

export function PairingCodeDisplay({ 
  code, 
  connectionState, 
  isModalVisible, 
  onClose, 
  onRefresh 
}: PairingCodeDisplayProps) {
  const { modal } = App.useApp();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      message.success('配对码已复制');
    } catch (error) {
      message.error('复制失败');
    }
  };

  const handleClose = () => {
    // Early Return: 非连接状态直接关闭
    if (connectionState !== 'connecting') {
      onClose();
      return;
    }
    
    // 连接中需要确认
    modal.confirm({
      title: '确认关闭',
      content: '配对码正在等待客户端连接，关闭后需要重新生成配对码。确定关闭吗？',
      onOk: async () => {
        onClose();
      },
      onCancel: () => {
        // 不关闭 Modal
      }
    });
  };

  return (
    <Modal
      title="连接客户端配置"
      maskClosable={false}
      keyboard={false}
      open={isModalVisible}
      onCancel={handleClose}
      footer={null}
      centered
      width={450}
    >
      {/* 连接失败提示 - 使用 Alert 组件 */}
      {connectionState === 'failed' && (
        <Alert
          message="连接失败，请点击刷新重试"
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* 配对码显示卡片 */}
      <Card 
        size="small" 
        style={{ 
          textAlign: 'center',
          border: 'none'
        }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* 顶部提示文字 */}
          <Text type="secondary">
            请在客户端输入以下配对码来连接设备
          </Text>
          
          {/* 配对码 OTP 显示 */}
          <Input.OTP
            id="pairing-code-input"
            length={6}
            value={code}
            disabled
            style={{
              display: 'flex',
              justifyContent: 'center',
            }}
            variant="filled"
          />

          {/* 按钮区域 */}
          <Space>
            <Button 
              type="text" 
              icon={<CopyOutlined />}
              onClick={handleCopy}
              disabled={!code}
            >
              复制
            </Button>
            
            {onRefresh && (
              <Button 
                type="primary"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
              >
                重新生成配对码
              </Button>
            )}
          </Space>

          {/* 底部提示列表 - 使用 Typography 组件 */}
          <div style={{ textAlign: 'left' }}>
            <Paragraph style={{ fontSize: 12, marginBottom: 8 }}>
              • 请确保您台式电脑连接到同一个Wi-Fi（
              <Link 
                href={DOCS_LINKS.deviceConnection}
                target="_blank"
              >
                为什么连不上？
              </Link>
              ）
            </Paragraph>
            
            <Paragraph style={{ fontSize: 12, marginBottom: 8 }}>
              • 在测试/宣传的电脑上
              <Link 
                href={DOCS_LINKS.installation}
                target="_blank"
              >
                安装客户端
              </Link>
      
            </Paragraph>
            
            <Paragraph style={{ fontSize: 12, marginBottom: 8 }}>
              • 如果遇到连接不上的问题，可以尝试重新配置密码
            </Paragraph>
            
            <Paragraph style={{ fontSize: 12, marginBottom: 0 }}>
              • 遇到解决不了的问题,点击
              <Link 
                href={DOCS_LINKS.contact}
                target="_blank"
              >
                联系技术支持
              </Link>
            </Paragraph>
          </div>
        </Space>
      </Card>
    </Modal>
  );
}
