'use client';

import { Input, Select, Space, Row, Col } from 'antd';
import { SearchOutlined, TagsOutlined } from '@ant-design/icons';

const { Search } = Input;

interface KnowledgeSearchProps {
  onSearch: (keyword: string) => void;
  onTagFilter: (tags: string[]) => void;
  availableTags?: string[];
  loading?: boolean;
}

export function KnowledgeSearch({
  onSearch,
  onTagFilter,
  availableTags = [],
  loading = false,
}: KnowledgeSearchProps) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Search
          placeholder="搜索知识库标题或描述"
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          onSearch={onSearch}
          loading={loading}
        />
      </Col>
      <Col xs={24} md={12}>
        <Select
          mode="multiple"
          size="large"
          placeholder="按标签筛选"
          allowClear
          style={{ width: '100%' }}
          onChange={onTagFilter}
          options={availableTags.map(tag => ({ label: tag, value: tag }))}
          maxTagCount="responsive"
          suffixIcon={<TagsOutlined />}
        />
      </Col>
    </Row>
  );
}





