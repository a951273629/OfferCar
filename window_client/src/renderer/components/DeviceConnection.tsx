import React, { useState } from 'react';
import { Modal, Input, Button, Space, message } from 'antd';

interface DeviceConnectionProps {
  visible: boolean;
  onClose: () => void;
  onConnect: (code: string) => Promise<void>;
  isConnecting: boolean;
}

const DeviceConnection: React.FC<DeviceConnectionProps> = ({ 
  visible, 
  onClose, 
  onConnect,
  isConnecting 
}) => {
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!pairingCode || pairingCode.length !== 6) {
      message.warning('请输入6位配对码');
      return;
    }

    try {
      setLoading(true);
      await onConnect(pairingCode);
      message.success('连接成功！');
      setPairingCode('');
      onClose();
    } catch (error) {
      console.error('连接失败:', error);
      message.error(error instanceof Error ? error.message : '连接失败，请检查配对码');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPairingCode('');
    onClose();
  };


  return (
    <Modal
      title="连接设备"
      open={visible}
      onCancel={handleCancel}
      footer={null}
      width={400}
      style={{ top: '10vh' }}
    >
      <div style={{ padding: '20px 0' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 16, fontWeight: 500 }}>请输入配对码:</div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Input.OTP
              length={6}
              value={pairingCode}
              onChange={setPairingCode}
              size="large"
              formatter={(value) => value.replace(/\D/g, '')}
            />
          </div>
          {/* <style>{`
            .ant-otp .ant-input {
              width: 50px !important;
              height: 50px !important;
              font-size: 24px !important;
              text-align: center !important;
            }
            .ant-otp {
              gap: 10px !important;
            }
          `}</style> */}
          <div style={{ marginTop: 12, color: '#999', fontSize: 12, textAlign: 'center' }}>
            在另一台设备上获取配对码后输入
          </div>
        </div>

        <Space style={{ width: '100%', justifyContent: 'flex-end', marginTop: 20 }}>
          <Button onClick={handleCancel}>
            取消
          </Button>
          <Button
            type="primary"
            onClick={handleConnect}
            disabled={pairingCode.length !== 6 || isConnecting}
            loading={loading}
          >
            {loading ? '连接中...' : '开始连接'}
          </Button>
        </Space>

        <div style={{
          marginTop: 24,
          padding: 12,
          background: '#f5f5f5',
          borderRadius: 4,
          fontSize: 12,
          color: '#666'
        }}>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>使用说明：</div>
          <div>1. 在另一台设备上打开OfferCar客户端</div>
          <div>2. 生成配对码</div>
          <div>3. 在此处输入配对码连接</div>
        </div>
      </div>
    </Modal>
  );
};

export default DeviceConnection;

