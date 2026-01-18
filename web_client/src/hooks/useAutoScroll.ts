import { useRef, useState, useCallback, useEffect } from 'react';
import { throttle } from 'lodash';

export interface UseAutoScrollOptions {
  // 无需 dependencies 参数
}

export interface UseAutoScrollResult {
  messagesEndRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: () => void;
  manualScroll: (direction: 'up' | 'down') => void;
  scrollToBottomIfNeeded: (force?: boolean) => void;
  enableAutoScroll: () => void;
}

/**
 * 自定义 Hook：智能消息滚动
 * - 仅在 AI 消息或流式输出时自动滚动
 * - 用户手动翻页后暂停自动滚动
 * 
 * @param options - 配置选项
 * @returns 滚动相关的 Ref 和函数
 */
export function useAutoScroll(options: UseAutoScrollOptions = {}): UseAutoScrollResult {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 自动滚动开关（默认开启）
  const [autoScrollEnabled, setAutoScrollEnabled] = useState<boolean>(true);
  const autoScrollEnabledRef = useRef<boolean>(true);

  // 同步 ref，供事件回调读取最新状态
  useEffect(() => {
    autoScrollEnabledRef.current = autoScrollEnabled;
  }, [autoScrollEnabled]);

  // 用户手动滚动（鼠标滚轮/触摸拖动）时禁用自动滚动
  useEffect(() => {
    let rafId: number | null = null;
    let cleanupFn: (() => void) | null = null;

    const disableAutoScroll = () => {
      if (!autoScrollEnabledRef.current) {
        return;
      }
      setAutoScrollEnabled(false);
      console.log('[useAutoScroll] 用户手动滚动，已禁用自动滚动');
    };

    const tryBind = () => {
      const endEl = messagesEndRef.current;
      const scrollContainer = endEl?.closest('.ant-card') as HTMLElement | null;
      if (!scrollContainer) {
        rafId = requestAnimationFrame(tryBind);
        return;
      }

      // 仅监听“用户输入”相关事件，避免程序性 scroll 误触发
      const onWheel = () => disableAutoScroll();
      const onTouchMove = () => disableAutoScroll();

      scrollContainer.addEventListener('wheel', onWheel, { passive: true });
      scrollContainer.addEventListener('touchmove', onTouchMove, { passive: true });

      cleanupFn = () => {
        scrollContainer.removeEventListener('wheel', onWheel);
        scrollContainer.removeEventListener('touchmove', onTouchMove);
      };
    };

    tryBind();

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      }
    };
  }, []);

  // 使用 useRef 存储节流函数实例
  const throttledScrollToBottomRef = useRef(
    throttle(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 80, { leading: true, trailing: true })
  );

  // 滚动到底部（强制，带节流）
  const scrollToBottom = useCallback(() => {
    // console.log('[scrollToBottom] 开始执行', {
    //   refExists: !!messagesEndRef.current,
    //   refElement: messagesEndRef.current?.tagName,
    // });
    throttledScrollToBottomRef.current();
  }, []);

  // 根据自动滚动状态决定是否滚动
  const scrollToBottomIfNeeded = useCallback((force: boolean = false) => {
    if (!force) {
      if (!autoScrollEnabled) {
        return;
      }
    }
    scrollToBottom();
  }, [autoScrollEnabled, scrollToBottom]);

  // 使用 useRef 存储节流后的手动滚动函数实例
  const throttledManualScrollRef = useRef(
    throttle((direction: 'up' | 'down') => {
      // console.log('[manualScroll] 开始执行', { direction });
      
      if (!messagesEndRef.current) {
        console.log('[manualScroll] messagesEndRef.current 不存在');
        return;
      }

      // 使用 closest 直接定位滚动容器（ant-card）
      const scrollContainer = messagesEndRef.current.closest('.ant-card') as HTMLElement | null;
      
      if (!scrollContainer) {
        console.log('[manualScroll] 未找到滚动容器 (.ant-card)');
        return;
      }

      // console.log('[manualScroll] 找到滚动容器', {
      //   tagName: scrollContainer.tagName,
      //   className: scrollContainer.className,
      // });

      // 计算半屏高度
      const scrollHeight = scrollContainer.clientHeight / 3.5;
      
      // 滚动
      const currentScrollTop = scrollContainer.scrollTop;
      const targetScrollTop = direction === 'up'
        ? Math.max(0, currentScrollTop - scrollHeight)
        : currentScrollTop + scrollHeight;
      
      // console.log('[manualScroll] 执行滚动', {
      //   currentScrollTop,
      //   targetScrollTop,
      //   scrollHeight,
      //   direction,
      // });
      
      scrollContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });

      // 手动翻页后，禁用自动滚动
      setAutoScrollEnabled(false);
      console.log('[manualScroll] 已禁用自动滚动');
    }, 300, { leading: true, trailing: true })
  );

  // 手动滚动（向上/下翻页，带节流）
  const manualScroll = useCallback((direction: 'up' | 'down') => {
    throttledManualScrollRef.current(direction);
  }, []);

  // 手动恢复自动滚动（在发送消息时调用）
  const enableAutoScroll = useCallback(() => {
    console.log('[enableAutoScroll] 恢复自动滚动');
    setAutoScrollEnabled(true);
  }, []);

  return {
    messagesEndRef,
    scrollToBottom,
    manualScroll,
    scrollToBottomIfNeeded,
    enableAutoScroll,
  };
}

