// Gemini Provider 实现（简化版）
import { LLMApi } from '../base';
import { ChatOptions, ChatMessage, MultimodalContent } from '@/types/api';
import { getAIConfig } from '../config';
import { streamWithThink } from '../stream';
import { parseGeminiSSE } from '../parsers/gemini';
import { retryWithBackoff, defaultRetryConfig, defaultShouldRetry } from '../retry';

type GeminiInlineData = {
  mimeType: string;
  data: string;
};

type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
};

type GeminiContent = {
  role: 'user' | 'model';
  parts: GeminiPart[];
};

function extractSystemInstruction(messages: ChatMessage[]): string | MultimodalContent[] | undefined {
  // Gemini 不支持 system role；仅用于 systemInstruction 字段
  const systemMessage = messages.find((msg: ChatMessage) => msg.role === 'system');
  return systemMessage?.content;
}

function mapMultimodalItemToGeminiPart(item: MultimodalContent): GeminiPart {
  if (item.type === 'text') {
    return { text: item.text || '' };
  }

  if (item.type !== 'image_url' || !item.image_url) {
    return { text: '' };
  }

  const url = item.image_url.url;

  // 提取 base64 数据（data URI 格式：data:image/png;base64,xxx）
  if (!url.startsWith('data:')) {
    throw new Error('Gemini 只支持 base64 格式的图片（data URI）');
  }

  const base64Part = url.split(',')[1];
  if (!base64Part) {
    throw new Error('无效的 data URI 格式');
  }

  console.log('[Gemini] 使用 base64 图片，大小:', `${(base64Part.length / 1024).toFixed(2)} KB`);

  return {
    inlineData: {
      mimeType: 'image/png',
      data: base64Part,
    },
  };
}

function buildGeminiContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .filter((msg: ChatMessage) => msg.role !== 'system') // 过滤 system 角色
    .map((msg: ChatMessage) => {
      const role: GeminiContent['role'] = msg.role === 'user' ? 'user' : 'model'; // assistant → model

      if (typeof msg.content === 'string') {
        return { role, parts: [{ text: msg.content }] };
      }

      const parts = msg.content.map((item) => mapMultimodalItemToGeminiPart(item));
      return { role, parts };
    });
}

function buildGenerationConfig(options: ChatOptions) {
  return {
    temperature: options.config.temperature ?? 0.7,
    maxOutputTokens: options.config.max_tokens ?? 16384, // 默认 16384 tokens（约 8000 中文字符）
    topP: options.config.top_p ?? 0.95,
  };
}

function buildRequestPayload(
  contents: GeminiContent[],
  generationConfig: ReturnType<typeof buildGenerationConfig>,
  systemInstruction: string | MultimodalContent[] | undefined
): Record<string, unknown> {
  const requestPayload: Record<string, unknown> = {
    contents,
    generationConfig,
  };

  if (!systemInstruction) {
    return requestPayload;
  }

  requestPayload.systemInstruction = {
    parts: [
      {
        text: typeof systemInstruction === 'string'
          ? systemInstruction
          : JSON.stringify(systemInstruction),
      },
    ],
  };

  return requestPayload;
}

function checkHasImage(contents: GeminiContent[]): boolean {
  return contents.some((content) => content.parts.some((part) => !!part.inlineData));
}

function logGeminiRequest(params: {
  model: string;
  contents: GeminiContent[];
  hasSystemInstruction: boolean;
  temperature: number;
  maxOutputTokens: number;
  timeout: number;
  hasImage: boolean;
  supportsVision: boolean | 'N/A';
}) {
  console.log('[Gemini] 请求参数:', {
    model: params.model,
    contentCount: params.contents.length,
    hasSystemInstruction: params.hasSystemInstruction,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    timeout: `${params.timeout} ms`,
    hasImage: params.hasImage,
    supportsVision: params.supportsVision,
  });

  if (!params.hasImage) {
    return;
  }

  console.log('[Gemini] 发送多模态消息（包含图片）');
  params.contents.forEach((content, idx) => {
    const imageParts = content.parts.filter((part) => !!part.inlineData);
    if (imageParts.length === 0) {
      return;
    }
    console.log(`[Gemini] 消息${idx} 包含 ${imageParts.length} 张图片`);
  });
}

/**
 * Gemini 客户端实现
 * 
 * 支持特性：
 * - 流式输出（直接转发给客户端）
 * - <think> 标签保持原样（客户端负责解析）
 * - systemInstruction 字段
 * - 指数退避重试机制（只在连接建立前重试）
 */
export class GeminiClient extends LLMApi {
  async chat(options: ChatOptions): Promise<void> {
    const config = getAIConfig();
    const { apiKey, baseUrl, model: defaultModel, timeout } = config.gemini;

    if (!apiKey) {
      throw new Error('Gemini API Key 未配置，请设置环境变量 GEMINI_API_KEY');
    }

    const systemInstruction = extractSystemInstruction(options.messages);
    const contents = buildGeminiContents(options.messages);
    const generationConfig = buildGenerationConfig(options);
    const requestPayload = buildRequestPayload(contents, generationConfig, systemInstruction);

    const actualModel = options.config.model || defaultModel;

    // 检查是否包含图片
    const hasImage = checkHasImage(contents);

    // 验证模型是否支持 Vision（Gemini 的 flash/pro 模型都支持）
    const visionModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-exp'];
    const modelName = actualModel.toLowerCase();
    const supportsVision = visionModels.some(vm => modelName.includes(vm));

    // if (hasImage && !supportsVision) {
    //   console.warn(`[Gemini] ⚠️ 警告：模型 "${actualModel}" 可能不支持图片输入！`);
    //   console.warn('[Gemini] 支持图片的模型：', visionModels.join(', '));
    // }

    logGeminiRequest({
      model: actualModel,
      contents,
      hasSystemInstruction: !!systemInstruction,
      temperature: generationConfig.temperature,
      maxOutputTokens: generationConfig.maxOutputTokens,
      timeout,
      hasImage,
      supportsVision: hasImage ? supportsVision : 'N/A',
    });

    // 创建 AbortController
    const controller = new AbortController();
    options.onController?.(controller);

    // 请求 URL（注意：Gemini 使用 streamGenerateContent 端点，带 ?alt=sse 参数）
    const url = `${baseUrl}/models/${actualModel}:streamGenerateContent?alt=sse`;

    // 请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };

    // 流是否已开始的标志（用于重试边界控制）
    let streamStarted = false;

    console.log('[Gemini] 使用重试配置:', {
      maxRetries: defaultRetryConfig.maxRetries,
      initialDelayMs: defaultRetryConfig.initialDelayMs,
      timeout: `${timeout} ms`,
    });

    // 使用重试包装器调用流式处理
    await retryWithBackoff(
      async () => {
        // 调用流式处理（简化版接口）
        return streamWithThink(
          url,
          requestPayload,
          headers,
          controller,
          parseGeminiSSE,  // 解析器现在直接返回字符串
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
          // 如果流已经开始传输数据，不重试
          if (streamStarted) {
            console.log('[Gemini] 流已开始传输，不重试');
            return false;
          }
          // 否则使用默认重试逻辑
          return defaultShouldRetry(error);
        }
      }
    );
  }
}
