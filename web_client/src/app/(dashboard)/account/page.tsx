'use client';

import { Loading } from '@/components/common/Loading';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { RightSidebar } from '@/components/layout/RightSidebar';
import { useAuth } from '@/hooks/useAuth';
import { Grid } from 'antd';

const { useBreakpoint } = Grid;

export default function AccountPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为手机端

  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={{ 
        padding: isMobile ? '12px' : '24px',
        maxWidth: isMobile ? '100%' : '400px',
        margin: '0 auto'
      }}>
        <h1 style={{ 
          fontSize: isMobile ? '20px' : '24px',
          marginBottom: '20px',
          fontWeight: 600
        }}>
          账户中心
        </h1>
        <RightSidebar />
      </div>
    </DashboardLayout>
  );
}

