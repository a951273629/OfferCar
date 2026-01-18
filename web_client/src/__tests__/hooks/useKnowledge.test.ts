/**
 * useKnowledge Hook 测试
 * 测试知识库相关的自定义 Hook
 */

import { renderHook, waitFor } from '@testing-library/react';
import {
  useKnowledgeBases,
  useKnowledgeBase,
  useKnowledgeActions,
} from '@/hooks/useKnowledge';
import { api } from '@/lib/utils/api';
import { KnowledgeBase, KnowledgeBaseCreateDto, KnowledgeBaseUpdateDto } from '@/types';

// Mock SWR
jest.mock('swr', () => {
  const originalModule = jest.requireActual('swr');
  return {
    __esModule: true,
    ...originalModule,
    default: jest.fn((key, fetcher) => {
      if (!key) {
        return {
          data: undefined,
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        };
      }

      // 根据不同的 key 返回不同的 mock 数据
      const mockData = getMockDataForKey(key);
      
      return {
        data: mockData,
        error: undefined,
        isLoading: false,
        mutate: jest.fn(),
      };
    }),
  };
});

// Mock api
jest.mock('@/lib/utils/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApi = api as jest.Mocked<typeof api>;

// Mock 知识库数据
const mockKnowledgeBases: KnowledgeBase[] = [
  {
    id: 1,
    user_id: 'u_test_1',
    title: 'React 面试题',
    description: 'React 相关面试题',
    content: 'Q: 什么是 React？\nA: React 是一个用于构建用户界面的 JavaScript 库。',
    file_type: 'txt',
    tags: ['React', '前端'],
    is_official: false,
    word_count: 50,
    status: 'active',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
  {
    id: 2,
    user_id: null,
    title: '官方知识库',
    description: '官方提供的知识库',
    content: 'Q: 什么是面试？\nA: 面试是求职过程中的重要环节。',
    file_type: 'md',
    tags: ['官方'],
    is_official: true,
    word_count: 30,
    status: 'active',
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  },
];

// 辅助函数：根据 key 返回 mock 数据
function getMockDataForKey(key: string): unknown {
  if (key === '/knowledge') {
    return mockKnowledgeBases;
  }
  if (key === '/knowledge?official=true') {
    return [mockKnowledgeBases[1]];
  }
  if (key === '/knowledge?user_only=true') {
    return [mockKnowledgeBases[0]];
  }
  if (key === '/knowledge/1') {
    return mockKnowledgeBases[0];
  }
  return undefined;
}

describe('useKnowledgeBases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功获取所有知识库', () => {
    const { result } = renderHook(() => useKnowledgeBases());

    expect(result.current.knowledgeBases).toEqual(mockKnowledgeBases);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isError).toBeUndefined();
  });

  it('应该仅获取官方知识库', () => {
    const { result } = renderHook(() => useKnowledgeBases(true, false));

    expect(result.current.knowledgeBases).toHaveLength(1);
    expect(result.current.knowledgeBases[0].is_official).toBe(true);
  });

  it('应该仅获取用户知识库', () => {
    const { result } = renderHook(() => useKnowledgeBases(false, true));

    expect(result.current.knowledgeBases).toHaveLength(1);
    expect(result.current.knowledgeBases[0].user_id).toBe('u_test_1');
  });

  it('应该返回空数组当没有数据时', () => {
    // 重新 mock SWR 返回 undefined
    jest.isolateModules(() => {
      jest.doMock('swr', () => ({
        __esModule: true,
        default: jest.fn(() => ({
          data: undefined,
          error: undefined,
          isLoading: false,
          mutate: jest.fn(),
        })),
      }));
    });

    const { result } = renderHook(() => useKnowledgeBases());
    expect(result.current.knowledgeBases).toEqual([]);
  });
});

describe('useKnowledgeBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('应该成功获取单个知识库', () => {
    const { result } = renderHook(() => useKnowledgeBase(1));

    expect(result.current.knowledgeBase).toEqual(mockKnowledgeBases[0]);
    expect(result.current.isLoading).toBe(false);
  });

  it('应该在 id 为 null 时不发起请求', () => {
    const { result } = renderHook(() => useKnowledgeBase(null));

    expect(result.current.knowledgeBase).toBeUndefined();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('useKnowledgeActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createKnowledgeBase', () => {
    it('应该成功创建知识库', async () => {
      const newKnowledgeBase: KnowledgeBaseCreateDto = {
        title: 'Vue 面试题',
        description: 'Vue 相关面试题',
        content: 'Q: 什么是 Vue？\nA: Vue 是一个渐进式 JavaScript 框架。',
        file_type: 'txt',
        tags: ['Vue', '前端'],
      };
      const mockResponse = { id: 3, message: '创建成功' };
      mockApi.post.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useKnowledgeActions());

      await waitFor(async () => {
        const response = await result.current.createKnowledgeBase(newKnowledgeBase);
        expect(response).toEqual(mockResponse);
      });

      expect(mockApi.post).toHaveBeenCalledWith('/knowledge', newKnowledgeBase);
    });

    it('应该处理创建失败', async () => {
      const newKnowledgeBase: KnowledgeBaseCreateDto = {
        title: 'Vue 面试题',
        content: 'Q: 什么是 Vue？',
        file_type: 'txt',
      };
      mockApi.post.mockRejectedValue(new Error('创建失败'));

      const { result } = renderHook(() => useKnowledgeActions());

      await expect(async () => {
        await result.current.createKnowledgeBase(newKnowledgeBase);
      }).rejects.toThrow('创建失败');
    });
  });

  describe('updateKnowledgeBase', () => {
    it('应该成功更新知识库', async () => {
      const updateData: KnowledgeBaseUpdateDto = {
        title: '更新后的标题',
        description: '更新后的描述',
      };
      const mockResponse = { message: '更新成功' };
      mockApi.put.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useKnowledgeActions());

      await waitFor(async () => {
        const response = await result.current.updateKnowledgeBase(1, updateData);
        expect(response).toEqual(mockResponse);
      });

      expect(mockApi.put).toHaveBeenCalledWith('/knowledge/1', updateData);
    });

    it('应该处理更新失败', async () => {
      const updateData: KnowledgeBaseUpdateDto = {
        title: '更新后的标题',
      };
      mockApi.put.mockRejectedValue(new Error('更新失败'));

      const { result } = renderHook(() => useKnowledgeActions());

      await expect(async () => {
        await result.current.updateKnowledgeBase(1, updateData);
      }).rejects.toThrow('更新失败');
    });
  });

  describe('deleteKnowledgeBase', () => {
    it('应该成功删除知识库', async () => {
      mockApi.delete.mockResolvedValue({ message: '删除成功' });

      const { result } = renderHook(() => useKnowledgeActions());

      await waitFor(async () => {
        await result.current.deleteKnowledgeBase(1);
      });

      expect(mockApi.delete).toHaveBeenCalledWith('/knowledge/1');
    });

    it('应该处理删除失败', async () => {
      mockApi.delete.mockRejectedValue(new Error('删除失败'));

      const { result } = renderHook(() => useKnowledgeActions());

      await expect(async () => {
        await result.current.deleteKnowledgeBase(1);
      }).rejects.toThrow('删除失败');
    });
  });

  describe('setInterviewKnowledgeBases', () => {
    it('应该成功设置面试关联的知识库', async () => {
      const interviewId = 1;
      const knowledgeBaseIds = [1, 2];
      mockApi.post.mockResolvedValue({ message: '设置成功' });

      const { result } = renderHook(() => useKnowledgeActions());

      await waitFor(async () => {
        await result.current.setInterviewKnowledgeBases(interviewId, knowledgeBaseIds);
      });

      expect(mockApi.post).toHaveBeenCalledWith('/knowledge/link', {
        interview_id: interviewId,
        knowledge_base_ids: knowledgeBaseIds,
      });
    });

    it('应该处理设置失败', async () => {
      const interviewId = 1;
      const knowledgeBaseIds = [1, 2];
      mockApi.post.mockRejectedValue(new Error('设置失败'));

      const { result } = renderHook(() => useKnowledgeActions());

      await expect(async () => {
        await result.current.setInterviewKnowledgeBases(interviewId, knowledgeBaseIds);
      }).rejects.toThrow('设置失败');
    });
  });
});

