'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Input, Checkbox, List, Pagination, Tag, Space, Typography, Card, Grid } from 'antd';
import { SearchOutlined, CrownOutlined, LeftOutlined, RightOutlined, FileTextOutlined } from '@ant-design/icons';
import { KnowledgeBase } from '@/types';
import { KNOWLEDGE_FILE_TYPE_TEXT } from '@/types/constants';

const { useBreakpoint } = Grid;

const { Text } = Typography;

interface KnowledgeSelectorProps {
  knowledgeBases: KnowledgeBase[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  loading?: boolean;
}

const PAGE_SIZE = 5;

export function KnowledgeSelector({
  knowledgeBases,
  selectedIds,
  onChange,
  loading = false,
}: KnowledgeSelectorProps) {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为移动端

  // 搜索过滤逻辑
  const filteredKnowledgeBases = useMemo(() => {
    if (!searchKeyword.trim()) {
      return knowledgeBases;
    }
    const keyword = searchKeyword.toLowerCase();
    return knowledgeBases.filter(
      kb =>
        kb.title.toLowerCase().includes(keyword) ||
        (kb.description && kb.description.toLowerCase().includes(keyword))
    );
  }, [knowledgeBases, searchKeyword]);

  // 分页数据
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return filteredKnowledgeBases.slice(startIndex, endIndex);
  }, [filteredKnowledgeBases, currentPage]);

  // 总页数
  const totalPages = Math.ceil(filteredKnowledgeBases.length / PAGE_SIZE);
  
  // 是否显示分页器
  // const showPagination = filteredKnowledgeBases.length > PAGE_SIZE;

  // 搜索关键词变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword]);

  const toggleId = useCallback(
    (id: number, checked: boolean) => {
      if (checked) {
        if (selectedIds.includes(id)) {
          return;
        }
        onChange([...selectedIds, id]);
        return;
      }

      if (!selectedIds.includes(id)) {
        return;
      }
      onChange(selectedIds.filter((x) => x !== id));
    },
    [onChange, selectedIds]
  );

  // 自定义分页器渲染 - 仅显示左右箭头
  const itemRender = (
    _: number,
    type: 'page' | 'prev' | 'next' | 'jump-prev' | 'jump-next',
    originalElement: React.ReactNode
  ) => {
    if (type === 'prev') {
      return <LeftOutlined />;
    }
    if (type === 'next') {
      return <RightOutlined />;
    }
    return null;
  };

  return (
    <Card style={{ position: 'relative' }}>
      {/* 搜索框 */}
      <Input
        placeholder="搜索知识库"
        prefix={<SearchOutlined />}
        value={searchKeyword}
        onChange={e => setSearchKeyword(e.target.value)}
        style={{ marginBottom: 16 }}
        allowClear
        disabled={loading}
      />

      {/* 复选框列表（受控单项 toggle，跨分页不丢失） */}
      <List
        dataSource={paginatedData}
        locale={{ emptyText: '暂无数据' }}
        renderItem={(kb) => (
          <List.Item style={{ padding: '12px 0', border: 'none' }}>
            <Checkbox
              checked={selectedIds.includes(kb.id)}
              onChange={(e) => toggleId(kb.id, e.target.checked)}
              style={{ width: '100%' }}
              disabled={loading}
            >
              <Space wrap>
                <Text strong>{kb.title}</Text>
                {kb.is_official && (
                  <Tag color="gold" icon={<CrownOutlined />} style={{ margin: 0 }}>
                    官方
                  </Tag>
                )}
                {!isMobile && (
                  <>
                    <Tag color="blue" icon={<FileTextOutlined />} style={{ margin: 0 }}>
                      {KNOWLEDGE_FILE_TYPE_TEXT[kb.file_type]}
                    </Tag>
                    <Tag color="cyan" style={{ margin: 0 }}>
                      {kb.word_count} 字
                    </Tag>
                    {kb.tags && kb.tags.length > 0 && (
                      <Tag color="default" style={{ margin: 0 }}>
                        {kb.tags[0]}
                      </Tag>
                    )}
                  </>
                )}
              </Space>
            </Checkbox>
          </List.Item>
        )}
      />

      {/* 分页器 - 绝对定位在右下角 */}
      { (
        <Pagination
          current={currentPage}
          total={filteredKnowledgeBases.length}
          pageSize={PAGE_SIZE}
          onChange={setCurrentPage}
          disabled={loading}
          showSizeChanger={false}
          itemRender={itemRender}
          style={{ position: 'absolute', bottom: 16, right: 16 }}
        />
      )}
    </Card>
  );
}





