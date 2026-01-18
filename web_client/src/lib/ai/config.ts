// AI 客户端配置管理
import { AIProvider } from '@/types/api';

// AI 配置接口
export interface AIConfig {
  provider: AIProvider;  // 默认 Provider
  openai: {
    apiKey: string;
    baseUrl: string;
    model: string;
    modelGeneral: string;  // General 模式模型
    modelPro: string;      // Pro 模式模型
    modelMax: string;      // Max 模式模型
    timeout: number;       // 请求超时时间（毫秒）
  };
  gemini: {
    apiKey: string;
    baseUrl: string;
    model: string;
    timeout: number;      // 请求超时时间（毫秒）
  };
}

function parseTimeoutMs(raw: string | undefined, fallbackMs: number): number {
  const value = Number(raw || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return fallbackMs;
  }
  return value;
}

// 从环境变量读取配置
export function getAIConfig(): AIConfig {
  // 确定默认 Provider
  const providerEnv = process.env.AI_PROVIDER?.toLowerCase();
  let provider: AIProvider;

  if (providerEnv === 'openai') {
    provider = AIProvider.OpenAI;
  } else if (providerEnv === 'gemini') {
    provider = AIProvider.Gemini;
  } else {
    // 默认 Gemini（向后兼容）
    provider = AIProvider.Gemini;
  }

  return {
    provider,
    openai: {
      apiKey: process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '',
      baseUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1',
      model: process.env.OPENAI_MODEL,
      modelGeneral: process.env.OPENAI_MODEL_GENERAL,
      modelPro: process.env.OPENAI_MODEL_PRO,
      modelMax: process.env.OPENAI_MODEL_MAX,
      timeout: parseTimeoutMs(process.env.OPENAI_TIMEOUT || process.env.AI_REQUEST_TIMEOUT, 60000),
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.AI_API_KEY || '',
      baseUrl: process.env.GEMINI_API_URL || process.env.AI_API_URL || 'https://generativelanguage.googleapis.com/v1',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
      timeout: parseTimeoutMs(process.env.GEMINI_TIMEOUT || process.env.AI_REQUEST_TIMEOUT, 60000),
    },
  };
}

// 验证配置是否完整
export function validateAIConfig(provider: AIProvider): boolean {
  const config = getAIConfig();

  if (provider === AIProvider.OpenAI) {
    return !!config.openai.apiKey && !!config.openai.baseUrl;
  } else if (provider === AIProvider.Gemini) {
    return !!config.gemini.apiKey && !!config.gemini.baseUrl;
  }

  return false;
}

/**
 * 根据模式获取对应的模型名称
 * @param mode - 模型模式 (general/pro/max)
 * @returns 模型名称
 */
export function getModelByMode(mode: 'general' | 'pro' | 'max'): string {
  const config = getAIConfig();
  const modelMap = {
    general: config.openai.modelGeneral,
    pro: config.openai.modelPro,
    max: config.openai.modelMax,
  };
  return modelMap[mode];
}

/**
 * 根据模式获取对应的点数消耗
 * @param mode - 模型模式 (general/pro/max)
 * @returns 点数消耗
 */
export function getPointsByMode(mode: 'general' | 'pro' | 'max'): number {
  const pointsMap = {
    general: 10,
    pro: 28,
    max: 58,
  };
  return pointsMap[mode];
}

