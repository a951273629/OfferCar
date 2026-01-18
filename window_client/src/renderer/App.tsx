import React, { useState } from 'react';
import { ConfigProvider, Layout, Tabs } from 'antd';
import type { TabsProps } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import TitleBar from './components/TitleBar';
import AudioPanel from './pages/AudioPanel';
import Settings from './pages/Settings';
import ExamPanel from './pages/ExamPanel';

const { Content } = Layout;

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('audio');

  const tabItems: TabsProps['items'] = [
    {
      key: 'audio',
      label: '面试模式',
      children: <AudioPanel />
    },
    {
      key: 'exam',
      label: '笔试模式',
      children: <ExamPanel />
    },
    {
      key: 'settings',
      label: '设置',
      children: <Settings />
    }
  ];

  return (
    <ConfigProvider 
      locale={zhCN}
      theme={{
        token: {
          padding: 16,
          marginXS: 8,
        },
        components: {
          Card: {
            paddingLG: 16,
          }
        }
      }}
    >
      <Layout style={{ height: '100vh', background: '#f0f2f5' }}>
        {/* 自定义标题栏 */}
        <TitleBar />
        
        {/* 主内容区域 */}
        <Content style={{ padding: '0', overflow: 'hidden' }}>
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            style={{marginLeft:'15px' }}
            items={tabItems}
          />
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default App;

