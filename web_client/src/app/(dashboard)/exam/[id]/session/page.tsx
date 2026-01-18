'use client';

import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ExamSession } from '@/components/exam/ExamSession';
import { Loading } from '@/components/common/Loading';
import { useExam } from '@/hooks/useExam';
import { Result } from 'antd';

export default function ExamSessionPage() {
  const params = useParams();
  const id = params.id as string;
  const { exam, isLoading } = useExam(id);

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loading />
      </DashboardLayout>
    );
  }

  if (!exam) {
    return (
      <DashboardLayout>
        <Result status="404" title="笔试不存在" subTitle="抱歉，找不到该笔试" />
      </DashboardLayout>
    );
  }

  return (
    <ExamSession
      examId={exam.id}
      examTitle={exam.title}
      position={exam.position}
    />
  );
}

