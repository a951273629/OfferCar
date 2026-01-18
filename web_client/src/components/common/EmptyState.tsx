'use client';

import { Empty, Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  description = '暂无数据',
  actionText,
  onAction,
}: EmptyStateProps) {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <Empty description={description}>
        {actionText && onAction && (
          <Button type="primary" icon={<PlusOutlined />} onClick={onAction}>
            {actionText}
          </Button>
        )}
      </Empty>
    </div>
  );
}

