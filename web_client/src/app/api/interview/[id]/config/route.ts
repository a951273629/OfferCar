import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { getInterviewById, updateInterview } from '@/lib/db/queries/interview';
import { ApiResponse, DEFAULT_GLOBAL_CONFIG, GlobalConfig } from '@/types';

export const dynamic = 'force-dynamic';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toSafeNumber(value: unknown, fallback: number): number {
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

function parseConfigJson(raw: string | null | undefined): Partial<GlobalConfig> {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(String(raw));
    if (!isPlainObject(parsed)) {
      return {};
    }
    return parsed as Partial<GlobalConfig>;
  } catch {
    return {};
  }
}

function sanitizePatch(patch: unknown, base: GlobalConfig): Partial<GlobalConfig> {
  if (!isPlainObject(patch)) {
    return {};
  }

  const out: Partial<GlobalConfig> = {};

  if ('aiFontSize' in patch) out.aiFontSize = toSafeNumber(patch.aiFontSize, base.aiFontSize);
  if ('interviewerFontSize' in patch) out.interviewerFontSize = toSafeNumber(patch.interviewerFontSize, base.interviewerFontSize);
  if ('intervieweeFontSize' in patch) out.intervieweeFontSize = toSafeNumber(patch.intervieweeFontSize, base.intervieweeFontSize);
  if ('userFontSize' in patch) out.userFontSize = toSafeNumber(patch.userFontSize, base.userFontSize);

  if ('scopeCharacter' in patch) out.scopeCharacter = toSafeBoolean(patch.scopeCharacter, base.scopeCharacter);

  if ('showIntervieweeMessages' in patch) out.showIntervieweeMessages = toSafeBoolean(patch.showIntervieweeMessages, base.showIntervieweeMessages);
  if ('gestureEnabled' in patch) out.gestureEnabled = toSafeBoolean(patch.gestureEnabled, base.gestureEnabled);
  if ('bilingualEnable' in patch) out.bilingualEnable = toSafeBoolean(patch.bilingualEnable, base.bilingualEnable);

  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const interviewId = Number(params.id || 0);
    if (!interviewId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'id 参数无效' },
        { status: 400 }
      );
    }

    const interview = await getInterviewById(interviewId, payload.userId);
    if (!interview) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '面试不存在' },
        { status: 404 }
      );
    }

    const parsed = parseConfigJson(interview.default_session_config_json);
    // 白名单字段合并：避免旧字段（如 bgColor）回流到返回值
    const sanitizedParsed = sanitizePatch(parsed, DEFAULT_GLOBAL_CONFIG);
    const sessionConfig: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...sanitizedParsed };

    return NextResponse.json<ApiResponse<{ sessionConfig: GlobalConfig; sessionConfigJson: string | null }>>(
      {
        success: true,
        data: {
          sessionConfig,
          sessionConfigJson: interview.default_session_config_json ? String(interview.default_session_config_json) : null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('获取面试配置失败:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: '获取面试配置失败' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const payload = await authenticateRequest(request);
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      );
    }

    const interviewId = Number(params.id || 0);
    if (!interviewId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'id 参数无效' },
        { status: 400 }
      );
    }

    const interview = await getInterviewById(interviewId, payload.userId);
    if (!interview) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '面试不存在' },
        { status: 404 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '请求数据格式错误' },
        { status: 400 }
      );
    }

    const patch = isPlainObject(body) && 'sessionConfig' in body ? (body as any).sessionConfig : body;

    const existing = parseConfigJson(interview.default_session_config_json);
    const sanitizedExisting = sanitizePatch(existing, DEFAULT_GLOBAL_CONFIG);
    const base: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG, ...sanitizedExisting };
    const sanitized = sanitizePatch(patch, base);
    const merged: GlobalConfig = { ...base, ...sanitized };

    const ok = await updateInterview(interviewId, payload.userId, {
      default_session_config_json: JSON.stringify(merged) as any,
    } as any);

    if (!ok) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '更新失败（无权限或写入失败）' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<{ sessionConfig: GlobalConfig }>>(
      { success: true, data: { sessionConfig: merged } },
      { status: 200 }
    );
  } catch (error) {
    console.error('更新面试配置失败:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: '更新面试配置失败' },
      { status: 500 }
    );
  }
}


