import { useState, useEffect } from 'react';

/**
 * 自定义 Hook：检测媒体查询
 * @param query - CSS 媒体查询字符串，例如 '(max-width: 768px)'
 * @returns boolean - 是否匹配媒体查询
 */
export function useMediaQuery(query: string): boolean {
  // 服务端渲染时默认返回 false
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    // 服务端渲染时跳过
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    
    // 更新状态
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      setMatches(event.matches);
    };

    // 初始化检查
    handleChange(mediaQuery);

    // 监听变化
    mediaQuery.addEventListener('change', handleChange);

    // 清理监听器
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

