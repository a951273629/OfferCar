// OpenAI Provider 实现（简化版）
import { LLMApi } from '../base';
import { ChatOptions, ChatMessage } from '@/types/api';
import { getAIConfig, getModelByMode } from '../config';
import { streamWithThink } from '../stream';
import { parseOpenAISSE } from '../parsers/openai';
import { retryWithBackoff, defaultRetryConfig, defaultShouldRetry } from '../retry';

/**
 * 检查消息中是否包含图片
 */
function checkForImages(messages: Array<{ content: string | Array<{ type: string }> }>): boolean {
  return messages.some(msg => 
    Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
  );
}

/**
 * 打印请求信息和图片详情
 */
function logRequestInfo(
  requestPayload: { model: string; temperature: number },
  messages: Array<{ role: string; content: string | Array<{ type: string; image_url?: { url: string } }> }>,
  timeout: number,
  hasImage: boolean
): void {
  // console.log('[OpenAI] 请求参数:', {
  //   model: requestPayload.model,
  //   messageCount: messages.length,
  //   temperature: requestPayload.temperature,
  //   timeout: `${timeout} ms`,
  //   hasImage,
  // });

  if (!hasImage) {
    return;
  }

  // console.log('[OpenAI] 发送多模态消息（包含图片）');
  messages.forEach((msg, idx) => {
    if (!Array.isArray(msg.content)) {
      return;
    }
    
    const imageItems = msg.content.filter(item => item.type === 'image_url');
    imageItems.forEach((item, imgIdx) => {
      const url = item.image_url?.url || '';
      console.log(`[OpenAI] 消息${idx} 图片${imgIdx}:`, url.substring(0, 100) + '...');
    });
  });
}

/**
 * OpenAI 客户端实现
 * 
 * 支持特性：
 * - 流式输出（直接转发给客户端）
 * - 思考模式（o1 系列模型的 reasoning_content，原样转发）
 * - 标准 chat/completions API
 * - 指数退避重试机制（只在连接建立前重试）
 */
export class OpenAIClient extends LLMApi {
  async chat(options: ChatOptions): Promise<void> {
    const config = getAIConfig();
    const { apiKey, baseUrl, model: defaultModel, timeout } = config.openai;

    if (!apiKey) {
      throw new Error('OpenAI API Key 未配置，请设置环境变量 OPENAI_API_KEY');
    }

    // 转换消息格式为 OpenAI 格式（支持多模态）
    const messages = options.messages.map((msg: ChatMessage) => ({
      role: msg.role,
      content: msg.content,  // 直接传递，支持 string 或 MultimodalContent[]
    }));

    // 根据 modelMode 选择模型
    let selectedModel = options.config.model || defaultModel;
    const modelMode = options.modelMode || options.config.modelMode;
    if (modelMode) {
      selectedModel = getModelByMode(modelMode);
      console.log(`[OpenAI] 使用 ${modelMode.toUpperCase()} 模式，模型: ${selectedModel}`);
    }

    // 构建请求体
    const requestPayload = {
      model: selectedModel,
      messages,
      temperature: options.config.temperature ?? 0.7,
      max_tokens: options.config.max_tokens ?? 12*1024,  // AI回复最大长度（非上下文窗口）
      top_p: options.config.top_p ?? 0.95,
      presence_penalty: options.config.presence_penalty ?? 0,
      frequency_penalty: options.config.frequency_penalty ?? 0,
      stream: true,  // 强制流式输出
    };

    // 检查是否包含图片并打印日志
    const hasImage = checkForImages(messages);
    logRequestInfo(requestPayload, messages, timeout, hasImage);

    // 创建 AbortController
    const controller = new AbortController();
    options.onController?.(controller);

    // 请求 URL
    const url = `${baseUrl}/chat/completions`;

    // 请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // 流是否已开始的标志（用于重试边界控制）
    let streamStarted = false;

    // console.log('[OpenAI] 使用重试配置:', {
    //   maxRetries: defaultRetryConfig.maxRetries,
    //   initialDelayMs: defaultRetryConfig.initialDelayMs,
    //   timeout: `${timeout} ms`,
    // });

    // 使用重试包装器调用流式处理
    await retryWithBackoff(
      async () => {
        // 调用流式处理（简化版接口）
        await streamWithThink(
          url,
          requestPayload,
          headers,
          controller,
          parseOpenAISSE,  // 解析器现在直接返回字符串
          {
            onUpdate: (chunk) => {
              // 首次接收数据时标记流已开始
              streamStarted = true;
              options.onUpdate?.(chunk);
            },
            onFinish: options.onFinish,
            onError: options.onError,
          },
          timeout  // 传入超时配置
        );
      },
      {
        ...defaultRetryConfig,
        shouldRetry: (error: Error) => {
          // 如果流已经开始传输数据，不重试（Early Return）
          if (streamStarted) {
            console.log('[OpenAI] 流已开始传输，不重试');
            return false;
          }
          
          // 使用默认重试逻辑
          return defaultShouldRetry(error);
        }
      }
    );
  }
}
