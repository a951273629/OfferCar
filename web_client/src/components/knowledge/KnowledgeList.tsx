'use client';

import { Row, Col, Typography, Divider, Empty, Spin } from 'antd';
import { KnowledgeCard } from './KnowledgeCard';
import { KnowledgeBase } from '@/types';

const { Title } = Typography;

interface KnowledgeListProps {
  knowledgeBases: KnowledgeBase[];
  loading?: boolean;
  onView?: (id: number) => void;
  onEdit?: (id: number) => void;
  onDelete?: (id: number) => void;
  showActions?: boolean;
}

export function KnowledgeList({
  knowledgeBases,
  loading = false,
  onView,
  onEdit,
  onDelete,
  showActions = true,
}: KnowledgeListProps) {
  // 分离官方和个人知识库
  const officialKnowledgeBases = knowledgeBases.filter(kb => kb.is_official);
  const userKnowledgeBases = knowledgeBases.filter(kb => !kb.is_official);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (knowledgeBases.length === 0) {
    return (
      <Empty
        description="暂无知识库"
        style={{ padding: '60px 0' }}
      />
    );
  }

  return (
    <div style={{ overflowX: 'hidden' }}>
      {/* 官方知识库 */}
      {officialKnowledgeBases.length > 0 && (
        <>
          {/* <Title level={4}>官方知识库</Title> */}
          <Row gutter={[16, 16]} style={{ marginBottom: 32, marginLeft: 0, marginRight: 0 }}>
            {officialKnowledgeBases.map((kb) => (
              <Col xs={24} sm={12} lg={8} key={kb.id}>
                <KnowledgeCard
                  knowledge={kb}
                  onView={onView}
                  showActions={showActions && !!onView}
                />
              </Col>
            ))}
          </Row>
          {userKnowledgeBases.length > 0 && <Divider />}
        </>
      )}

      {/* 个人知识库 */}
      {userKnowledgeBases.length > 0 && (
        <>
          {/* <Title level={4}>我的知识库</Title> */}
          <Row gutter={[16, 16]} style={{ marginLeft: 0, marginRight: 0 }}>
            {userKnowledgeBases.map((kb) => (
              <Col xs={24} sm={12} lg={8} key={kb.id}>
                <KnowledgeCard
                  knowledge={kb}
                  onView={onView}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  showActions={showActions}
                />
              </Col>
            ))}
          </Row>
        </>
      )}
    </div>
  );
}





