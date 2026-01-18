'use client';

import { useState } from 'react';
import { Form, Input, Button, message, Select, Grid } from 'antd';
import { ExamCreateDto } from '@/types';
import {
  LANGUAGE_OPTIONS,
  PROGRAMMING_LANGUAGE_OPTIONS,
} from '@/types/constants';
import { KnowledgeSelector } from '@/components/knowledge/KnowledgeSelector';
import { useKnowledgeBases } from '@/hooks/useKnowledge';
import { useAppSelector } from '@/store/hooks';
import { selectGlobalConfig } from '@/store/settingsSlice';

const { TextArea } = Input;
const { useBreakpoint } = Grid;

interface ExamFormProps {
  initialValues?: Partial<ExamCreateDto>;
  initialKnowledgeBaseIds?: number[];
  onSubmit: (values: ExamCreateDto, knowledgeBaseIds: number[]) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export function ExamForm({
  initialValues,
  initialKnowledgeBaseIds = [],
  onSubmit,
  onCancel,
  loading = false,
}: ExamFormProps) {
  const [form] = Form.useForm();
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>(initialKnowledgeBaseIds);
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为移动端
  const globalConfig = useAppSelector(selectGlobalConfig);

  // 获取所有可用的知识库
  const { knowledgeBases, isLoading: isLoadingKnowledgeBases } = useKnowledgeBases();

  // 响应式样式配置
  const buttonSize = isMobile ? 'large' : 'middle';
  const buttonGap = isMobile ? '8px' : '12px';

  const handleFinish = async (values: ExamCreateDto) => {
    try {
      // 创建时：DefaultSessionConfig = GlobalConfig
      try {
        values.default_session_config_json = JSON.stringify(globalConfig);
      } catch (error) {
        console.warn('[ExamForm] default_session_config_json 序列化失败，跳过:', error);
      }

      await onSubmit(values, selectedKnowledgeBaseIds);
      form.resetFields();
      setSelectedKnowledgeBaseIds([]);
      // message.success(initialValues ? '笔试更新成功' : '笔试创建成功'); 父组件处理
    } catch (error) {
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        language: 'zh',
        ...initialValues,
      }}
      onFinish={handleFinish}
    >
      <Form.Item
        label="笔试标题"
        name="title"
        rules={[{ required: true, message: '请输入笔试标题' }]}
      >
        <Input placeholder="例如：Java后端开发笔试" />
      </Form.Item>

      <Form.Item
        label="职位名称"
        name="position"
        rules={[{ required: true, message: '请输入职位名称' }]}
      >
        <Input placeholder="例如：Java工程师" />
      </Form.Item>

      <Form.Item
        label="回答语言"
        name="language"
        rules={[{ required: true, message: '请选择回答语言' }]}
        tooltip="选择笔试中使用的主要语言"
      >
        <Select options={[...LANGUAGE_OPTIONS]} placeholder="请选择语言" />
      </Form.Item>

      <Form.Item
        label="编程语言"
        name="programming_language"
        tooltip="如果是技术笔试，请选择主要使用的编程语言（可选）"
      >
        <Select
          options={[...PROGRAMMING_LANGUAGE_OPTIONS]}
          placeholder="请选择编程语言"
          allowClear
        />
      </Form.Item>

      <Form.Item label="笔试描述" name="description">
        <TextArea
          rows={4}
          placeholder="请输入笔试的相关说明和要求"
          maxLength={2000}
          showCount
        />
      </Form.Item>

      <Form.Item
        label="可选择知识库"
        tooltip="选择相关的知识库，AI 会根据知识库内容提供更精准的笔试辅导"
      >
        <KnowledgeSelector
          knowledgeBases={knowledgeBases}
          selectedIds={selectedKnowledgeBaseIds}
          onChange={setSelectedKnowledgeBaseIds}
          loading={isLoadingKnowledgeBases}
        />
      </Form.Item>

      <Form.Item>
        <div style={{ display: 'flex', gap: buttonGap, justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button onClick={onCancel} size={buttonSize} disabled={loading}>
              取消
            </Button>
          )}
          <Button type="primary" htmlType="submit" loading={loading} size={buttonSize}>
            {initialValues ? '更新' : '创建'}
          </Button>
        </div>
      </Form.Item>
    </Form>
  );
}

