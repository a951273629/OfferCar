'use client';

import { Suspense } from 'react';
import { Card, Typography, Spin } from 'antd';
import { LoginForm } from '@/components/auth/LoginForm';

const { Title, Text } = Typography;

export default function LoginPage() {
  return (
    <div className="loginPageRoot">
      <Card className="loginCard" style={{ width: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            欢迎使用 OfferCar AI
          </Title>
          <Text type="secondary">首次登录将自动创建账号</Text>
        </div>

        <Suspense fallback={
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <Spin size="large" />
          </div>
        }>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}

