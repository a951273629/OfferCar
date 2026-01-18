'use client';

import { Button, Row, Col, Typography, Modal, message, Grid } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { InterviewCard } from '@/components/interview/InterviewCard';
import { InterviewForm } from '@/components/interview/InterviewForm';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { useInterviews, useInterviewActions } from '@/hooks/useInterview';
import { InterviewCreateDto } from '@/types';
import { useKnowledgeActions } from '@/hooks/useKnowledge';

const { Title } = Typography;
const { useBreakpoint } = Grid;

export default function InterviewPage() {
  // 响应式检测
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { interviews, isLoading } = useInterviews();
  const { createInterview, deleteInterview, startInterview } =
    useInterviewActions();
  const { setInterviewKnowledgeBases } = useKnowledgeActions();

  const handleCreate = async (values: InterviewCreateDto, knowledgeBaseIds: number[]) => {
    setLoading(true);
    try {
      const result = await createInterview(values);
      const interviewId = result.id;
      
      // 保存知识库关联
      if (knowledgeBaseIds.length > 0) {
        await setInterviewKnowledgeBases(interviewId, knowledgeBaseIds);
      }
      
      message.success('面试创建成功');
      setIsModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startInterview(id);
      router.push(`/interview/${id}/session`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动面试失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteInterview(id);
      message.success('删除成功');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

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
        marginBottom: 24, 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'center',
        gap: isMobile ? 12 : 0
      }}>
        <Title level={2} style={{ margin: 0 }}>
          面试模式
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ width: isMobile ? '100%' : 'auto' }}
        >
          新建面试
        </Button>
      </div>

      {interviews.length === 0 ? (
        <EmptyState
          description="还没有创建面试，快来创建第一个吧！"
          actionText="新建面试"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {interviews.map((interview) => (
            <Col xs={24} sm={12} lg={8} key={interview.id}>
              <InterviewCard
                interview={interview}
                onStart={handleStart}
                onDelete={handleDelete}
              />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建面试"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={isMobile ? '95vw' : 600}
      >
        <InterviewForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
          loading={loading}
        />
      </Modal>

      
    </DashboardLayout>
  );
}

