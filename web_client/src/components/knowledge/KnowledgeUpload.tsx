'use client';

import { Upload, message, Typography, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { readFileAsText, validateFileType, validateFileSize, countWords } from '@/lib/utils/file';
import type { UploadProps } from 'antd';

const { Text } = Typography;
const { Dragger } = Upload;

interface KnowledgeUploadProps {
  onFileRead: (content: string, fileName: string, fileType: 'txt' | 'md') => void;
  maxSizeMB?: number;
}

export function KnowledgeUpload({ onFileRead, maxSizeMB = 5 }: KnowledgeUploadProps) {
  const handleBeforeUpload = async (file: File) => {
    // 验证文件类型
    if (!validateFileType(file, ['.txt', '.md'])) {
      message.error('只支持 TXT 或 Markdown 格式的文件');
      return Upload.LIST_IGNORE;
    }

    // 验证文件大小
    if (!validateFileSize(file, maxSizeMB)) {
      message.error(`文件大小不能超过 ${maxSizeMB} MB`);
      return Upload.LIST_IGNORE;
    }

    try {
      // 读取文件内容
      const content = await readFileAsText(file);
      
      // 验证内容长度
      if (content.length > 100000) {
        message.error('文件内容过长，请控制在 10 万字符以内');
        return Upload.LIST_IGNORE;
      }

      // 统计字数
      const wordCount = countWords(content);
      if (wordCount < 100) {
        message.warning('内容较少，建议至少包含 100 字');
      } else if (wordCount > 30000) {
        message.warning('内容较多，建议控制在 6000字以内以获得最佳效果');
      }

      // 确定文件类型
      const fileName = file.name.toLowerCase();
      const fileType: 'txt' | 'md' = fileName.endsWith('.md') ? 'md' : 'txt';

      // 回调
      onFileRead(content, file.name, fileType);
      message.success('文件读取成功');
    } catch (error) {
      console.error('文件读取失败:', error);
      message.error('文件读取失败，请重试');
    }

    // 阻止自动上传
    return Upload.LIST_IGNORE;
  };

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.txt,.md',
    beforeUpload: handleBeforeUpload,
    showUploadList: false,
  };

  return (
    <div>
      <Alert
        message="上传说明"
        description={
          <div>
            <Text>• 支持 TXT 和 Markdown 格式</Text>
            <br />
            <Text>• 文件大小不超过 {maxSizeMB} MB</Text>
            <br />
            <Text>• 建议字数在 2 万字左右，效果最佳</Text>
            <br />
            <Text>• 推荐以问答形式组织内容</Text>
          </div>
        }
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
        <p className="ant-upload-hint">
          支持 .txt 和 .md 格式，文件将在浏览器中读取，不会上传到服务器
        </p>
      </Dragger>
    </div>
  );
}





