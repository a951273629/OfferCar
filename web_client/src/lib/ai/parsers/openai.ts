// OpenAI SSE 解析器（增强版 - 检查 finish_reason）

/**
 * 解析 OpenAI 的 SSE 数据格式
 * 
 * 支持特性：
 * - 标准 content 字段
 * - reasoning_content 字段（o1 系列模型的思考内容）
 * - finish_reason 检查和警告
 * 
 * SSE 数据格式示例：
 * {
 *   "choices": [{
 *     "delta": {
 *       "content": "正常回复内容",
 *       "reasoning_content": "推理思考内容"
 *     },
 *     "finish_reason": "stop" | "length" | "content_filter" | ...
 *   }]
 * }
 * 
 * @param text - SSE 数据字符串
 * @returns 解析后的文本内容
 */
export function parseOpenAISSE(text: string): string {
  try {
    const json = JSON.parse(text);
    const choices = json.choices as Array<{
      delta: {
        content?: string;
        reasoning_content?: string | null;
      };
      finish_reason?: string | null;
    }>;

    if (!choices || choices.length === 0) {
      return '';
    }

    const choice = choices[0];

    // 🔍 检查 finish_reason（如果存在）
    if (choice?.finish_reason) {
      console.warn('[OpenAI Parser] 生成结束，原因:', choice.finish_reason);
      
    }

    const delta = choice?.delta;
    const reasoning = delta?.reasoning_content;
    const content = delta?.content;

    // 优先返回 reasoning_content（思考内容）
    // 客户端会自动将其格式化为引用格式（> 思考内容）
    if (reasoning && reasoning.length > 0) {
      return reasoning;
    }

    // 返回正常 content
    if (content && content.length > 0) {
      return content;
    }

    // 两者都为空
    return '';
  } catch (e) {
    console.error('[OpenAI Parser] 解析失败:', e, '原始数据:', text);
    throw new Error(`OpenAI SSE 解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}
