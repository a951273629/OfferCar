/**
 * <think> 标签处理器
 * 用于处理 AI 响应中的思考内容标签
 */

// 跟踪 <think> 标签状态（模块级别，跨渲染保持）
let isInThinkTag = false;

/**
 * 当前是否处于 <think> 标签内部（模块级状态）
 * 用于在流式渲染中判断是否需要对 UI 更新做 60fps 节流。
 */
export function isThinkTagActive(): boolean {
  return isInThinkTag;
}

/**
 * 处理 <think> 标签（客户端解析）
 * 
 * 规则：
 * - <think> 开始 → 转换为 "> "（Markdown 引用格式）
 * - </think> 结束 → 换行
 * - 标签内的换行符需要保持引用格式
 * 
 * @param content - 原始内容（可能包含 <think> 标签）
 * @returns 格式化后的内容
 * 
 * @example
 * processThinkTags('<think>分析中...</think>结论') 
 * // 返回: '\n> 分析中...\n\n结论'
 */
export function processThinkTags(content: string): string {
  let result = '';
  let i = 0;
  
  while (i < content.length) {
    // 检测 <think> 标签
    if (content.substring(i, i + 7) === '<think>') {
      isInThinkTag = true;
      result += '\n> ';  // 开始引用格式
      i += 7;
      continue;
    }
    
    // 检测 </think> 标签
    if (content.substring(i, i + 8) === '</think>') {
      isInThinkTag = false;
      result += '\n\n';  // 结束引用，换行
      i += 8;
      continue;
    }
    
    // 普通字符
    const char = content[i];
    
    // 如果在 <think> 标签内，换行符需要特殊处理
    if (isInThinkTag && char === '\n') {
      // 检查是否为双换行（段落分隔）
      if (content[i + 1] === '\n') {
        result += '\n\n> ';  // 段落分隔，保持引用格式
        i += 2;
        continue;
      } else {
        result += '\n> ';  // 单换行，保持引用格式
        i += 1;
        continue;
      }
    }
    
    result += char;
    i += 1;
  }
  
  return result;
}

/**
 * 重置 <think> 标签状态
 * 用于测试或组件卸载时清理状态
 */
export function resetThinkTagState(): void {
  isInThinkTag = false;
}

