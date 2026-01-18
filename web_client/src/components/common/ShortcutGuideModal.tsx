'use client';

import { Modal, Space, Tag, Typography } from 'antd';

const { Text } = Typography;

interface ShortcutGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutGuideModal({ open, onClose }: ShortcutGuideModalProps) {
  return (
    <Modal
      title="全局通用快捷键"
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={600}
    >
      <div style={{ padding: '16px 0' }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
           连接 
           <Tag 
                color="green" 
                style={{ 
                  padding: '4px 12px', 
                  fontSize: 13,
                  marginRight: 8,
                  marginLeft: 8,
                  fontFamily: 'monospace'
                }}
              >
                客户端 
              </Tag>
           之后，在任何地方按下快捷键都会触发
        </Text>
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* 快捷键 1 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Tag 
                color="purple" 
                style={{ 
                  padding: '4px 12px', 
                  fontSize: 13,
                  marginRight: 12,
                  fontFamily: 'monospace'
                }}
              >
                Ctrl + Shift + 回车
              </Tag>
              <Text>触发面试/笔试回答（面试/笔试房间有效）</Text>
            </div>
          </div>
          
          {/* 快捷键 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Tag 
                color="purple" 
                style={{ 
                  padding: '4px 12px', 
                  fontSize: 13,
                  marginRight: 12,
                  fontFamily: 'monospace'
                }}
              >
                Ctrl + Shift + 空格
              </Tag>
              <Text>截取电脑屏幕并读取内容（面试/笔试房间有效）</Text>
            </div>
          </div>
          
          {/* 快捷键 3 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Tag 
                color="purple" 
                style={{ 
                  padding: '4px 12px', 
                  fontSize: 13,
                  marginRight: 12,
                  fontFamily: 'monospace'
                }}
              >
                Ctrl + 上/下
              </Tag>
              <Text>上下滚动 AI 回答结果区域(面试/笔试房间有效)</Text>
            </div>
          </div>
          
          {/* 快捷键 4 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <Tag 
                color="purple" 
                style={{ 
                  padding: '4px 12px', 
                  fontSize: 13,
                  marginRight: 12,
                  fontFamily: 'monospace',
                  minWidth: 110,
                  textAlign: 'center'
                }}
              >
                Ctrl + C 复制任意文本
              </Tag>
              <Text>每次复制文本，都自动同步到两端设备 (面试/笔试房间有效)</Text>
            </div>
          </div>
        </Space>
      </div>
    </Modal>
  );
}

