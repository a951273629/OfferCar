'use client';

import { useEffect, useState } from 'react';
import { Segmented, Tooltip } from 'antd';
import { ThunderboltOutlined, RocketOutlined, FireOutlined } from '@ant-design/icons';

export type LLmMode = 'general' | 'pro' | 'max';

interface LLmModeShiftProps {
  value?: LLmMode;
  onChange?: (mode: LLmMode) => void;
  size?: 'small' | 'middle' | 'large';
}

/**
 * LLM 模型模式切换组件
 * 
 * 支持三种模式：
 * - general: 标准模式，10点/题
 * - pro: 深度思考模式，28点/题
 * - max: 最强推理模式，58点/题
 */
export function LLmModeShift({ value, onChange, size = 'middle' }: LLmModeShiftProps) {
  const [selectedMode, setSelectedMode] = useState<LLmMode>(() => {
    // 从 localStorage 读取初始值
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('llmMode');
      return (saved as LLmMode) || 'general';
    }
    return 'general';
  });

  // 使用外部传入的 value（受控组件）
  const currentMode = value !== undefined ? value : selectedMode;

  // 处理模式切换
  const handleChange = (mode: string | number) => {
    const newMode = mode as LLmMode;
    
    // 保存到 localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('llmMode', newMode);
    }
    
    // 更新内部状态
    setSelectedMode(newMode);
    
    // 调用外部回调
    onChange?.(newMode);
  };

  // 监听 localStorage 变化（跨标签页同步）
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'llmMode' && e.newValue) {
        const newMode = e.newValue as LLmMode;
        setSelectedMode(newMode);
        onChange?.(newMode);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [onChange]);

  const options = [
    {
      label: (
        <Tooltip title="速度最快 准确 并且价格最便宜">
          <div style={{ padding: '0 4px' }}>
            <ThunderboltOutlined style={{ marginRight: 4 }} />
            <span>General</span>
            <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}></span>
          </div>
        </Tooltip>
      ),
      value: 'general',
    },
    {
      label: (
        <Tooltip title="速度较慢 但是更强回答更仔细 也更贵">
          <div style={{ padding: '0 4px' }}>
            <RocketOutlined style={{ marginRight: 4 }} />
            <span>Pro</span>
            <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}></span>
          </div>
        </Tooltip>
      ),
      value: 'pro',
    },
    {
      label: (
        <Tooltip title="最先进的模型 价格昂贵 速度慢 最强 回答最准确 最细节">
          <div style={{ padding: '0 4px' }}>
            <FireOutlined style={{ marginRight: 4 }} />
            <span>Max</span>
            <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}></span>
          </div>
        </Tooltip>
      ),
      value: 'max',
    },
  ];

  return (
    <>
      <Segmented
        options={options}
        value={currentMode}
        onChange={handleChange}
        size={size}
        className="llm-mode-shift"
      />

      <style jsx global>{`
        .llm-mode-shift .ant-segmented-item-selected {
          transition: all 0.3s ease;
        }
        
        /* General 模式 - 蓝色 */
        // .llm-mode-shift .ant-segmented-item-selected:has([value="general"]) {
        //   background: #1890ff !important;
        //   color: white !important;
        // }
        
        /* Pro 模式 - 蓝紫渐变 */
        .llm-mode-shift .ant-segmented-item:nth-child(2).ant-segmented-item-selected {
          background: linear-gradient(135deg, #1890ff 0%, #7c3aed 100%) !important;
          color: white !important;
        }
        
        /* Max 模式 - 霓虹色渐变 */
        .llm-mode-shift .ant-segmented-item:nth-child(3).ant-segmented-item-selected {
          background: linear-gradient(90deg, var(--color-neon-blue), var(--color-neon-purple), var(--color-neon-cyan), var(--color-neon-pink)) !important;
          color: white !important;
          box-shadow: 0 0 10px rgba(188, 19, 254, 0.3);
        }
        
        /* 悬停效果 */
        .llm-mode-shift .ant-segmented-item:hover {
          opacity: 0.9;
        }
      `}</style>
    </>
  );
}

