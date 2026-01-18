'use client';

import { Layout } from 'antd';

const { Footer: AntFooter } = Layout;

export function Footer() {
  return (
    <AntFooter style={{ textAlign: 'center' }}>
      <div>
        <p style={{ color: 'var(--color-text-base)', margin: '8px 0' }}>
          OfferCar AI © 2025 - AI 面试笔试助手

        </p>
        <p style={{ fontSize: '12px', color: 'var(--color-text-quaternary)', marginTop: '8px' }}>
          专业的 AI 驱动面试和笔试平台，助您高效准备求职面试 {'  '}
          <a 
            href="https://beian.miit.gov.cn/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ 
              color: 'var(--color-text-base)', 
              textDecoration: 'none',
              transition: 'color 0.3s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-base)'}
          >
            陇ICP备2024009358号-4
          </a>
        </p>
      </div>
    </AntFooter>
  );
}

