'use client';

import { Card, Tag, Button, Space, Popconfirm, Typography } from 'antd';
import {
  PlayCircleOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { Exam } from '@/types';
import {
  STATUS_TEXT,
  STATUS_COLORS,
  LANGUAGE_TEXT,
  PROGRAMMING_LANGUAGE_TEXT,
} from '@/types/constants';

const { Text, Title } = Typography;

interface ExamCardProps {
  exam: Exam;
  onStart: (id: number) => void;
  onDelete: (id: number) => void;
}

export function ExamCard({ exam, onStart, onDelete }: ExamCardProps) {
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
          onClick={() => onStart(exam.id)}
        >
          {exam.status === 'pending' ? '开始' : '继续'}
        </Button>,
        <Popconfirm
          key="delete"
          title="确定要删除这个笔试吗？"
          onConfirm={() => onDelete(exam.id)}
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
            {exam.title}
          </Title>
          <Text type="secondary">{exam.description}</Text>
        </div>

        <div>
          <Space wrap>
            <Tag color="blue">{exam.position}</Tag>
            <Tag color="cyan">{LANGUAGE_TEXT[exam.language]}</Tag>
            {exam.programming_language && (
              <Tag color="purple">{PROGRAMMING_LANGUAGE_TEXT[exam.programming_language]}</Tag>
            )}
            <Tag color={STATUS_COLORS[exam.status]}>
              {STATUS_TEXT[exam.status]}
            </Tag>
          </Space>
        </div>

        <div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <ClockCircleOutlined /> 创建于{' '}
            {dayjs(exam.created_at).format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      </Space>
    </Card>
  );
}

