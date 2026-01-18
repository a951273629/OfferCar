import React, { useState, useEffect } from 'react';
import { Card, Switch, Button, Space, Divider, message } from 'antd';
import { LinkOutlined } from '@ant-design/icons';

const Settings: React.FC = () => {
  const [clipboardMonitorEnabled, setClipboardMonitorEnabled] = useState(true);
  const [trayIconVisible, setTrayIconVisible] = useState(true);

  const loadConfig = async () => {
    try {
      const config = await window.electronAPI.config.get();
      setClipboardMonitorEnabled(config.clipboardMonitorEnabled);
      setTrayIconVisible(config.trayIconVisible);
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  };

  // 加载配置
  useEffect(() => {
    loadConfig();
    
    // 监听托盘图标显示状态变化
    window.electronAPI.on.trayVisibilityChanged((visible) => {
      setTrayIconVisible(visible);
    });

    return () => {
      window.electronAPI.removeListener.trayVisibilityChanged();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClipboardMonitorChange = async (checked: boolean) => {
    setClipboardMonitorEnabled(checked);
    
    try {
      await window.electronAPI.config.update({
        clipboardMonitorEnabled: checked
      });
      
      if (checked) {
        await window.electronAPI.clipboard.start();
        message.success('剪贴板监听已启用');
      } else {
        await window.electronAPI.clipboard.stop();
        message.success('剪贴板监听已禁用');
      }
    } catch (error) {
      console.error('更新配置失败:', error);
      message.error('操作失败');
    }
  };

  const handleTrayIconChange = async (checked: boolean) => {
    setTrayIconVisible(checked);
    
    try {
      await window.electronAPI.config.update({
        trayIconVisible: checked
      });
      message.success(`托盘图标已${checked ? '显示' : '隐藏'}`);
    } catch (error) {
      console.error('更新配置失败:', error);
      message.error('操作失败');
    }
  };

  const handleCheckUpdate = () => {
    message.info('已是最新版本');
  };

  const handleOpenTutorial = () => {
    message.info('使用教程功能开发中');
  };

  const handleOpenWebsite = () => {
    message.info('打开官网功能开发中');
  };

  const handleOpenTool = () => {
    message.info('隐厅制作工具功能开发中');
  };

  return (
    <div style={{ padding: '0px' }}>
      <Card style={{ marginBottom: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {/* 文本复制监听 */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>文本复制监听</span>
            <Switch
              checked={clipboardMonitorEnabled}
              onChange={handleClipboardMonitorChange}
            />
          </div>

          {/* <Divider style={{ margin: '12px 0' }} /> */}

          {/* 托盘图标显示 */}
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6
            }}>
              <span>托盘图标显示</span>
              <Switch
                checked={trayIconVisible}
                onChange={handleTrayIconChange}
              />
            </div>
            <div style={{ color: '#999', fontSize: 12 }}>
              可通过 Ctrl + Shift + T 切换显示
            </div>
          </div>
        </Space>
      </Card>

      {/* <Divider /> */}

      {/* 版本信息 */}
      <Card style={{ marginBottom: 0 }}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 6 }}>
            版本检查 <strong>1.0.1</strong> (windows)
          </div>
          <Button onClick={handleCheckUpdate}>
            检查更新
          </Button>
        </div>
      </Card>

      {/* <Divider /> */}

      {/* 相关链接 */}
      <Card  style={{ marginBottom: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={handleOpenTutorial}
            style={{ padding: 0 }}
          >
            使用教程
          </Button>
          
          <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={handleOpenWebsite}
            style={{ padding: 0 }}
          >
            打开官网
          </Button>
          
          {/* <Button
            type="link"
            icon={<LinkOutlined />}
            onClick={handleOpenTool}
            style={{ padding: 0 }}
          >
            隐厅制作工具
          </Button> */}
        </Space>
      </Card>

      {/* 底部版本信息 */}
      <div style={{ 
        textAlign: 'center', 
        marginTop: 12, 
        color: '#999', 
        fontSize: 12 
      }}>
        OfferCar 版权所有 v1.0.1
      </div>
    </div>
  );
};

export default Settings;

