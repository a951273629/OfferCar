'use client';

import { Card, Descriptions, Typography, Avatar, Space } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { GlobalConfig, User } from '@/types';
import { ConfigPage } from '@/components/common/ConfigPage';

const { Title } = Typography;

interface ProfilePageContentProps {
  user: User | null | undefined;
  globalConfig: GlobalConfig;
  onUpdateGlobalConfig: (patch: Partial<GlobalConfig>) => void;
}

export function ProfilePageContent({
  user,
  globalConfig,
  onUpdateGlobalConfig,
}: ProfilePageContentProps) {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 个人资料卡片 */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
          <Avatar size={80} icon={<UserOutlined />} />
          <div style={{ marginLeft: 24 }}>
            <Title level={3} style={{ margin: 0 }}>
              {user?.name}
            </Title>
            <p style={{ color: '#666', margin: '8px 0 0' }}>{user?.email}</p>
          </div>
        </div>

        <Descriptions column={1} bordered>
          <Descriptions.Item label="姓名">{user?.name}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{user?.email}</Descriptions.Item>
          <Descriptions.Item label="注册时间">
            {user?.created_at ? dayjs(user.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="最后登录">
            {user?.updated_at ? dayjs(user.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <ConfigPage config={globalConfig} onChange={onUpdateGlobalConfig} />
    </Space>
  );
}


