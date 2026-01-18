'use client';

import { useState, useEffect } from 'react';
import { Upload, Button, Card, message, Progress, Space, Typography, Descriptions, Alert, Popconfirm, Tabs, Form, Input } from 'antd';
import { InboxOutlined, CheckCircleOutlined, DeleteOutlined, FileOutlined, LinkOutlined } from '@ant-design/icons';
import type { UploadProps, UploadFile } from 'antd';

const { Dragger } = Upload;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// 服务器文件信息接口
interface ServerFileInfo {
  fileName: string;
  fileSize: number;
  uploadTime: string;
  exists: boolean;
  version?: string;
  downloadType?: string;
  downloadUrl?: string;
}

export default function UploadClient() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [serverFileInfo, setServerFileInfo] = useState<ServerFileInfo | null>(null);
  const [loadingFileInfo, setLoadingFileInfo] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('file');
  const [linkForm] = Form.useForm();
  const [submittingLink, setSubmittingLink] = useState(false);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // 格式化时间
  const formatTime = (isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // 获取服务器文件信息
  const fetchFileInfo = async () => {
    setLoadingFileInfo(true);
    try {
      const response = await fetch('/api/download/client/info', {
        method: 'GET',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setServerFileInfo(data.data);
      } else {
        console.error('获取文件信息失败:', data.error);
      }
    } catch (error) {
      console.error('获取文件信息错误:', error);
    } finally {
      setLoadingFileInfo(false);
    }
  };

  // 删除服务器文件
  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/download/client', {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('客户端安装包删除成功！');
        // 刷新文件信息
        await fetchFileInfo();
      } else {
        throw new Error(data.error || '删除失败');
      }
    } catch (error) {
      console.error('删除错误:', error);
      message.error(error instanceof Error ? error.message : '删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  // 组件加载时获取文件信息
  useEffect(() => {
    fetchFileInfo();
  }, []);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.msi',
    maxCount: 1,
    fileList: fileList,
    beforeUpload: (file) => {
      // 验证文件类型
      const isMsi = file.name.toLowerCase().endsWith('.msi');
      if (!isMsi) {
        message.error('只能上传 .msi 格式的文件！');
        return Upload.LIST_IGNORE;
      }

      // 验证文件大小（最大 500MB）
      const isLt500M = file.size / 1024 / 1024 < 500;
      if (!isLt500M) {
        message.error('文件大小不能超过 500MB！');
        return Upload.LIST_IGNORE;
      }

      // 保存选中的文件
      setSelectedFile(file as File);
      setFileList([{
        uid: file.uid,
        name: file.name,
        status: 'done',
        size: file.size,
      } as UploadFile]);

      message.success('文件已选择，请点击"确认上传"按钮');
      
      return false; // 阻止自动上传
    },
    onRemove: () => {
      setSelectedFile(null);
      setFileList([]);
      setUploadProgress(0);
    },
    showUploadList: true,
  };

  // 确认上传处理函数
  const handleUpload = async () => {
    if (!selectedFile) {
      message.warning('请先选择文件');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('uploadType', 'file');

    try {
      // 模拟上传进度
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/upload/client', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (response.ok && data.success) {
        setUploadProgress(100);
        message.success('客户端安装包上传成功！');
        
        // 清空文件选择
        setTimeout(() => {
          setSelectedFile(null);
          setFileList([]);
          setUploadProgress(0);
          // 刷新文件信息
          fetchFileInfo();
        }, 2000);
      } else {
        throw new Error(data.error || '上传失败');
      }
    } catch (error) {
      console.error('上传错误:', error);
      message.error(error instanceof Error ? error.message : '上传失败，请重试');
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };

  // 提交外部链接处理函数
  const handleSubmitLink = async (values: any) => {
    setSubmittingLink(true);

    try {
      const response = await fetch('/api/upload/client', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uploadType: 'link',
          downloadUrl: values.downloadUrl,
          version: values.version,
          fileName: values.fileName || 'OfferCar-AI.msi',
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        message.success('下载链接配置成功！');
        linkForm.resetFields();
        // 刷新文件信息
        await fetchFileInfo();
      } else {
        throw new Error(data.error || '配置失败');
      }
    } catch (error) {
      console.error('配置链接错误:', error);
      message.error(error instanceof Error ? error.message : '配置失败，请重试');
    } finally {
      setSubmittingLink(false);
    }
  };

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={3} style={{ margin: 0 }}>
            客户端安装包上传
          </Title>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            上传 Windows 客户端安装包（.msi 格式）
          </Text>
        </Space>
      }
    //   style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Tabs 切换上传方式 */}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'file',
              label: (
                <span>
                  <InboxOutlined style={{ marginRight: 8 }} />
                  上传文件
                </span>
              ),
              children: (
                <>
                  {/* 拖拽上传区域 */}
                  <Dragger {...uploadProps} disabled={uploading}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">点击或拖拽文件到此区域选择</p>
                    <p className="ant-upload-hint">
                      仅支持 .msi 格式文件，文件大小限制：最大 500MB
                    </p>
                  </Dragger>
                </>
              ),
            },
            {
              key: 'link',
              label: (
                <span>
                  <LinkOutlined style={{ marginRight: 8 }} />
                  外部链接
                </span>
              ),
              children: (
                <Card type="inner" title="配置外部下载链接">
                  <Paragraph type="secondary" style={{ marginBottom: 24 }}>
                    如果您的安装包托管在其他平台（如阿里云OSS、CDN等），可以直接输入下载链接
                  </Paragraph>
                  <Form
                    form={linkForm}
                    layout="vertical"
                    onFinish={handleSubmitLink}
                    initialValues={{
                      fileName: 'OfferCar-AI.msi',
                    }}
                  >
                    <Form.Item
                      label="下载链接"
                      name="downloadUrl"
                      rules={[
                        { required: true, message: '请输入下载链接' },
                        { type: 'url', message: '请输入有效的URL地址' },
                        {
                          pattern: /^https?:\/\/.+/,
                          message: '链接必须以 http:// 或 https:// 开头',
                        },
                      ]}
                    >
                      <Input
                        placeholder="https://example.com/OfferCar-AI.msi"
                        size="large"
                      />
                    </Form.Item>

                    <Form.Item
                      label="文件名"
                      name="fileName"
                      rules={[{ required: true, message: '请输入文件名' }]}
                    >
                      <Input placeholder="OfferCar-AI.msi" size="large" />
                    </Form.Item>

                    <Form.Item
                      label="版本号"
                      name="version"
                      rules={[{ required: true, message: '请输入版本号' }]}
                    >
                      <Input placeholder="1.0.0" size="large" />
                    </Form.Item>

                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        size="large"
                        loading={submittingLink}
                        block
                      >
                        保存配置
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              ),
            },
          ]}
        />

        {/* 文件信息卡片 */}
        {selectedFile && !uploading && uploadProgress === 0 && (
          <Card 
            type="inner" 
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>已选择文件</span>
              </Space>
            }
          >
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="文件名">{selectedFile.name}</Descriptions.Item>
              <Descriptions.Item label="文件大小">{formatFileSize(selectedFile.size)}</Descriptions.Item>
              <Descriptions.Item label="文件类型">.msi (Windows 安装包)</Descriptions.Item>
            </Descriptions>
            
            <div style={{ marginTop: 16, textAlign: 'center' }}>
              <Button 
                type="primary" 
                size="large"
                onClick={handleUpload}
                style={{ minWidth: 200 }}
              >
                确认上传
              </Button>
            </div>
          </Card>
        )}

        {/* 上传进度 */}
        {uploadProgress > 0 && (
          <Card type="inner" title="上传进度">
            <Progress
              percent={uploadProgress}
              status={uploadProgress === 100 ? 'success' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#87d068',
              }}
            />
          </Card>
        )}

        {/* 服务器文件信息 */}
        {serverFileInfo && serverFileInfo.exists && (
          <Alert
            message={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Space direction="vertical" size={4}>
                  <Space>
                    <FileOutlined style={{ fontSize: '16px' }} />
                    <span>
                      <strong>文件名:</strong> {serverFileInfo.fileName}
                      {serverFileInfo.version && (
                        <> | <strong>版本:</strong> {serverFileInfo.version}</>
                      )}
                    </span>
                  </Space>
                  <span style={{ fontSize: '13px', color: '#666' }}>
                    <strong>类型:</strong> {serverFileInfo.downloadType === 'local' ? '本地文件' : '外部链接'}
                    {serverFileInfo.downloadType === 'local' && serverFileInfo.fileSize > 0 && (
                      <> | <strong>大小:</strong> {formatFileSize(serverFileInfo.fileSize)}</>
                    )}
                    {' | '}
                    <strong>配置时间:</strong> {formatTime(serverFileInfo.uploadTime)}
                  </span>
                  {serverFileInfo.downloadType === 'external' && serverFileInfo.downloadUrl && (
                    <span style={{ fontSize: '12px', color: '#888' }}>
                      <strong>下载地址:</strong> {serverFileInfo.downloadUrl.substring(0, 80)}{serverFileInfo.downloadUrl.length > 80 ? '...' : ''}
                    </span>
                  )}
                </Space>
                <Popconfirm
                  title="确认删除"
                  description={`确定要删除当前的${serverFileInfo.downloadType === 'local' ? '客户端安装包' : '下载链接配置'}吗？此操作不可恢复。`}
                  onConfirm={handleDelete}
                  okText="确定"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                >
                  <Button 
                    type="primary" 
                    danger 
                    size="small"
                    icon={<DeleteOutlined />}
                    loading={deleting}
                  >
                    删除
                  </Button>
                </Popconfirm>
              </div>
            }
            type="info"
            showIcon={false}
          />
        )}

        {/* 上传说明 */}
        <div style={{ color: '#666', fontSize: '14px' }}>
          <Title level={5}>使用说明：</Title>
          <ul style={{ paddingLeft: 20 }}>
            <li><strong>上传文件：</strong>将安装包上传到本服务器，适合小文件或内网部署</li>
            <li><strong>外部链接：</strong>使用第三方存储（OSS/CDN），适合大文件或加速下载</li>
            <li>每次配置会替换之前的版本</li>
            <li>配置完成后，用户可通过首页下载新版本</li>
          </ul>
        </div>
      </Space>
    </Card>
  );
}
