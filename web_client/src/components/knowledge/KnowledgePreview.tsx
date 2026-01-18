'use client';

import { Modal, Typography, Tag, Space, Divider, theme } from 'antd';
import {
  FileTextOutlined,
  ClockCircleOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { KnowledgeBase } from '@/types';
import { KNOWLEDGE_FILE_TYPE_TEXT } from '@/types/constants';
import dayjs from 'dayjs';
import ReactMarkdown from 'react-markdown';

const { Title, Text, Paragraph } = Typography;

interface KnowledgePreviewProps {
  knowledge: KnowledgeBase | null;
  open: boolean;
  onClose: () => void;
}

export function KnowledgePreview({
  knowledge,
  open,
  onClose,
}: KnowledgePreviewProps) {
  // 使用 Ant Design 主题 token
  const { token } = theme.useToken();
  
  if (!knowledge) return null;

  return (
    <Modal
      title=""
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      styles={{ body: { maxHeight: '90vh', overflowY: 'hidden' } }}
    >
      <Space direction="vertical" style={{ width: '100%' ,rowGap:'10px'}} size="large">
        {/* 标题和元信息 */}
        <div style={{ marginBottom: 0 }}>
          {/* <Space align="start">
            <Title level={3} style={{ marginBottom: 0 }}>
              {knowledge.title}
            </Title>
            {knowledge.is_official && (
              <Tag color="gold" icon={<CrownOutlined />}>
                官方
              </Tag>
            )}
          </Space> */}

          {knowledge.description && (
            <Paragraph type="secondary" style={{ margin: 0 }}>
              {knowledge.description}
            </Paragraph>
          )}

          {/* <Space wrap style={{ marginTop: 8 }}>
            <Tag color="blue" icon={<FileTextOutlined />}>
              {KNOWLEDGE_FILE_TYPE_TEXT[knowledge.file_type]}
            </Tag>
            <Tag color="cyan">{knowledge.word_count} 字</Tag>
            {knowledge.tags && knowledge.tags.length > 0 && (
              <>
                {knowledge.tags.map((tag, idx) => (
                  <Tag key={idx} color="default">
                    {tag}
                  </Tag>
                ))}
              </>
            )}
          </Space> */}

          <div style={{ marginTop: 0 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              <ClockCircleOutlined /> 创建于{' '}
              {dayjs(knowledge.created_at).format('YYYY-MM-DD HH:mm')}
            </Text>
          </div>
        </div>

        {/* <Divider /> */}

        {/* 内容 */}
        <div style={{ marginTop: 0 }}>
          {/* <Title level={5}>内容</Title> */}
          {knowledge.file_type === 'md' ? (
            <div
              style={{
                padding: '16px',
                background: token.colorBgLayout,
                borderRadius: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              <ReactMarkdown>{knowledge.content}</ReactMarkdown>
            </div>
          ) : (
            <Paragraph
              style={{
                whiteSpace: 'pre-wrap',
                padding: '16px',
                background: token.colorBgLayout,
                borderRadius: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {knowledge.content}
            </Paragraph>
          )}
        </div>
      </Space>
    </Modal>
  );
}





