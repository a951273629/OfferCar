import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { getUserGlobalConfigJson, updateUserGlobalConfigJson } from '@/lib/db/queries/user';
import { ApiResponse, DEFAULT_GLOBAL_CONFIG, GlobalConfig } from '@/types';

// 强制动态渲染，因为使用了 cookies
export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeNumber(value: unknown, fallback: number): number {
  // 规则要求：用 Number(value || 0) 避免 NaN
  const n = Number((value as any) || 0);
  if (!Number.isFinite(n) || n <= 0) {
    return fallback;
  }
  return n;
}

function toSafeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== 'boolean') {
    return fallback;
  }
  return value;
}

function parseGlobalConfigJson(raw: string | null): Partial<GlobalConfig> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      return {};
    }
    return parsed as Partial<GlobalConfig>;
  } catch {
    return {};
  }
}

function sanitizeGlobalConfigPatch(
  patch: unknown,
  fallback: GlobalConfig
): Partial<GlobalConfig> {
  if (!isPlainObject(patch)) {
    return {};
  }

  const out: Partial<GlobalConfig> = {};

  if ('aiFontSize' in patch) out.aiFontSize = toSafeNumber(patch.aiFontSize, fallback.aiFontSize);
  if ('interviewerFontSize' in patch) out.interviewerFontSize = toSafeNumber(patch.interviewerFontSize, fallback.interviewerFontSize);
  if ('intervieweeFontSize' in patch) out.intervieweeFontSize = toSafeNumber(patch.intervieweeFontSize, fallback.intervieweeFontSize);
  if ('userFontSize' in patch) out.userFontSize = toSafeNumber(patch.userFontSize, fallback.userFontSize);

  if ('scopeCharacter' in patch) out.scopeCharacter = toSafeBoolean(patch.scopeCharacter, fallback.scopeCharacter);

  if ('showIntervieweeMessages' in patch) out.showIntervieweeMessages = toSafeBoolean(patch.showIntervieweeMessages, fallback.showIntervieweeMessages);
  if ('gestureEnabled' in patch) out.gestureEnabled = toSafeBoolean(patch.gestureEnabled, fallback.gestureEnabled);
  if ('bilingualEnable' in patch) out.bilingualEnable = toSafeBoolean(patch.bilingualEnable, fallback.bilingualEnable);

  return out;
}

// GET - 获取用户全局配置
export async function GET(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '未授权，请先登录',
        },
        { status: 401 }
      );
    }

    const globalConfigJson = await getUserGlobalConfigJson(payload.userId);
    const fromDb = parseGlobalConfigJson(globalConfigJson);
    // 白名单字段合并：避免旧字段（如 bgColor）回流到返回值
    const sanitizedFromDb = sanitizeGlobalConfigPatch(fromDb, DEFAULT_GLOBAL_CONFIG);
    const globalConfig: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...sanitizedFromDb };

    return NextResponse.json<ApiResponse<{ globalConfig: GlobalConfig; globalConfigJson: string | null }>>(
      {
        success: true,
        data: {
          globalConfig,
          globalConfigJson,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取用户配置失败:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取用户配置失败',
      },
      { status: 500 }
    );
  }
}

// PUT - 更新用户全局配置
export async function PUT(request: NextRequest) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '未授权，请先登录',
        },
        { status: 401 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '请求数据格式错误',
        },
        { status: 400 }
      );
    }

    // 兼容两种形态：
    // A) body 直接是 Partial<GlobalConfig>
    // B) { globalConfig: Partial<GlobalConfig> }
    const patch = isPlainObject(body) && 'globalConfig' in body ? (body as any).globalConfig : body;

    // 先读 DB 现有配置作为合并基础（避免只提交 patch 时覆盖丢失）
    const existingJson = await getUserGlobalConfigJson(payload.userId);
    const existing = parseGlobalConfigJson(existingJson);
    const sanitizedExisting = sanitizeGlobalConfigPatch(existing, DEFAULT_GLOBAL_CONFIG);
    const base: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...sanitizedExisting };
    const sanitizedPatch = sanitizeGlobalConfigPatch(patch, base);
    const merged: GlobalConfig = { ...base, ...sanitizedPatch };

    const ok = await updateUserGlobalConfigJson(payload.userId, JSON.stringify(merged));
    if (!ok) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '更新失败（用户不存在或写入失败）',
        },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<{ globalConfig: GlobalConfig }>>(
      {
        success: true,
        data: {
          globalConfig: merged,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('更新用户配置失败:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '更新用户配置失败',
      },
      { status: 500 }
    );
  }
}


