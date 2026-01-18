'use client';

import {
  Button,
  Modal,
  message,
  Typography,
  Tabs,
  Space,
  Divider,
  Grid,
} from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { KnowledgeList } from '@/components/knowledge/KnowledgeList';
import { KnowledgeForm } from '@/components/knowledge/KnowledgeForm';
import { KnowledgeUpload } from '@/components/knowledge/KnowledgeUpload';
import { KnowledgePreview } from '@/components/knowledge/KnowledgePreview';
import { KnowledgeSearch } from '@/components/knowledge/KnowledgeSearch';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import {
  useKnowledgeBases,
  useKnowledgeActions,
} from '@/hooks/useKnowledge';
import {
  KnowledgeBase,
  KnowledgeBaseCreateDto,
  KnowledgeBaseUpdateDto,
} from '@/types';

const { Title } = Typography;
const { useBreakpoint } = Grid;

type ModalMode = 'create' | 'edit' | 'upload';

export default function KnowledgePage() {
  // 响应式检测
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px
  
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('create');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadedContent, setUploadedContent] = useState<{
    content: string;
    fileName: string;
    fileType: 'txt' | 'md';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const { knowledgeBases, isLoading, mutate } = useKnowledgeBases();
  const {
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
  } = useKnowledgeActions();

  // 提取所有标签（用于搜索筛选）
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    knowledgeBases.forEach(kb => {
      kb.tags?.forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [knowledgeBases]);

  // 搜索和筛选
  const filteredKnowledgeBases = useMemo(() => {
    return knowledgeBases.filter(kb => {
      // 关键词搜索
      const matchKeyword =
        !searchKeyword ||
        kb.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        kb.description?.toLowerCase().includes(searchKeyword.toLowerCase());

      // 标签筛选
      const matchTags =
        filterTags.length === 0 ||
        (kb.tags && filterTags.some(tag => kb.tags?.includes(tag)));

      return matchKeyword && matchTags;
    });
  }, [knowledgeBases, searchKeyword, filterTags]);

  const handleOpenModal = (mode: ModalMode, id?: number) => {
    setModalMode(mode);
    setSelectedId(id || null);
    setUploadedContent(null);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedId(null);
    setUploadedContent(null);
  };

  const handleCreate = async (values: KnowledgeBaseCreateDto) => {
    setLoading(true);
    try {
      await createKnowledgeBase(values);
      message.success('创建成功');
      handleCloseModal();
      mutate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (values: KnowledgeBaseUpdateDto) => {
    if (!selectedId) return;

    setLoading(true);
    try {
      await updateKnowledgeBase(selectedId, values);
      message.success('更新成功');
      handleCloseModal();
      mutate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteKnowledgeBase(id);
      message.success('删除成功');
      mutate();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const handleView = (id: number) => {
    setSelectedId(id);
    setPreviewOpen(true);
  };

  const handleFileRead = (
    content: string,
    fileName: string,
    fileType: 'txt' | 'md'
  ) => {
    setUploadedContent({ content, fileName, fileType });
    // 自动切换到表单填写
    setModalMode('create');
  };

  // 统一的表单提交处理函数
  const handleSubmit = async (
    values: KnowledgeBaseCreateDto | KnowledgeBaseUpdateDto
  ) => {
    if (modalMode === 'edit' && selectedId) {
      await handleUpdate(values as KnowledgeBaseUpdateDto);
    } else {
      await handleCreate(values as KnowledgeBaseCreateDto);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loading />
      </DashboardLayout>
    );
  }

  // 表单初始值（编辑模式或上传后）
  const formInitialValues = modalMode === 'edit' && selectedId
    ? knowledgeBases.find(kb => kb.id === selectedId)
    : uploadedContent
    ? {
        title: uploadedContent.fileName.replace(/\.(txt|md)$/i, ''),
        content: uploadedContent.content,
        file_type: uploadedContent.fileType,
      }
    : undefined;

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
          知识库
        </Title>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
          <Button
            type="default"
            icon={<UploadOutlined />}
            onClick={() => handleOpenModal('upload')}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            上传文件
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal('create')}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            新建知识库
          </Button>
        </Space>
      </div>

      {/* 搜索和筛选 */}
      <div style={{ marginBottom: 24 }}>
        <KnowledgeSearch
          onSearch={setSearchKeyword}
          onTagFilter={setFilterTags}
          availableTags={availableTags}
        />
      </div>

      <Divider />

      {/* 知识库列表 */}
      {filteredKnowledgeBases.length === 0 && !isLoading ? (
        <EmptyState
          description={
            searchKeyword || filterTags.length > 0
              ? '没有找到匹配的知识库'
              : '还没有创建知识库，快来创建第一个吧！'
          }
          actionText="新建知识库"
          onAction={() => handleOpenModal('create')}
        />
      ) : (
        <KnowledgeList
          knowledgeBases={filteredKnowledgeBases}
          loading={isLoading}
          onView={handleView}
          onEdit={id => handleOpenModal('edit', id)}
          onDelete={handleDelete}
        />
      )}

      {/* 创建/编辑模态框 */}
      <Modal
        title={
          modalMode === 'upload'
            ? '上传知识库文件'
            : modalMode === 'edit'
            ? '编辑知识库'
            : '新建知识库'
        }
        open={modalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={isMobile ? '95vw' : (modalMode === 'upload' && !uploadedContent ? 600 : 700)}
        destroyOnHidden
      >
        {modalMode === 'upload' && !uploadedContent ? (
          <KnowledgeUpload onFileRead={handleFileRead} />
        ) : (
          <KnowledgeForm
            initialValues={formInitialValues}
            onSubmit={handleSubmit}
            onCancel={handleCloseModal}
            loading={loading}
            isEdit={modalMode === 'edit'}
          />
        )}
      </Modal>

      {/* 预览模态框 */}
      <KnowledgePreview
        knowledge={
          previewOpen && selectedId
            ? knowledgeBases.find(kb => kb.id === selectedId) || null
            : null
        }
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setSelectedId(null);
        }}
      />
    </DashboardLayout>
  );
}





