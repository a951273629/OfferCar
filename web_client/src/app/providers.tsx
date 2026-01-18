'use client';

import { ConfigProvider, App, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { SWRConfig } from 'swr';
import { createContext, useContext, useEffect, useState } from 'react';
import { Provider as ReduxProvider } from 'react-redux';
import { store } from '@/store';
import { DEFAULT_GLOBAL_CONFIG } from '@/types';
import { setGlobalConfig } from '@/store/settingsSlice';

// 主题类型定义
type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// 创建主题 Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 自定义 Hook：useTheme
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme 必须在 Providers 内部使用');
  }
  return context;
}

// 主 Providers 组件
export function Providers({ children }: { children: React.ReactNode }) {
  // 主题状态管理
  const [theme, setTheme] = useState<Theme>('light');

  // 客户端初始化：读取 localStorage
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      // 首次访问，使用默认主题 'dark'
      document.documentElement.setAttribute('data-theme', 'dark');
      setTheme('dark');
    }

    // 开发模式：加载音频下载工具
  //   if (process.env.NODE_ENV === 'development') {
  //     import('@/lib/audio/downloadRecordings').then(() => {
  //       console.log('✅ AudioRecordings 工具已就绪！使用 window.AudioRecordings 访问');
  //     }).catch(err => {
  //       console.error('❌ AudioRecordings 加载失败:', err);
  //     });
  //   }
  }, []);

  // 初始化全局配置（先从 localStorage 读取，保证会话页等未包 DashboardLayout 的页面也能生效）
  useEffect(() => {
    try {
      const raw = localStorage.getItem('globalConfig');
      if (!raw) {
        store.dispatch(setGlobalConfig(DEFAULT_GLOBAL_CONFIG));
        return;
      }

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      // 白名单字段合并：避免旧字段（如 bgColor）回流到 Redux/localStorage
      const sanitized: Partial<typeof DEFAULT_GLOBAL_CONFIG> = {};
      if ('aiFontSize' in parsed) sanitized.aiFontSize = Number((parsed as any).aiFontSize || 0) || DEFAULT_GLOBAL_CONFIG.aiFontSize;
      if ('interviewerFontSize' in parsed) sanitized.interviewerFontSize = Number((parsed as any).interviewerFontSize || 0) || DEFAULT_GLOBAL_CONFIG.interviewerFontSize;
      if ('intervieweeFontSize' in parsed) sanitized.intervieweeFontSize = Number((parsed as any).intervieweeFontSize || 0) || DEFAULT_GLOBAL_CONFIG.intervieweeFontSize;
      if ('userFontSize' in parsed) sanitized.userFontSize = Number((parsed as any).userFontSize || 0) || DEFAULT_GLOBAL_CONFIG.userFontSize;
      if (typeof (parsed as any).scopeCharacter === 'boolean') sanitized.scopeCharacter = (parsed as any).scopeCharacter;
      if (typeof (parsed as any).showIntervieweeMessages === 'boolean') sanitized.showIntervieweeMessages = (parsed as any).showIntervieweeMessages;
      if (typeof (parsed as any).gestureEnabled === 'boolean') sanitized.gestureEnabled = (parsed as any).gestureEnabled;
      if (typeof (parsed as any).bilingualEnable === 'boolean') sanitized.bilingualEnable = (parsed as any).bilingualEnable;
      store.dispatch(setGlobalConfig({ ...DEFAULT_GLOBAL_CONFIG, ...sanitized }));
    } catch (error) {
      console.warn('[Providers] globalConfig 初始化失败，使用默认值:', error);
      store.dispatch(setGlobalConfig(DEFAULT_GLOBAL_CONFIG));
    }
  }, []);

  // 主题切换逻辑
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Context 值
  const themeValue: ThemeContextType = {
    theme,
    isDarkMode: theme === 'dark',
    toggleTheme,
  };

  return (
    <ReduxProvider store={store}>
      <ThemeContext.Provider value={themeValue}>
        <SWRConfig
          value={{
            revalidateOnFocus: false,
            shouldRetryOnError: false,
          }}
        >
          <ConfigProvider
            locale={zhCN}
            theme={{
              algorithm: theme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
              token: {
                colorPrimary: theme === 'dark' ? '#597ef7' : '#1890ff',
                borderRadius: 8,
                fontSize: 14,
              },
              components: {
                Layout: {
                  headerBg: theme === 'dark' ? '#141414' : '#ffffff',
                  headerColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.88)',
                  bodyBg: 'transparent',
                  footerBg: 'transparent',
                  siderBg: theme === 'dark' ? '#141414' : '#ffffff',
                },
                Typography: {
                  titleMarginBottom: '0.5em',
                  titleMarginTop: '1.2em',
                },
                Card: {
                  borderRadiusLG: 12,
                },
                Button: {
                  borderRadius: 8,
                },
              },
            }}
          >
            <App>
              {children}
            </App>
          </ConfigProvider>
        </SWRConfig>
      </ThemeContext.Provider>
    </ReduxProvider>
  );
}
