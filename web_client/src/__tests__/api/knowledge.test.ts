/**
 * 知识库 API 路由测试
 * 测试 GET /api/knowledge 和 POST /api/knowledge
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/knowledge/route';
import { verifyAuth } from '@/lib/auth/middleware';
import {
  getAllKnowledgeBases,
  getOfficialKnowledgeBases,
  getKnowledgeBasesByUserId,
  createKnowledgeBase,
} from '@/lib/db/queries/knowledge-base';

// Mock 依赖
jest.mock('@/lib/auth/middleware');
jest.mock('@/lib/db/queries/knowledge-base');

const mockVerifyAuth = verifyAuth as jest.MockedFunction<typeof verifyAuth>;
const mockGetAllKnowledgeBases = getAllKnowledgeBases as jest.MockedFunction<typeof getAllKnowledgeBases>;
const mockGetOfficialKnowledgeBases = getOfficialKnowledgeBases as jest.MockedFunction<typeof getOfficialKnowledgeBases>;
const mockGetKnowledgeBasesByUserId = getKnowledgeBasesByUserId as jest.MockedFunction<typeof getKnowledgeBasesByUserId>;
const mockCreateKnowledgeBase = createKnowledgeBase as jest.MockedFunction<typeof createKnowledgeBase>;

describe('GET /api/knowledge', () => {
  const mockUserId = 'u_test_1';
  const mockKnowledgeBases = [
    {
      id: 1,
      user_id: mockUserId,
      title: 'React 面试题',
      description: 'React 相关面试题',
      content: 'Q: 什么是 React？\nA: React 是一个用于构建用户界面的 JavaScript 库。',
      file_type: 'txt' as const,
      tags: ['React', '前端'],
      is_official: false,
      word_count: 50,
      status: 'active' as const,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
    {
      id: 2,
      user_id: null,
      title: '官方知识库',
      description: '官方提供的知识库',
      content: 'Q: 什么是面试？\nA: 面试是求职过程中的重要环节。',
      file_type: 'md' as const,
      tags: ['官方'],
      is_official: true,
      word_count: 30,
      status: 'active' as const,
      created_at: new Date('2024-01-01'),
      updated_at: new Date('2024-01-01'),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue(mockUserId);
  });

  it('应该成功获取所有知识库（官方+用户）', async () => {
    mockGetAllKnowledgeBases.mockResolvedValue(mockKnowledgeBases);

    const req = new NextRequest('http://localhost:3000/api/knowledge');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ data: mockKnowledgeBases });
    expect(mockVerifyAuth).toHaveBeenCalledWith(req);
    expect(mockGetAllKnowledgeBases).toHaveBeenCalledWith(mockUserId);
  });

  it('应该仅获取官方知识库', async () => {
    const officialKnowledgeBases = [mockKnowledgeBases[1]];
    mockGetOfficialKnowledgeBases.mockResolvedValue(officialKnowledgeBases);

    const req = new NextRequest('http://localhost:3000/api/knowledge?official=true');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ data: officialKnowledgeBases });
    expect(mockGetOfficialKnowledgeBases).toHaveBeenCalled();
    expect(mockGetAllKnowledgeBases).not.toHaveBeenCalled();
  });

  it('应该仅获取用户自己的知识库', async () => {
    const userKnowledgeBases = [mockKnowledgeBases[0]];
    mockGetKnowledgeBasesByUserId.mockResolvedValue(userKnowledgeBases);

    const req = new NextRequest('http://localhost:3000/api/knowledge?user_only=true');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ data: userKnowledgeBases });
    expect(mockGetKnowledgeBasesByUserId).toHaveBeenCalledWith(mockUserId);
  });

  it('应该返回空数组当没有知识库时', async () => {
    mockGetAllKnowledgeBases.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:3000/api/knowledge');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ data: [] });
  });

  it('应该在未认证时返回 401', async () => {
    mockVerifyAuth.mockRejectedValue(new Error('未授权'));

    const req = new NextRequest('http://localhost:3000/api/knowledge');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toHaveProperty('error');
  });

  it('应该处理数据库错误', async () => {
    mockGetAllKnowledgeBases.mockRejectedValue(new Error('数据库连接失败'));

    const req = new NextRequest('http://localhost:3000/api/knowledge');
    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: '数据库连接失败' });
  });
});

describe('POST /api/knowledge', () => {
  const mockUserId = 'u_test_1';

  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyAuth.mockResolvedValue(mockUserId);
  });

  it('应该成功创建知识库', async () => {
    const newKnowledgeBase = {
      title: 'Vue 面试题',
      description: 'Vue 相关面试题',
      content: 'Q: 什么是 Vue？\nA: Vue 是一个渐进式 JavaScript 框架。',
      file_type: 'txt' as const,
      tags: ['Vue', '前端'],
    };
    const mockId = 123;
    mockCreateKnowledgeBase.mockResolvedValue(mockId);

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(newKnowledgeBase),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toEqual({ data: { id: mockId, message: '创建成功' } });
    expect(mockCreateKnowledgeBase).toHaveBeenCalledWith(mockUserId, newKnowledgeBase);
  });

  it('应该在缺少标题时返回 400', async () => {
    const invalidData = {
      content: '测试内容',
      file_type: 'txt',
    };

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: '标题、内容和文件类型为必填项' });
    expect(mockCreateKnowledgeBase).not.toHaveBeenCalled();
  });

  it('应该在缺少内容时返回 400', async () => {
    const invalidData = {
      title: '测试标题',
      file_type: 'txt',
    };

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: '标题、内容和文件类型为必填项' });
  });

  it('应该在缺少文件类型时返回 400', async () => {
    const invalidData = {
      title: '测试标题',
      content: '测试内容',
    };

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: '标题、内容和文件类型为必填项' });
  });

  it('应该在文件类型不支持时返回 400', async () => {
    const invalidData = {
      title: '测试标题',
      content: '测试内容',
      file_type: 'pdf',
    };

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: '不支持的文件类型' });
  });

  it('应该在内容过长时返回 400', async () => {
    const invalidData = {
      title: '测试标题',
      content: 'a'.repeat(100001), // 超过 10 万字符
      file_type: 'txt',
    };

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(invalidData),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: '内容过长，请控制在 10 万字符以内' });
  });

  it('应该处理创建失败的情况', async () => {
    const newKnowledgeBase = {
      title: 'Vue 面试题',
      content: 'Q: 什么是 Vue？',
      file_type: 'txt' as const,
    };
    mockCreateKnowledgeBase.mockRejectedValue(new Error('数据库写入失败'));

    const req = new NextRequest('http://localhost:3000/api/knowledge', {
      method: 'POST',
      body: JSON.stringify(newKnowledgeBase),
    });
    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: '数据库写入失败' });
  });
});

