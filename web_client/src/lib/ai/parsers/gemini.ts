// Gemini SSE 解析器（增强版 - 检查 finishReason）

/**
 * 解析 Gemini 的 SSE 数据格式
 * 
 * 支持特性：
 * - 标准 parts.text 字段
 * - <think> 标签保持原样（客户端负责解析）
 * - finishReason 检查和警告
 * 
 * SSE 数据格式示例：
 * {
 *   "candidates": [{
 *     "content": {
 *       "parts": [{ "text": "回复内容" }]
 *     },
 *     "finishReason": "STOP" | "MAX_TOKENS" | "SAFETY" | ...
 *   }]
 * }
 * 
 * @param text - SSE 数据字符串
 * @returns 解析后的文本内容
 */
export function parseGeminiSSE(text: string): string {
  try {
    const json = JSON.parse(text);
    
    // 提取 candidates
    const candidates = json?.candidates;
    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return '';
    }

    const candidate = candidates[0];

    // 🔍 检查 finishReason（如果存在）
    const finishReason = candidate?.finishReason;
    if (finishReason) {
      console.warn('[Gemini Parser] 生成结束，原因:', finishReason);
      
    }

    // 提取 text 内容
    const parts = candidate?.content?.parts;
    if (!parts || !Array.isArray(parts)) {
      return '';
    }

    // 拼接所有 parts 的 text
    const content = parts
      .map((part: { text?: string }) => part.text || '')
      .filter((text: string) => text.trim() !== '')
      .join('\n\n');

    return content;
  } catch (e) {
    console.error('[Gemini Parser] 解析失败:', e, '原始数据:', text);
    throw new Error(`Gemini SSE 解析失败: ${e instanceof Error ? e.message : '未知错误'}`);
  }
}
