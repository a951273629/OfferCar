// 核心流式处理模块（服务器端 - 彻底简化版）
// 职责：建立 SSE 连接，直接转发数据块给客户端
import { fetchEventSource, EventStreamContentType } from '@fortaine/fetch-event-source';

// SSE 解析器类型：直接返回字符串（简化版）
export type SSEParser = (text: string) => string;

// 流式处理选项
export interface StreamOptions {
  onUpdate?: (chunk: string) => void;      // 实时更新回调（只传递当前块）
  onFinish: (message: string) => void;     // 完成回调（传递完整消息）
  onError?: (error: Error) => void;        // 错误回调
}

// 请求超时时间（60秒）
const REQUEST_TIMEOUT_MS = 60000;

type TimeoutId = ReturnType<typeof setTimeout>;

/**
 * 构建错误消息
 */
async function buildErrorMessage(res: Response): Promise<string> {
  let errorMessage = `HTTP ${res.status}`;
  
  try {
    const errorText = await res.clone().text();
    errorMessage += `: ${errorText}`;
  } catch {
    // 静默处理解析失败
  }

  if (res.status === 401) {
    return '未授权：请检查 API Key';
  }

  return errorMessage;
}

function clearTimeoutSafe(id: TimeoutId | null) {
  if (!id) {
    return;
  }
  clearTimeout(id);
}

function isBlank(text: string | null | undefined): boolean {
  if (!text) {
    return true;
  }
  return text.trim().length === 0;
}

/**
 * 流式处理函数（服务器端版本 - 彻底简化）
 * 
 * 核心职责：
 * - 使用 fetchEventSource 建立 SSE 连接到 AI API
 * - 直接转发 AI API 的数据块（无缓冲、无动画、无格式化）
 * - 所有 <think> 标签处理和动画逻辑由客户端负责
 * 
 * @param url - AI API 的 SSE 端点 URL
 * @param requestPayload - 请求体
 * @param headers - 请求头
 * @param controller - AbortController
 * @param parseSSE - SSE 解析器函数
 * @param options - 回调选项
 * @param timeoutMs - 请求超时时间（毫秒），可选，默认 60 秒
 */
export function streamWithThink(
  url: string,
  requestPayload: Record<string, unknown>,
  headers: Record<string, string>,
  controller: AbortController,
  parseSSE: SSEParser,
  options: StreamOptions,
  timeoutMs?: number,
): Promise<void> {
  let fullText = ''; // 累积完整文本（用于 onFinish）
  let finished = false; // 是否已完成

  // 设置请求超时（使用传入的超时时间或默认值）
  const actualTimeout = timeoutMs || REQUEST_TIMEOUT_MS;

  let connectTimeoutId: TimeoutId | null = null;
  let overallTimeoutId: TimeoutId | null = null;

  const clearTimers = () => {
    clearTimeoutSafe(connectTimeoutId);
    clearTimeoutSafe(overallTimeoutId);
    connectTimeoutId = null;
    overallTimeoutId = null;
  };

  // 完成处理函数（幂等）
  const finish = () => {
    if (finished) {
      return;
    }

    finished = true;
    clearTimers();

    console.log('[Stream] 流式传输完成');

    // 检测空回复
    if (isBlank(fullText)) {
      console.error('[Stream] AI 返回空内容');
    }

    options.onFinish(fullText);
  };

  // 监听取消信号（不覆盖 onabort，避免干扰外部）
  controller.signal.addEventListener('abort', finish, { once: true });

  // 连接超时：在 onopen 前必须建立连接
  connectTimeoutId = setTimeout(() => {
    if (controller.signal.aborted) {
      return;
    }
    console.log(`[Stream] 连接超时（${actualTimeout} ms），中止连接`);
    controller.abort();
  }, actualTimeout);

  // 总时长超时：整个流式请求最长持续时间
  overallTimeoutId = setTimeout(() => {
    if (controller.signal.aborted) {
      return;
    }
    console.log(`[Stream] 请求总时长超时（${actualTimeout} ms），中止连接`);
    controller.abort();
  }, actualTimeout);

  const appendContent = (content: string) => {
    if (isBlank(content)) {
      return;
    }
    fullText += content;
    options.onUpdate?.(content);
  };

  console.log('[Stream] 开始流式传输');

  // 建立 SSE 连接（返回 Promise 以支持 await/重试语义）
  return fetchEventSource(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(requestPayload),
    signal: controller.signal,
    
    // 连接打开回调
    async onopen(res) {
      if (controller.signal.aborted) {
        return;
      }

      clearTimeoutSafe(connectTimeoutId);
      connectTimeoutId = null;

      const contentType = res.headers.get('content-type');
      console.log('[Stream] Response content-type:', contentType);

      // 处理非流式响应（text/plain）
      if (contentType?.startsWith('text/plain')) {
        fullText = await res.clone().text();
        return finish();
      }

      // 验证 SSE 响应 - 使用 Early Return
      if (!res.ok || res.status !== 200) {
        fullText = await buildErrorMessage(res);
        return finish();
      }
      
      if (!res.headers.get('content-type')?.startsWith(EventStreamContentType)) {
        fullText = await buildErrorMessage(res);
        return finish();
      }
    },

    // 接收消息回调
    onmessage(msg) {
      // 直接检测 signal 状态（最可靠的方式）
      // 当 Provider 的 controller.abort() 被调用时，signal.aborted 立即变为 true
      if (controller.signal.aborted) {
        // 静默跳过
        return;
      }
      
      // console.log('[Stream] 接收到消息:', msg.data.substring(0, 100));  // 🔍 调试日志
      
      if (finished) {
        return;
      }

      if (msg.data === '[DONE]') {
        console.log('[Stream] 收到结束标记');
        return finish();
      }

      const text = msg.data;
      
      // 跳过空消息
      if (isBlank(text)) {
        return;
      }

      try {
        // 解析 SSE 数据（现在直接返回字符串）
        const content = parseSSE(text);
        // console.log('[Stream] 解析后内容长度:', content?.length || 0);  // 🔍 调试日志
        
        // 跳过空内容
        if (isBlank(content)) {
          return;
        }

        appendContent(content);
        
      } catch (e) {
        console.error('[Stream] 解析错误:', text, e);
        // 解析失败不抛出错误，继续处理下一条消息
      }
    },

    // 连接关闭回调
    onclose() {
      finish();
    },

    // 错误回调
    onerror(e) {
      options?.onError?.(e);
      throw e;
    },

    // 允许页面隐藏时继续连接
    openWhenHidden: true,
  });
}
