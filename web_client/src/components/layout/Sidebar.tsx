'use client';

import { Menu, Layout, Grid } from 'antd';
import {
  VideoCameraOutlined,
  FileTextOutlined,
  UserOutlined,
  BookOutlined
} from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';

const { Sider } = Layout;
const { useBreakpoint } = Grid;

interface SidebarProps {
  onMenuClick?: () => void;
}

export function Sidebar({ onMenuClick }: SidebarProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为手机端

  const allMenuItems = [
    {
      key: '/interview',
      icon: <VideoCameraOutlined />,
      label: '面试模式',
    },
    {
      key: '/exam',
      icon: <FileTextOutlined />,
      label: '笔试模式',
    },
    {
      key: '/knowledge',
      icon: <BookOutlined />,
      label: '知识库',
    },
    {
      key: '/account',
      icon: <UserOutlined />,
      label: '账户中心',
      onlyShowMobile: true,
    },
  ];

  // 根据设备类型过滤菜单项并移除自定义属性
  const menuItems = allMenuItems
    .filter((item: any) => {
      // 如果是仅移动端显示的菜单项，且当前是桌面端，则过滤掉
      if (item.onlyShowMobile && !isMobile) {
        return false;
      }
      return true;
    })
    .map((item: any) => {
      // 移除自定义属性，避免传递给 Menu 组件
      const { onlyShowMobile, ...menuItemProps } = item;
      return menuItemProps;
    });

  // 获取当前选中的菜单项
  const selectedKey = menuItems.find((item: any) => pathname.startsWith(item.key))
    ?.key;

  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
    onMenuClick?.(); // 手机端点击后关闭抽屉
  };

  return (
    <Sider width={200} style={{ background: 'transparent' }}>
      <Menu
        mode="inline"
        selectedKeys={selectedKey ? [selectedKey] : []}
        style={{ height: '100%', borderRight: 0 }}
        items={menuItems}
        onClick={handleMenuClick}
      />
    </Sider>
  );
}

