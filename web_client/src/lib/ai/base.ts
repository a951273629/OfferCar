// LLM API 抽象基类
// 所有 Provider 实现必须继承此类

import { ChatOptions } from '@/types/api';

/**
 * LLM API 抽象基类
 * 
 * 所有 Provider 实现必须继承此类并实现 chat 方法
 */
export abstract class LLMApi {
  /**
   * 发送聊天请求（流式）
   * 
   * @param options - 聊天选项（包含消息、配置、回调）
   */
  abstract chat(options: ChatOptions): Promise<void>;
}

