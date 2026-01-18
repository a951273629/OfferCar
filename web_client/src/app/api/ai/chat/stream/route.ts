import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/middleware';
import { getAIClient } from '@/lib/ai/client';
import { ChatMessage, AIProvider } from '@/types/api';
import { nanoid } from 'nanoid';
import { getUserBalance } from '@/lib/db/queries/user';
import { consumePoints } from '@/lib/db/queries/billing';
import { getPointsByMode } from '@/lib/ai/config';

/**
 * 安全地将数据推入流控制器
 */
function safeEnqueue(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: string
): void {
  // 检查 controller 是否已关闭
  if (controller.desiredSize === null) {
    return; // 静默跳过
  }
  
  try {
    controller.enqueue(encoder.encode(data));
  } catch {
    safeClose(controller);
  }
}

/**
 * 安全地关闭流控制器
 */
function safeClose(controller: ReadableStreamDefaultController): void {
  try {
    controller.close();
  } catch {
    // 静默处理
  }
}

/**
 * 处理扣费逻辑
 */
async function handleBilling(
  userId: string,
  requiredPoints: number,
  modelMode: string,
  message: string
): Promise<void> {
  console.log(`[AI Stream] AI 回答完成，开始扣费... (${modelMode} 模式，${requiredPoints} 点)`);
  
  await consumePoints(
    userId,
    requiredPoints,
    'interview_question', // 统一使用 interview_question（面试和笔试通用）
    `AI 问答 (${modelMode.toUpperCase()} 模式): ${message.substring(0, 50)}...`
  );
  
  console.log(`[AI Stream] 扣费成功（${requiredPoints} 点，${modelMode} 模式）`);
}

/**
 * POST /api/ai/chat/stream - AI 对话流式端点（SSE）
 * 
 * 支持特性：
 * - 多 Provider 支持（OpenAI, Gemini）
 * - 60fps 平滑流式输出
 * - 思考模式支持（OpenAI reasoning_content + Gemini <think> 标签）
 * - Token 从 Header 传递（安全）
 * 
 * 请求体示例：
 * {
 *   "message": "用户消息内容",
 *   "context": "系统上下文（可选）",
 *   "provider": "openai" | "gemini"（可选，默认从环境变量读取）
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // ==================== 第一步：验证身份（Better-Auth Session） ====================
    const payload = await authenticateRequest(request);
    if (!payload) {
      console.error('[AI Stream] Session 验证失败');
      return new Response(
        JSON.stringify({ error: '未授权，请先登录' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[AI Stream] 用户认证成功:', { userId: payload.userId, email: payload.email });

    // ==================== 第二步：解析请求体 ====================
    const body = await request.json();
    const { 
      messages: clientMessages, 
      systemPrompt, 
      modelMode = 'general', 
      provider 
    } = body;

    // 验证请求参数
    if (!clientMessages || !Array.isArray(clientMessages) || clientMessages.length === 0) {
      return new Response(
        JSON.stringify({ error: '消息列表不能为空' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // 验证 modelMode
    const validModes = ['general', 'pro', 'max'];
    if (!validModes.includes(modelMode)) {
      return new Response(
        JSON.stringify({ error: '无效的模型模式' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // ==================== 第三步：构建消息列表 ====================
    const messages: ChatMessage[] = [];

    // 添加系统提示（如果有）
    if (systemPrompt) {
      messages.push({
        id: nanoid(),
        role: 'system',
        content: systemPrompt,
        date: new Date().toISOString(),
      });
    }

    // 添加客户端发送的所有历史消息
    messages.push(...clientMessages);

    // 根据模式计算所需点数
    const requiredPoints = getPointsByMode(modelMode as 'general' | 'pro' | 'max');
    
    // 检查是否包含图片消息
    const hasImage = clientMessages.some((msg: ChatMessage) => 
      Array.isArray(msg.content) && msg.content.some(item => item.type === 'image_url')
    );
    
    console.log('[AI Stream] 请求参数:', {
      provider: provider || '默认',
      modelMode,
      requiredPoints,
      totalMessages: messages.length,
      clientMessages: clientMessages.length,
      hasSystemPrompt: !!systemPrompt,
      systemPromptLength: systemPrompt ? systemPrompt.length : 0,
      hasImage,
    });

    // ==================== 第四步：检查用户余额 ====================
    try {
      const balance = await getUserBalance(payload.userId);
      console.log(`[AI Stream] 用户余额: ${balance} 点，需要: ${requiredPoints} 点 (${modelMode} 模式)`);
      
      if (balance < requiredPoints) {
        console.warn(`[AI Stream] 余额不足: 当前 ${balance} 点，需要 ${requiredPoints} 点 (${modelMode} 模式)`);
        return new Response(
          JSON.stringify({ 
            error: `余额不足，请先充值（${modelMode.toUpperCase()} 模式需要 ${requiredPoints} 点，当前余额 ${balance} 点）` 
          }),
          {
            status: 402, // 402 Payment Required
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    } catch (error) {
      console.error('[AI Stream] 查询余额失败:', error);
      return new Response(
        JSON.stringify({ error: '查询余额失败' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // ==================== 第五步：创建 SSE 响应流 ====================
    const encoder = new TextEncoder();
    let providerController: AbortController | null = null;
    
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 获取 AI 客户端
          const aiClient = getAIClient(provider as AIProvider);

          // 调用流式 API
          await aiClient.chat({
            messages,
            config: {
              model: '', // 使用默认模型
              provider: provider as AIProvider,
              modelMode: modelMode as 'general' | 'pro' | 'max', // 传递模型模式
              stream: true,
            },
            modelMode: modelMode as 'general' | 'pro' | 'max', // 同时在顶层传递

            // 接收 Provider 的 AbortController（用于级联中止）
            onController: (ctrl) => {
              providerController = ctrl;
            },

            // 流式更新回调（服务器端直接转发）
            onUpdate(chunk: string) {
              const data = `data: ${JSON.stringify({
                type: 'chunk',
                content: chunk,
                isComplete: false,  // 标记未完成
              })}\n\n`;
              safeEnqueue(controller, encoder, data);
            },

            // 完成回调
            async onFinish(message: string) {
              // 检查 controller 是否已关闭（Early Return）
              if (controller.desiredSize === null) {
                return; // 静默跳过
              }
              
              // 扣费逻辑（根据模式扣除相应点数）
              try {
                await handleBilling(payload.userId, requiredPoints, modelMode, message);
              } catch (error) {
                console.error('[AI Stream] 扣费失败:', error);
                // 扣费失败不影响 AI 回答的返回（已经生成了答案）
              }
              
              const doneData = `data: ${JSON.stringify({
                type: 'done',
                content: message,
                isComplete: true,  // 标记已完成
              })}\n\n`;
              safeEnqueue(controller, encoder, doneData);
              safeClose(controller);
            },

            // 错误回调
            onError(error: Error) {
              console.error('[AI Stream] 错误:', error);
              
              // 检查 controller 是否已关闭（Early Return）
              if (controller.desiredSize === null) {
                return; // 静默跳过
              }
              
              const errorData = `data: ${JSON.stringify({
                type: 'error',
                content: error.message,
              })}\n\n`;
              safeEnqueue(controller, encoder, errorData);
              safeClose(controller);
            },
          });
        } catch (error) {
          console.error('[AI Stream] 处理错误:', error);
          
          // 检查 controller 是否已关闭
          if (controller.desiredSize === null) {
            return;
          }
          
          const errorData = `data: ${JSON.stringify({
            type: 'error',
            content: error instanceof Error ? error.message : 'AI 服务暂时不可用',
          })}\n\n`;
          safeEnqueue(controller, encoder, errorData);
          safeClose(controller);
        }
      },
      
      // 客户端断开连接时调用（级联中止 AI API 请求）
      cancel() {
        console.log('[AI Stream] 客户端断开连接，中止 AI API 请求');
        if (providerController) {
          providerController.abort();
        }
      },
    });

    // ==================== 第六步：返回 SSE 响应 ====================
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
      },
    });
  } catch (error) {
    console.error('[AI Stream] 路由错误:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'AI 对话失败',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET /api/ai/chat/stream - 兼容旧的 GET 请求
 * 
 * @deprecated 请使用 POST 请求，GET 仅用于向后兼容
 * 
 * URL 参数：
 * - message: 用户消息
 * - context: 系统上下文（可选）
 * - provider: AI Provider（可选）
 * 
 * 认证：自动从 Cookie 读取（无需传递 token 参数）
 */
export async function GET(request: NextRequest) {
  console.warn('[AI Stream] 使用了已弃用的 GET 请求，请迁移到 POST');

  const searchParams = request.nextUrl.searchParams;
  const message = searchParams.get('message');
  const context = searchParams.get('context');
  const provider = searchParams.get('provider');

  // 构造 POST 请求格式（认证信息从 Cookie 自动读取）
  const mockRequest = new Request(request.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': request.headers.get('Cookie') || '',  // 传递 Cookie
    },
    body: JSON.stringify({ message, context, provider }),
  });

  // 转发到 POST 处理
  return POST(mockRequest as NextRequest);
}
