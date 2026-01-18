'use client';

import { useRouter } from 'next/navigation';
import {
  Card,
  Avatar,
  Button,
  Space,
  Typography,
  List,
  Grid
} from 'antd';
import {
  SettingOutlined,
  DownloadOutlined,
  CustomerServiceOutlined,
  LinkOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useAuth } from '@/hooks/useAuth';
import dayjs from 'dayjs';

const { Text, Link: AntdLink } = Typography;
const { useBreakpoint } = Grid;

export function RightSidebar() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为手机端

  // 下载客户端
  const handleDownload = () => {
    window.open(`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/installation`, '_blank');
  };

  // 客服
  const handleCustomerService = () => {
    window.open(`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/contact`, '_blank');
  };

  const tutorials = [
    {
      title: '面试模式使用指南（4分钟视频教程）',
      url: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/demo-videos`,
    },
    {
      title: '笔试模式使用指南（4分钟视频教程）',
      url: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/demo-videos`,
    },
    {
      title: '双端设备连接指南（1分钟文字教程）',
      url: `${process.env.NEXT_PUBLIC_DOCS_URL}/docs/device-connection`,
    },
  ];

  // 生成用户头像（使用邮箱首字母）
  const getUserAvatar = () => {
    if (!user?.email) return '?';
    return user.email.charAt(0).toUpperCase();
  };

  // 格式化加入日期
  const getJoinDate = () => {
    if (!user?.created_at) return '';
    return dayjs(user.created_at).format('YYYY-MM-DD');
  };

  // 响应式间距和尺寸
  const spacing = isMobile ? 12 : 16;
  const cardPadding = isMobile ? 16 : 20;
  const fontSize = isMobile ? 13 : 14;

  if (isLoading) {
    return (
      <aside style={{
        width: isMobile ? '100%' : 380,
        padding: spacing,
        height: '100%',
        overflowY: 'auto'
      }}>
        <div style={{ padding: 20, textAlign: 'center' }}>加载中...</div>
      </aside>
    );
  }

  return (
    <aside style={{
      width: isMobile ? '100%' : 380,
      padding: spacing,
      height: '100%',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: spacing
    }}>
      {/* 用户信息卡片 */}
      <Card
        variant="outlined"
        style={{
          borderColor: 'var(--color-primary)',
          borderWidth: 2,
        }}
        styles={{ body: { padding: cardPadding } }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {/* 用户头像和信息 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              size={50}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontSize: 24,
              }}
            >
              {getUserAvatar()}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: fontSize, display: 'block', marginBottom: 4 }}>
                {user?.email || '未登录'}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {getJoinDate()} 加入
              </Text>
            </div>
            <Button
              type="text"
              icon={<SettingOutlined />}
              style={{ fontSize: fontSize }}
            >
              设置
            </Button>
          </div>
        </Space>
      </Card>

      {/* 使用教程 */}
      <Card
        variant="outlined"
        style={{
          borderColor: 'var(--color-primary)',
          borderWidth: 2,
        }}
        styles={{ body: { padding: cardPadding } }}
        title={
          <Space>
            <BookOutlined style={{ color: 'var(--color-primary)' }} />
            <span>使用教程</span>
          </Space>
        }
      >
        <List
          size="small"
          dataSource={tutorials}
          renderItem={(tutorial) => (
            <List.Item
              style={{ padding: '8px 0', cursor: 'pointer' }}
              extra={<LinkOutlined style={{ color: 'var(--color-text-secondary)' }} />}
            >
              <AntdLink
                href={tutorial.url}
                target="_blank"
                style={{ fontSize: fontSize }}
              >
                {tutorial.title}
              </AntdLink>
            </List.Item>
          )}
        />
      </Card>

      {/* 下载和客服 */}
      <Space.Compact block style={{ gap: 12, display: 'flex' }}>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          style={{
            flex: 1,
            height: 44,
            fontSize: fontSize,
            fontWeight: 500
          }}
        >
          下载客户端
        </Button>
        <Button
          icon={<CustomerServiceOutlined />}
          onClick={handleCustomerService}
          style={{
            flex: 1,
            height: 44,
            fontSize: fontSize,
            fontWeight: 500,
            borderColor: 'var(--color-primary)',
            color: 'var(--color-primary)'
          }}
        >
          客服 (24h)
        </Button>
      </Space.Compact>
    </aside>
  );
}
