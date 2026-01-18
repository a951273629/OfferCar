'use client';

import { Card, Tag, Button, Space, Popconfirm, Typography, Badge } from 'antd';
import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { KnowledgeBase } from '@/types';
import {
  KNOWLEDGE_FILE_TYPE_TEXT,
  KNOWLEDGE_STATUS_TEXT,
} from '@/types/constants';

const { Text, Title } = Typography;

interface KnowledgeCardProps {
  knowledge: KnowledgeBase;
  onView?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  showActions?: boolean;
}

export function KnowledgeCard({
  knowledge,
  onView,
  onEdit,
  onDelete,
  showActions = true,
}: KnowledgeCardProps) {
  const actions = [];
  const clickable = !showActions && !!onView;

  if (showActions) {
    // 查看按钮
    if (onView) {
      actions.push(
        <Button
          key="view"
          type="text"
          icon={<EyeOutlined />}
          onClick={() => onView(knowledge.id)}
        >
          查看
        </Button>
      );
    }

    // 编辑按钮（仅非官方知识库）
    if (onEdit && !knowledge.is_official) {
      actions.push(
        <Button
          key="edit"
          type="text"
          icon={<EditOutlined />}
          onClick={() => onEdit(knowledge.id)}
        >
          编辑
        </Button>
      );
    }

    // 删除按钮（仅非官方知识库）
    if (onDelete && !knowledge.is_official) {
      actions.push(
        <Popconfirm
          key="delete"
          title="确定要删除这个知识库吗？"
          onConfirm={() => onDelete(knowledge.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" icon={<DeleteOutlined />} danger>
            删除
          </Button>
        </Popconfirm>
      );
    }
  }

  return (
    <Card
      className="card-shadow"
      hoverable
      style={{ height: '100%', cursor: clickable ? 'pointer' : undefined }}
      actions={actions.length > 0 ? actions : undefined}
      onClick={
        clickable
          ? () => {
              onView?.(knowledge.id);
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onView?.(knowledge.id);
              }
            }
          : undefined
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Space align="start">
            <Title level={4} style={{ marginBottom: 0 }}>
              {knowledge.title}
            </Title>
            {knowledge.is_official && (
              <Badge
                count={
                  <CrownOutlined style={{ color: '#faad14', fontSize: 16 }} />
                }
              />
            )}
          </Space>
          {knowledge.description && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              {knowledge.description}
            </Text>
          )}
        </div>

        <div>
          <Space wrap>
            {knowledge.is_official && (
              <Tag color="gold" icon={<CrownOutlined />}>
                官方
              </Tag>
            )}
            <Tag color="blue" icon={<FileTextOutlined />}>
              {KNOWLEDGE_FILE_TYPE_TEXT[knowledge.file_type]}
            </Tag>
            <Tag color="cyan">{knowledge.word_count} 字</Tag>
            {knowledge.tags && knowledge.tags.length > 0 && (
              <>
                {knowledge.tags.slice(0, 3).map((tag, idx) => (
                  <Tag key={idx} color="default">
                    {tag}
                  </Tag>
                ))}
                {knowledge.tags.length > 3 && (
                  <Tag color="default">+{knowledge.tags.length - 3}</Tag>
                )}
              </>
            )}
            {knowledge.status === 'archived' && (
              <Tag color="default">{KNOWLEDGE_STATUS_TEXT.archived}</Tag>
            )}
          </Space>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined /> 创建于{' '}
            {dayjs(knowledge.created_at).format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      </Space>
    </Card>
  );
}





