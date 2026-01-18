'use client';

import { useEffect, useState } from 'react';
import { Layout, Grid, Drawer } from 'antd';
import { MenuOutlined } from '@ant-design/icons';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { RightSidebar } from './RightSidebar';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch } from '@/store/hooks';
import { setGlobalConfig } from '@/store/settingsSlice';
import { DEFAULT_GLOBAL_CONFIG } from '@/types';

const { Content } = Layout;
const { useBreakpoint } = Grid;

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为手机端
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const { user } = useAuth();
  const dispatch = useAppDispatch();

  // 当 /auth/me 返回了 global_config_json 时，用它覆盖 Redux（优先级高于 localStorage）
  useEffect(() => {
    const raw = user?.global_config_json;
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // 白名单字段合并：避免旧字段（如 bgColor）回流到 Redux/localStorage
      const sanitized: Partial<typeof DEFAULT_GLOBAL_CONFIG> = {};
      if ('aiFontSize' in parsed) sanitized.aiFontSize = Number((parsed as any).aiFontSize || 0) || DEFAULT_GLOBAL_CONFIG.aiFontSize;
      if ('interviewerFontSize' in parsed) sanitized.interviewerFontSize = Number((parsed as any).interviewerFontSize || 0) || DEFAULT_GLOBAL_CONFIG.interviewerFontSize;
      if ('intervieweeFontSize' in parsed) sanitized.intervieweeFontSize = Number((parsed as any).intervieweeFontSize || 0) || DEFAULT_GLOBAL_CONFIG.intervieweeFontSize;
      if ('userFontSize' in parsed) sanitized.userFontSize = Number((parsed as any).userFontSize || 0) || DEFAULT_GLOBAL_CONFIG.userFontSize;
      if (typeof (parsed as any).showIntervieweeMessages === 'boolean') sanitized.showIntervieweeMessages = (parsed as any).showIntervieweeMessages;
      if (typeof (parsed as any).gestureEnabled === 'boolean') sanitized.gestureEnabled = (parsed as any).gestureEnabled;
      if (typeof (parsed as any).bilingualEnable === 'boolean') sanitized.bilingualEnable = (parsed as any).bilingualEnable;
      const merged = { ...DEFAULT_GLOBAL_CONFIG, ...sanitized };
      dispatch(setGlobalConfig(merged));
      localStorage.setItem('globalConfig', JSON.stringify(merged));
    } catch (error) {
      console.warn('[DashboardLayout] 解析 global_config_json 失败，跳过覆盖:', error);
    }
  }, [user?.global_config_json, dispatch]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header />
      <Layout>
        {/* 桌面端：固定侧边栏 */}
        {!isMobile && <Sidebar />}

        {/* 手机端：抽屉侧边栏 */}
        {isMobile && (
          <Drawer
            placement="left"
            onClose={() => setSidebarVisible(false)}
            open={sidebarVisible}
            width={250}
            styles={{ body: { padding: 0 } }}
          >
            <Sidebar onMenuClick={() => setSidebarVisible(false)} />
          </Drawer>
        )}

        <Layout style={{
          padding: isMobile ? '8px' : '12px',
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? '12px' : '24px'
        }}>
          {/* 手机端：显示菜单按钮 */}
          {isMobile && (
            <div style={{
              padding: '8px 12px',
              background: 'var(--color-bg-container)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MenuOutlined
                onClick={() => setSidebarVisible(true)}
                style={{ fontSize: '20px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '16px', fontWeight: 500 }}>菜单</span>
            </div>
          )}

          <Content
            style={{
              padding: isMobile ? 16 : 24,
              margin: 0,
              minHeight: 280,
              borderRadius: 8,
              flex: 1,
            }}
          >
            {children}
          </Content>

          {/* 桌面端：显示右侧栏 */}
          {!isMobile && <RightSidebar />}
        </Layout>


      </Layout>
      <Footer />
    </Layout>
  );
}

