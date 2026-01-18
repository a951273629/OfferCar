'use client';

import { Spin } from 'antd';

export function Loading() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '200px',
      }}
    >
      <Spin size="large" />
    </div>
  );
}

