// AI 客户端封装 - Provider 抽象层
// 支持 OpenAI 和 Gemini 的统一接口

import { ChatOptions, AIProvider } from '@/types/api';
import { getAIConfig, validateAIConfig } from './config';
import { LLMApi } from './base';
import { OpenAIClient } from './providers/openai';
import { GeminiClient } from './providers/gemini';

// 导出 LLMApi 供外部使用
export { LLMApi } from './base';

/**
 * 工厂函数：根据 provider 获取对应的客户端实例
 * 
 * @param provider - AI Provider 类型（可选，默认从配置读取）
 * @returns LLMApi 实例
 * @throws Error - 如果 provider 不支持或配置无效
 */
export function getAIClient(provider?: AIProvider): LLMApi {
  const config = getAIConfig();
  const actualProvider = provider || config.provider;

  // 验证配置
  if (!validateAIConfig(actualProvider)) {
    throw new Error(
      `${actualProvider} 配置不完整，请检查环境变量：` +
      `${actualProvider === AIProvider.OpenAI ? 'OPENAI_API_KEY, OPENAI_API_URL' : 'GEMINI_API_KEY, GEMINI_API_URL'}`
    );
  }

  // 根据 Provider 类型返回对应的客户端实例
  switch (actualProvider) {
    case AIProvider.OpenAI:
      return new OpenAIClient();
    case AIProvider.Gemini:
      return new GeminiClient();
    default:
      throw new Error(`不支持的 AI Provider: ${actualProvider}`);
  }
}

/**
 * 便捷函数：直接发送聊天请求
 * 
 * 使用示例：
 * ```typescript
 * await sendChatRequest({
 *   messages: [{ id: '1', role: 'user', content: 'Hello', date: new Date().toISOString() }],
 *   config: { provider: AIProvider.Gemini, stream: true },
 *   onUpdate: (msg, chunk) => console.log(chunk),
 *   onFinish: (msg) => console.log('Done:', msg),
 * });
 * ```
 * 
 * @param options - 聊天选项
 */
export async function sendChatRequest(options: ChatOptions): Promise<void> {
  const client = getAIClient(options.config.provider);
  return client.chat(options);
}

// ==================== 兼容旧接口（保留以避免破坏性改动） ====================

/**
 * @deprecated 请使用 sendChatRequest 或 getAIClient
 */
export { getAIConfig } from './config';
