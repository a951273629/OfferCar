'use client';

import { Layout, Button, Dropdown, Avatar, Space, Switch, Grid } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, useAuthActions } from '@/hooks/useAuth';
import { useTheme } from '@/app/providers';
import type { MenuProps } from 'antd';
import styles from './Header.module.css';

const { Header: AntHeader } = Layout;
const { useBreakpoint } = Grid;

export function Header() {
  const { user, isAuthenticated } = useAuth();
  const { logout } = useAuthActions();
  const { isDarkMode, toggleTheme } = useTheme();
  const pathname = usePathname();
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为手机端

  // 判断链接是否为当前激活状态
  const isActive = (path: string) => {
    if (path === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(path);
  };

  const items: MenuProps['items'] = [
    {
      key: 'profile',
      label: <Link href="/profile">个人设置</Link>,
      icon: <SettingOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'theme',
      label: (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span>
            <BulbOutlined style={{ marginRight: 8 }} />
            {isDarkMode ? '暗黑模式' : '明亮模式'}
          </span>
          <Switch
            checked={isDarkMode}
            size="small"
            onChange={(checked, e) => {
              e?.stopPropagation();
              toggleTheme();
            }}
            onClick={(_, e) => e.stopPropagation()}
          />
        </div>
      ),
      onClick: (e) => {
        e.domEvent.stopPropagation();
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: logout,
      danger: true,
    },
  ];

  return (
    <AntHeader
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 12px' : '0 24px',
        height: isMobile ? '56px' : '64px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Link href="/" className={styles.logo} style={{ 
          fontSize: isMobile ? '18px' : '20px',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '6px' : '8px'
        }}>
          <img 
            src="/favicon.png" 
            alt="OfferCar AI Logo" 
            style={{ 
              width: isMobile ? '20px' : '28px',
              height: isMobile ? '20px' : '28px',
              borderRadius: '4px',
              objectFit: 'cover'
            }}
          />
          OfferCar AI
        </Link>
      </div>

      {/* 右侧：导航链接 + 用户信息 */}
      <div className={styles.navRight}>
        {/* 桌面端：显示完整导航 */}
        {!isMobile && (
          <div className={styles.navLinks}>
            <Link
              href="/interview"
              className={`${styles.navLink} ${isActive('/interview') ? styles.active : ''}`}
            >
              面试模式
            </Link>
            <Link
              href="/exam"
              className={`${styles.navLink} ${isActive('/exam') ? styles.active : ''}`}
            >
              笔试模式
            </Link>
            <Link
              href="/"
              className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}
            >
              首页
            </Link>
            <a
              href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/pricing/`}
              className={styles.navLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              定价
            </a>
            <a
              href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/quick-start/intro`}
              className={styles.navLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              使用教程
            </a>
          </div>
        )}

        <div className={styles.userSection}>
          {isAuthenticated && user ? (
            <Dropdown menu={{ items }} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} size={isMobile ? 'default' : 'large'} />
                {!isMobile && <span>{user.name}</span>}
              </Space>
            </Dropdown>
          ) : (
            <Link href="/login">
              <Button type="primary" size={isMobile ? 'middle' : 'large'}>登录</Button>
            </Link>
          )}
        </div>
      </div>
    </AntHeader>
  );
}
