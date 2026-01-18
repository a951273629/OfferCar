import React from 'react';
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons';

const TitleBar: React.FC = () => {
  const handleMinimize = () => {
    window.electronAPI.window.minimize();
  };

  const handleMaximize = () => {
    window.electronAPI.window.maximize();
  };

  const handleClose = () => {
    window.electronAPI.window.close();
  };

  return (
    <div
      style={{
        height: '32px',
        background: '#1890ff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 10px',
        WebkitAppRegion: 'drag',
        userSelect: 'none'
      } as React.CSSProperties}
    >
      {/* 标题 */}
      <div style={{ color: 'white', fontSize: '14px', fontWeight: 500 }}>
        OfferCar AI
      </div>

      {/* 窗口控制按钮 */}
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={handleMinimize}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <MinusOutlined />
        </button>
        
        <button
          onClick={handleMaximize}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <BorderOutlined />
        </button>
        
        <button
          onClick={handleClose}
          style={{
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            color: 'white',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(231,76,60,0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          <CloseOutlined />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

