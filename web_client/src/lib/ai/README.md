# AI 客户端架构文档

## 📋 概述

这是一个统一的 AI 客户端架构，支持多个 AI Provider（OpenAI、Gemini），提供流式输出和思考模式支持。

## 🚀 核心特性

- **60fps 流式输出**：使用 `requestAnimationFrame` 实现丝滑的文本渲染
- **思考模式支持**：
  - OpenAI：自动识别 `reasoning_content` 字段（o1 系列模型）
  - Gemini：自动识别 `<think>` 标签
- **Provider 抽象层**：易于扩展新的 AI 服务商
- **统一 API 接口**：所有 Provider 使用相同的调用方式
- **TypeScript 支持**：完整的类型定义

## 📦 项目结构

```
src/lib/ai/
├── base.ts                # LLMApi 抽象基类
├── client.ts              # Provider 工厂函数和导出
├── config.ts              # 环境变量配置管理
├── stream.ts              # 核心流式处理逻辑（60fps 动画）
├── parsers/
│   ├── openai.ts          # OpenAI SSE 解析器
│   └── gemini.ts          # Gemini SSE 解析器
└── providers/
    ├── openai.ts          # OpenAI 客户端实现
    └── gemini.ts          # Gemini 客户端实现

src/hooks/
└── useAIChat.ts           # React Hook 封装

src/types/
└── api.ts                 # 类型定义
```

## 🔧 环境变量配置

创建 `.env.local` 文件并添加以下配置：

```bash
# 默认 Provider（可选: openai | gemini）
AI_PROVIDER=gemini

# OpenAI 配置
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_API_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini

# Gemini 配置
GEMINI_API_KEY=your-gemini-api-key
GEMINI_API_URL=https://generativelanguage.googleapis.com/v1
GEMINI_MODEL=gemini-2.0-flash-exp

# 向后兼容（优先级低）
AI_API_KEY=your-api-key
AI_API_URL=https://generativelanguage.googleapis.com/v1
```

## 📖 使用示例

### 1. 基础用法（直接调用）

```typescript
import { sendChatRequest } from '@/lib/ai/client';
import { AIProvider } from '@/types/api';
import { nanoid } from 'nanoid';

await sendChatRequest({
  messages: [
    {
      id: nanoid(),
      role: 'user',
      content: 'Hello, AI!',
      date: new Date().toISOString(),
    }
  ],
  config: {
    provider: AIProvider.Gemini,
    stream: true,
  },
  onUpdate: (message, chunk) => {
    console.log('Chunk:', chunk);
  },
  onFinish: (message) => {
    console.log('Done:', message);
  },
  onError: (err) => {
    console.error('Error:', err);
  },
});
```

### 2. 使用 React Hook

```typescript
import { useAIChat } from '@/hooks/useAIChat';
import { AIProvider } from '@/types/api';

function ChatComponent() {
  const { sendMessage, isStreaming, streamingContent } = useAIChat();

  const handleSend = async () => {
    const response = await sendMessage(
      'Hello, AI!',
      '你是一位专业的助手',
      AIProvider.OpenAI
    );
    
    if (response) {
      console.log('AI 回复:', response.content);
    }
  };

  return (
    <div>
      <button onClick={handleSend} disabled={isStreaming}>
        发送消息
      </button>
      {isStreaming && <div>{streamingContent}</div>}
    </div>
  );
}
```

### 3. 在 API 路由中使用

```typescript
// app/api/custom-chat/route.ts
import { getAIClient } from '@/lib/ai/client';
import { AIProvider, ChatMessage } from '@/types/api';
import { nanoid } from 'nanoid';

export async function POST(request: Request) {
  const { message } = await request.json();
  
  const client = getAIClient(AIProvider.OpenAI);
  
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      await client.chat({
        messages: [{
          id: nanoid(),
          role: 'user',
          content: message,
          date: new Date().toISOString(),
        }],
        config: { stream: true },
        onUpdate: (msg, chunk) => {
          const data = `data: ${JSON.stringify({ chunk })}\n\n`;
          controller.enqueue(encoder.encode(data));
        },
        onFinish: (msg) => {
          controller.close();
        },
        onError: (err) => {
          console.error(err);
          controller.close();
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

## 🔌 扩展新 Provider

如需添加新的 AI Provider（如 Claude、PaLM 等），请按以下步骤操作：

### 步骤 1：添加 Provider 枚举

```typescript
// src/types/api.ts
export enum AIProvider {
  OpenAI = 'openai',
  Gemini = 'gemini',
}
```

### 步骤 2：添加配置

```typescript
// src/lib/ai/config.ts
export interface AIConfig {
  provider: AIProvider;
  openai: { ... };
  gemini: { ... };
  claude: {  // 新增
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

export function getAIConfig(): AIConfig {
  return {
    // ... existing code ...
    claude: {
      apiKey: process.env.CLAUDE_API_KEY || '',
      baseUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com',
      model: process.env.CLAUDE_MODEL || 'claude-3-sonnet',
    },
  };
}
```

### 步骤 3：创建 SSE 解析器

```typescript
// src/lib/ai/parsers/claude.ts
import { SSEParseResult } from '../stream';

export function parseClaudeSSE(text: string): SSEParseResult {
  // 实现 Claude 的 SSE 解析逻辑
  const json = JSON.parse(text);
  return {
    isThinking: false,
    content: json.delta?.text || '',
  };
}
```

### 步骤 4：创建 Provider 实现

```typescript
// src/lib/ai/providers/claude.ts
import { LLMApi } from '../base';  // 从 base.ts 导入
import { ChatOptions } from '@/types/api';
import { getAIConfig } from '../config';
import { streamWithThink } from '../stream';
import { parseClaudeSSE } from '../parsers/claude';

export class ClaudeClient extends LLMApi {
  async chat(options: ChatOptions): Promise<void> {
    const config = getAIConfig();
    const { apiKey, baseUrl, model } = config.claude;

    // 转换消息格式
    const messages = options.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // 构建请求
    const requestPayload = {
      model,
      messages,
      stream: true,
    };

    const controller = new AbortController();
    options.onController?.(controller);

    await streamWithThink(
      `${baseUrl}/v1/messages`,
      requestPayload,
      {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      controller,
      parseClaudeSSE,
      options
    );
  }
}
```

### 步骤 5：注册到工厂函数

```typescript
// src/lib/ai/client.ts
export function getAIClient(provider?: AIProvider): LLMApi {
  // ... existing code ...
  switch (actualProvider) {
    case AIProvider.OpenAI:
      return new OpenAIClient();
    case AIProvider.Gemini:
      return new GeminiClient();
    case AIProvider.Claude:  // 新增
      const { ClaudeClient } = require('./providers/claude');
      return new ClaudeClient();
    default:
      throw new Error(`不支持的 AI Provider: ${actualProvider}`);
  }
}
```

## 🎯 核心原理

### 60fps 流式动画

位于 `src/lib/ai/stream.ts` 的 `animateResponseText()` 函数：

```typescript
function animateResponseText() {
  if (remainText.length > 0) {
    // 每帧渲染剩余文本的 1/60，实现 60fps 平滑动画
    const fetchCount = Math.max(1, Math.round(remainText.length / 60));
    const fetchText = remainText.slice(0, fetchCount);
    responseText += fetchText;
    remainText = remainText.slice(fetchCount);
    options.onUpdate?.(responseText, fetchText);
  }
  requestAnimationFrame(animateResponseText);
}
```

### 思考模式识别

- **OpenAI**：通过 `reasoning_content` 字段识别（o1 模型）
- **Gemini**：通过 `<think>` 标签识别

思考内容以引用格式显示（`> 思考内容`）。

### SSE 连接管理

使用 `@fortaine/fetch-event-source` 库：
- 自动重连
- 错误处理
- 超时控制（60 秒）

## 🐛 故障排查

### 1. 连接失败

**问题**：`AI 服务暂时不可用`

**解决方案**：
- 检查环境变量是否配置正确
- 验证 API Key 是否有效
- 检查网络连接和防火墙设置

### 2. 流式输出卡顿

**问题**：文本显示不流畅

**解决方案**：
- 确认后端正确实现了 `streamWithThink` 函数
- 检查前端是否正确解析 SSE 数据
- 使用浏览器开发者工具查看网络请求

### 3. 思考模式不显示

**问题**：OpenAI o1 模型的思考内容未显示

**解决方案**：
- 确认使用的是 o1 系列模型（如 `o1-preview`）
- 检查 `parseOpenAISSE` 是否正确解析 `reasoning_content`
- 验证 `streamWithThink` 的思考模式逻辑

## 📊 性能优化

1. **减少重复渲染**：
   - 使用 `React.memo` 包装消息组件
   - 避免在渲染函数中创建新对象

2. **懒加载 Provider**：
   - 使用动态 `require()` 导入 Provider
   - 避免打包未使用的 Provider 代码

3. **流式缓冲**：
   - `remainText` 缓冲区平滑输出
   - 避免频繁的 DOM 更新

## 📝 更新日志

### v1.0.0 (2024-01-xx)
- ✅ 初始版本
- ✅ 支持 OpenAI 和 Gemini
- ✅ 60fps 流式动画
- ✅ 思考模式支持
- ✅ Provider 抽象层
- ✅ React Hook 封装

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

