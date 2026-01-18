'use client';

import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InterviewSession } from '@/components/interview/InterviewSession';
import { Loading } from '@/components/common/Loading';
import { useInterview } from '@/hooks/useInterview';
import { Result } from 'antd';

export default function InterviewSessionPage() {
  const params = useParams();
  const id = params.id as string;
  const { interview, isLoading } = useInterview(id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loading />
      </DashboardLayout>
    );
  }

  if (!interview) {
    return (
      <DashboardLayout>
        <Result
          status="404"
          title="面试不存在"
          subTitle="抱歉，找不到该面试"
        />
      </DashboardLayout>
    );
  }

  return (
    <InterviewSession
      interviewId={interview.id}
      interviewTitle={interview.title}
      position={interview.position}
      language={interview.language}
    />
  );
}

