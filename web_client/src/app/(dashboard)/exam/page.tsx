'use client';

import { Button, Row, Col, Typography, Modal, message, Grid } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ExamCard } from '@/components/exam/ExamCard';
import { ExamForm } from '@/components/exam/ExamForm';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { useExams, useExamActions } from '@/hooks/useExam';
import { ExamCreateDto } from '@/types';
import { useKnowledgeActions } from '@/hooks/useKnowledge';

const { Title } = Typography;
const { useBreakpoint } = Grid;

export default function ExamPage() {
  // 响应式检测
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { exams, isLoading } = useExams();
  const { createExam, deleteExam, startExam } = useExamActions();
  const { setExamKnowledgeBases } = useKnowledgeActions();

  const handleCreate = async (values: ExamCreateDto, knowledgeBaseIds: number[]) => {
    setLoading(true);
    try {
      const result = await createExam(values) as { id: number };
      const examId = result.id;
      
      // 保存知识库关联
      if (knowledgeBaseIds.length > 0) {
        await setExamKnowledgeBases(examId, knowledgeBaseIds);
      }
      
      message.success('笔试创建成功');
      setIsModalOpen(false);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startExam(id);
      router.push(`/exam/${id}/session`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启动笔试失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteExam(id);
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
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between',
          alignItems: isMobile ? 'stretch' : 'center',
          gap: isMobile ? 12 : 0
        }}
      >
        <Title level={2} style={{ margin: 0 }}>
          笔试模式
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setIsModalOpen(true)}
          style={{ width: isMobile ? '100%' : 'auto' }}
        >
          新建笔试
        </Button>
      </div>

      {exams.length === 0 ? (
        <EmptyState
          description="还没有创建笔试，快来创建第一个吧！"
          actionText="新建笔试"
          onAction={() => setIsModalOpen(true)}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {exams.map((exam) => (
            <Col xs={24} sm={12} lg={8} key={exam.id}>
              <ExamCard
                exam={exam}
                onStart={handleStart}
                onDelete={handleDelete}
              />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="新建笔试"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={isMobile ? '95vw' : 600}
      >
        <ExamForm
          onSubmit={handleCreate}
          onCancel={() => setIsModalOpen(false)}
          loading={loading}
        />
      </Modal>
    </DashboardLayout>
  );
}

