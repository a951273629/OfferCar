'use client';

import { useState } from 'react';
import { Form, Input, Select, Button, message, Upload, Divider, Grid, Alert, Progress } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { InterviewCreateDto } from '@/types';
import {
  LANGUAGE_OPTIONS,
  PROGRAMMING_LANGUAGE_OPTIONS,
  INTERVIEW_TYPE_OPTIONS,
} from '@/types/constants';
import { KnowledgeSelector } from '@/components/knowledge/KnowledgeSelector';
import { useKnowledgeBases } from '@/hooks/useKnowledge';
import { usePdfParser } from '@/hooks/usePdfParser';
import { useAppSelector } from '@/store/hooks';
import { selectGlobalConfig } from '@/store/settingsSlice';

const { TextArea } = Input;
const { Dragger } = Upload;
const { useBreakpoint } = Grid;

interface InterviewFormProps {
  initialValues?: Partial<InterviewCreateDto>;
  initialKnowledgeBaseIds?: number[]; // 新增：初始选中的知识库 ID
  onSubmit: (values: InterviewCreateDto, knowledgeBaseIds: number[]) => Promise<void>; // 修改：添加知识库参数
  onCancel?: () => void;
  loading?: boolean;
}

export function InterviewForm({
  initialValues,
  initialKnowledgeBaseIds = [],
  onSubmit,
  onCancel,
  loading = false,
}: InterviewFormProps) {
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<number[]>(initialKnowledgeBaseIds);
  const screens = useBreakpoint();
  const isMobile = !screens.md; // < 768px 为移动端
  const globalConfig = useAppSelector(selectGlobalConfig);
  
  // 获取所有可用的知识库
  const { knowledgeBases, isLoading: isLoadingKnowledgeBases } = useKnowledgeBases();

  // PDF 解析 Hook
  const { fileName, fileContent, parsing, progress, error, parseFile, clearFile } = usePdfParser();

  // 响应式样式配置
  const buttonSize = isMobile ? 'large' : 'middle';
  const buttonGap = isMobile ? '8px' : '12px';

  const handleFinish = async (values: InterviewCreateDto) => {
    // Guard Clause: 检查是否有解析错误
    if (error) {
      message.error(error);
      return;
    }

    // 如果有文件内容，直接使用（已在上传时解析）
    if (fileContent && fileName) {
      values.resume_url = fileName;
      values.resume_content = fileContent;
    }

    try {
      // 创建时：DefaultSessionConfig = GlobalConfig
      try {
        values.default_session_config_json = JSON.stringify(globalConfig);
      } catch (error) {
        console.warn('[InterviewForm] default_session_config_json 序列化失败，跳过:', error);
      }

      await onSubmit(values, selectedKnowledgeBaseIds);
      
      // 清理状态
      form.resetFields();
      setFileList([]);
      clearFile();
      setSelectedKnowledgeBaseIds([]);
      // 成功消息由父组件处理
    } catch (error) {
      console.error('[Interview Form] 提交失败:', error);
      message.error(error instanceof Error ? error.message : '操作失败');
    }
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    fileList,
    maxCount: 1,
    accept: '.pdf,.txt',
    beforeUpload: (file) => {
      // Guard Clause: 验证文件类型
      const isValidType = [
        'application/pdf',
        'text/plain',
      ].includes(file.type);
      
      if (!isValidType) {
        message.error('只支持 .pdf、.txt 格式的文件');
        return false;
      }
      
      // 保存文件到列表
      setFileList([file]);
      
      // 立即触发解析
      parseFile(file);
      
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setFileList([]);
      clearFile(); // 清除解析状态
    },
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{
        language: 'zh',
        interview_type: 'technical',
        ...initialValues,
      }}
      onFinish={handleFinish}
    >
      <Form.Item
        label="面试名称"
        name="title"
        rules={[{ required: true, message: '请输入面试名称' }]}
        tooltip="给这次面试起一个简短的名称，例如：未命名面试"
      >
        <Input placeholder="未命名面试" maxLength={100} showCount />
      </Form.Item>

      <Form.Item
        label="语音识别和答题语言"
        name="language"
        rules={[{ required: true, message: '请选择语音识别和答题语言' }]}
        tooltip="选择面试中使用的主要语言，用于语音识别和答题"
      >
        <Select options={[...LANGUAGE_OPTIONS]} placeholder="请选择语言" />
      </Form.Item>

      <Form.Item
        label="编程语言"
        name="programming_language"
        tooltip="如果是技术面试，请选择主要使用的编程语言（可选）"
      >
        <Select
          options={[...PROGRAMMING_LANGUAGE_OPTIONS]}
          placeholder="请选择编程语言"
          allowClear
        />
      </Form.Item>

      <Form.Item
        label="我的简历"
        tooltip="上传您的简历，支持 .pdf、.txt 格式，文件大小不超过 10MB"
      >
        {isMobile ? (
          <Alert
            message="移动端不支持简历上传"
            type="info"
            showIcon
          />
        ) : (
          <>
            <Dragger {...uploadProps}>
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 .pdf、.txt 格式，文件大小不超过 10MB
              </p>
            </Dragger>
            
            {parsing && (
              <div style={{ marginTop: '12px' }}>
                <Progress 
                  percent={progress} 
                  status="active"
                  strokeColor={{
                    '0%': '#108ee9',
                    '100%': '#87d068',
                  }}
                />
                <p style={{ marginTop: '8px', color: '#666', fontSize: '14px' }}>
                  正在解析文件，请稍候...
                </p>
              </div>
            )}
            
            {fileContent && !parsing && (
              <Alert
                message={`解析成功（${fileContent.length} 字符）`}
                type="success"
                showIcon
                style={{ marginTop: '12px' }}
              />
            )}
            
            {error && !parsing && (
              <Alert
                message={error}
                type="error"
                showIcon
                style={{ marginTop: '12px' }}
              />
            )}
          </>
        )}
      </Form.Item>

      <Form.Item
        label="可选择知识库"
        tooltip="选择相关的知识库，AI 会根据知识库内容提供更精准的面试辅导"
      >
        <KnowledgeSelector
          knowledgeBases={knowledgeBases}
          selectedIds={selectedKnowledgeBaseIds}
          onChange={setSelectedKnowledgeBaseIds}
          loading={isLoadingKnowledgeBases}
        />
      </Form.Item>

      <Divider />

      <Form.Item
        label="面试职位"
        name="position"
        rules={[{ required: true, message: '请输入面试职位' }]}
        tooltip="您应聘的职位名称"
      >
        <Input placeholder="请输入面试职位" maxLength={100} showCount />
      </Form.Item>

      <Form.Item
        label="面试类型"
        name="interview_type"
        rules={[{ required: true, message: '请选择面试类型' }]}
        tooltip="选择面试的类型，不同类型会影响面试问题的风格"
      >
        <Select options={[...INTERVIEW_TYPE_OPTIONS]} placeholder="请选择面试类型" />
      </Form.Item>

      <Form.Item
        label="招聘信息"
        name="job_description"
        tooltip="添加岗位招聘要求以获得更准确的结果（可选）"
      >
        <TextArea
          rows={6}
          placeholder="添加岗位招聘要求以获得更准确的结果"
          maxLength={2000}
          showCount
        />
      </Form.Item>

      <Form.Item>
        <div style={{ display: 'flex', gap: buttonGap, justifyContent: 'flex-end' }}>
          {onCancel && (
            <Button onClick={onCancel} disabled={loading} size={buttonSize}>
              取消
            </Button>
          )}
          <Button type="primary" htmlType="submit" loading={loading || parsing} disabled={parsing} size={buttonSize}>
            {initialValues ? '更新' : '确认'}
          </Button>
        </div>
      </Form.Item>
    </Form>
  );
}
