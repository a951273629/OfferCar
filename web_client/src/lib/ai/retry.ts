// AI 请求重试机制模块
// 实现指数退避重试策略，支持错误分类和自定义重试逻辑

/**
 * 重试配置接口
 */
export interface RetryConfig {
  maxRetries: number;           // 最大重试次数
  initialDelayMs: number;       // 初始延迟（毫秒）
  maxDelayMs: number;           // 最大延迟（毫秒）
  backoffFactor: number;        // 指数退避因子
  jitterFactor: number;         // 随机抖动因子（±百分比）
  shouldRetry?: (error: Error) => boolean;  // 自定义重试判断函数
}

/**
 * 重试错误类
 * 封装多次重试失败后的最终错误信息
 */
export class RetryError extends Error {
  constructor(
    public readonly attempts: number,
    public readonly lastError: Error
  ) {
    super(`请求失败，已重试 ${attempts} 次。最后错误: ${lastError.message}`);
    this.name = 'RetryError';
  }
}

/**
 * 默认重试配置
 */
export const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,       // 1 秒
  maxDelayMs: 30000,          // 30 秒
  backoffFactor: 2,           // 指数因子 2
  jitterFactor: 0.1,          // ±10% 随机抖动
};

/**
 * 计算指数退避延迟时间
 * 
 * @param retryCount - 当前重试次数（从 0 开始）
 * @param config - 重试配置
 * @returns 延迟时间（毫秒）
 */
export function calculateBackoff(retryCount: number, config: RetryConfig): number {
  const { initialDelayMs, maxDelayMs, backoffFactor, jitterFactor } = config;
  
  // 基础延迟：initialDelay * (factor ^ retryCount)
  const baseDelay = initialDelayMs * Math.pow(backoffFactor, retryCount);
  
  // 限制最大延迟
  const cappedDelay = Math.min(baseDelay, maxDelayMs);
  
  // 添加随机抖动：±jitterFactor
  const jitter = 1 + (Math.random() * 2 - 1) * jitterFactor;
  
  return Math.floor(cappedDelay * jitter);
}

function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

/**
 * 从 HTTP 响应中提取 Retry-After 头（秒数）
 * 
 * @param error - 错误对象
 * @returns Retry-After 延迟（毫秒），如果没有则返回 null
 */
function extractRetryAfter(error: Error): number | null {
  // 尝试从错误对象中提取响应对象
  // fetchEventSource 可能会将响应附加到错误对象上
  const response = (error as any).response;
  
  if (!response || !response.headers) {
    return null;
  }
  
  const retryAfter = response.headers.get('Retry-After');
  if (!retryAfter) {
    return null;
  }
  
  // Retry-After 可以是秒数或日期
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;  // 转换为毫秒
  }
  
  return null;
}

function computeDelayMs(attempt: number, lastError: Error, config: RetryConfig): number {
  // attempt: 第几次“尝试”（从 1 开始才表示重试）
  const retryIndex = Math.max(attempt - 1, 0);

  // 特殊处理 429：优先使用 Retry-After 头
  if (lastError.message.toLowerCase().includes('429')) {
    const retryAfter = extractRetryAfter(lastError);
    if (retryAfter !== null) {
      const delayMs = Math.min(retryAfter, config.maxDelayMs);
      console.log(`[Retry] 使用 Retry-After 头: ${delayMs} ms`);
      return delayMs;
    }
  }

  return calculateBackoff(retryIndex, config);
}

/**
 * 默认错误分类函数：判断错误是否可以重试
 * 
 * @param error - 错误对象
 * @returns 是否应该重试
 */
export function defaultShouldRetry(error: Error): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();
  
  // 1. 网络错误（fetch failed, connection refused 等）
  if (
    errorMessage.includes('fetch failed') ||
    errorMessage.includes('network error') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('econnrefused') ||
    errorMessage.includes('enotfound')
  ) {
    console.log('[Retry] 检测到网络错误，可重试');
    return true;
  }
  
  // 2. 超时错误（AbortError）
  if (errorName === 'aborterror' || errorMessage.includes('timeout')) {
    console.log('[Retry] 检测到超时错误，可重试');
    return true;
  }
  
  // 3. HTTP 状态码错误
  // 从错误消息中提取状态码（格式：HTTP 500, HTTP 502 等）
  const httpStatusMatch = errorMessage.match(/http[:\s]+(\d{3})/i);
  if (httpStatusMatch) {
    const statusCode = parseInt(httpStatusMatch[1], 10);
    
    // 429 速率限制 - 可重试
    if (statusCode === 429) {
      console.log('[Retry] 检测到速率限制错误（429），可重试');
      return true;
    }
    
    // 5xx 服务器错误 - 可重试
    if (statusCode >= 500 && statusCode < 600) {
      console.log(`[Retry] 检测到服务器错误（${statusCode}），可重试`);
      return true;
    }
    
    // 4xx 客户端错误（除 429）- 不可重试
    if (statusCode >= 400 && statusCode < 500) {
      console.log(`[Retry] 检测到客户端错误（${statusCode}），不可重试`);
      return false;
    }
  }
  
  // 默认：未知错误不重试
  console.log('[Retry] 未知错误类型，不重试:', error.message);
  return false;
}

/**
 * 延迟函数
 * 
 * @param ms - 延迟时间（毫秒）
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(attempt: number, lastError: Error, config: RetryConfig): boolean {
  // attempt=0 为首次请求，不在这里判断
  if (attempt === 0) {
    return true;
  }

  const shouldRetry = config.shouldRetry || defaultShouldRetry;
  if (!shouldRetry(lastError)) {
    console.log('[Retry] 错误不可重试，停止重试');
    return false;
  }

  return true;
}

/**
 * 带指数退避的重试包装器
 * 
 * @param fn - 要执行的异步函数
 * @param config - 重试配置（可选，使用默认配置）
 * @returns 函数执行结果
 * @throws RetryError - 如果所有重试都失败
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  // 合并默认配置
  const finalConfig: RetryConfig = {
    ...defaultRetryConfig,
    ...config,
    shouldRetry: config.shouldRetry || defaultShouldRetry,
  };
  
  let lastError: Error = new Error('未知错误');
  
  // 尝试执行 maxRetries + 1 次（首次 + 重试）
  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    // 首次尝试
    if (attempt === 0) {
      console.log('[Retry] 首次请求');
      try {
        return await fn();
      } catch (error) {
        lastError = toError(error);
      }
    } else {
      // 重试前检查是否应该重试
      if (!isRetryable(attempt, lastError, finalConfig)) {
        throw lastError;
      }

      const delayMs = computeDelayMs(attempt, lastError, finalConfig);

      console.log(
        `[Retry] 第 ${attempt} 次重试，延迟 ${delayMs} ms，原因: ${lastError.message}`
      );

      await sleep(delayMs);

      try {
        return await fn();
      } catch (error) {
        lastError = toError(error);
      }
    }

    // 如果是最后一次尝试，抛出 RetryError
    if (attempt === finalConfig.maxRetries) {
      console.error(
        `[Retry] 请求最终失败，已尝试 ${attempt + 1} 次`,
        lastError
      );
      throw new RetryError(attempt + 1, lastError);
    }
  }
  
  // 理论上不会到达这里
  throw new RetryError(finalConfig.maxRetries + 1, lastError);
}

