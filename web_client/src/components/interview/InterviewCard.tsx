'use client';

import { Card, Tag, Button, Space, Popconfirm, Typography } from 'antd';
import {
  PlayCircleOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Interview } from '@/types';
import {
  STATUS_TEXT,
  STATUS_COLORS,
  LANGUAGE_TEXT,
  PROGRAMMING_LANGUAGE_TEXT,
  INTERVIEW_TYPE_TEXT,
} from '@/types/constants';

const { Text, Title } = Typography;

interface InterviewCardProps {
  interview: Interview;
  onStart: (id: number) => void;
  onDelete: (id: number) => void;
}

export function InterviewCard({
  interview,
  onStart,
  onDelete,
}: InterviewCardProps) {
  return (
    <Card
      className="card-shadow"
      hoverable
      style={{ height: '100%' }}
      actions={[
        <Button
          key="start"
          type="text"
          icon={<PlayCircleOutlined />}
          onClick={() => onStart(interview.id)}
        >
          {interview.status === 'pending' ? '开始' : '继续'}
        </Button>,
        <Popconfirm
          key="delete"
          title="确定要删除这个面试吗？"
          onConfirm={() => onDelete(interview.id)}
          okText="确定"
          cancelText="取消"
        >
          <Button type="text" icon={<DeleteOutlined />} danger>
            删除
          </Button>
        </Popconfirm>,
      ]}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Title level={4} style={{ marginBottom: 8 }}>
            {interview.title}
          </Title>
          <Text type="secondary">{interview.description}</Text>
        </div>

        <div>
          <Space wrap>
            <Tag color="blue">{interview.position}</Tag>
            <Tag color="cyan">{LANGUAGE_TEXT[interview.language]}</Tag>
            {interview.programming_language && (
              <Tag color="purple">{PROGRAMMING_LANGUAGE_TEXT[interview.programming_language]}</Tag>
            )}
            <Tag color="geekblue">{INTERVIEW_TYPE_TEXT[interview.interview_type]}</Tag>
            <Tag color={STATUS_COLORS[interview.status]}>
              {STATUS_TEXT[interview.status]}
            </Tag>
          </Space>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined /> 创建于{' '}
            {dayjs(interview.created_at).format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      </Space>
    </Card>
  );
}

