'use client';

import { Form, Input, Select, Button, Space, Typography, Tag, Grid } from 'antd';
import { KnowledgeBaseCreateDto, KnowledgeBaseUpdateDto, KnowledgeBase } from '@/types';
import { KNOWLEDGE_FILE_TYPE_OPTIONS } from '@/types/constants';
import { countWords } from '@/lib/utils/file';
import { useState, useEffect } from 'react';

const { TextArea } = Input;
const { Text } = Typography;
const { useBreakpoint } = Grid;

interface KnowledgeFormProps {
  initialValues?: Partial<KnowledgeBase>;
  onSubmit: (values: KnowledgeBaseCreateDto | KnowledgeBaseUpdateDto) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
  isEdit?: boolean;
}

export function KnowledgeForm({
  initialValues,
  onSubmit,
  onCancel,
  loading = false,
  isEdit = false,
}: KnowledgeFormProps) {
  // 响应式检测
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px
  
  const [form] = Form.useForm();
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (initialValues?.content) {
      setWordCount(countWords(initialValues.content));
    }
  }, [initialValues]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setWordCount(countWords(content));
  };

  const handleSubmit = async (values: KnowledgeBaseCreateDto) => {
    await onSubmit(values);
  };

  // 获取字数颜色（根据建议范围）
  const getWordCountColor = () => {
    if (wordCount < 1000) return 'default';
    if (wordCount < 10000) return 'processing';
    if (wordCount <= 30000) return 'success';
    return 'warning';
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      onFinish={handleSubmit}
    >
      <Form.Item
        name="title"
        label="知识库标题"
        rules={[
          { required: true, message: '请输入知识库标题' },
          { max: 100, message: '标题不能超过 100 个字符' },
        ]}
      >
        <Input placeholder="例如：React 面试知识点" />
      </Form.Item>

      <Form.Item
        name="description"
        label="描述"
        rules={[{ max: 500, message: '描述不能超过 500 个字符' }]}
      >
        <TextArea
          rows={2}
          placeholder="简单描述这个知识库的内容"
          showCount
          maxLength={500}
        />
      </Form.Item>

      {!isEdit && (
        <Form.Item
          name="file_type"
          label="文件类型"
          rules={[{ required: true, message: '请选择文件类型' }]}
        >
          <Select
            placeholder="选择文件类型"
            options={KNOWLEDGE_FILE_TYPE_OPTIONS}
          />
        </Form.Item>
      )}

      <Form.Item
        name="content"
        label={
          <Space>
            <span>知识库内容</span>
            <Tag color={getWordCountColor()}>{wordCount} 字</Tag>
            {wordCount > 0 && wordCount < 10000 && !isMobile && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                (建议 1-3 万字)
              </Text>
            )}
          </Space>
        }
        rules={[
          { required: true, message: '请输入知识库内容' },
          { min: 10, message: '内容至少 10 个字符' },
          { max: 100000, message: '内容不能超过 10 万字符' },
        ]}
      >
        <TextArea
          rows={isMobile ? 8 : 12}
          placeholder="粘贴或输入知识库内容，推荐以问答形式组织（Q: 问题 A: 答案）"
          onChange={handleContentChange}
        />
      </Form.Item>

      <Form.Item
        name="tags"
        label="标签"
        tooltip="输入标签后按回车添加，便于分类和搜索"
      >
        <Select
          mode="tags"
          placeholder="添加标签，例如：React、面试、前端"
          maxTagCount={10}
        />
      </Form.Item>

      <Form.Item>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: isMobile ? '100%' : 'auto' }}>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            {isEdit ? '更新' : '创建'}
          </Button>
          <Button 
            onClick={onCancel}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            取消
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}





