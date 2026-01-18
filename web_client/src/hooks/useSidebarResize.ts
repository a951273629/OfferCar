import { useState, useRef, useEffect } from 'react';

export interface UseSidebarResizeOptions {
  isMobile: boolean;
  initialWidth?: number;
  collapsedWidth?: number;
  minWidth?: number;
  maxWidth?: number;
}

export interface UseSidebarResizeResult {
  sidebarWidth: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleSidebarClick: () => void;
  collapseSidebar: () => void;
}

/**
 * 自定义 Hook：侧边栏拖动调整大小
 * 支持拖动调整、折叠/展开、移动端检测
 * 
 * @param options - 配置选项
 * @returns 侧边栏状态和操作函数
 */
export function useSidebarResize(options: UseSidebarResizeOptions): UseSidebarResizeResult {
  const {
    isMobile,
    initialWidth = 320,
    collapsedWidth = 30,
    minWidth = 200,
    maxWidth = 600
  } = options;

  const [sidebarWidth, setSidebarWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // 拖动开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return;
    setIsResizing(true);
    resizeRef.current = {
      startX: e.clientX,
      startWidth: sidebarWidth,
    };
    e.preventDefault();
  };

  // 点击折叠的侧边栏展开
  const handleSidebarClick = () => {
    if (sidebarWidth === collapsedWidth) {
      setSidebarWidth(initialWidth);
    }
  };

  // 折叠侧边栏
  const collapseSidebar = () => {
    setSidebarWidth(collapsedWidth);
  };

  // 拖动进行中
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;

      const delta = e.clientX - resizeRef.current.startX;
      let newWidth = resizeRef.current.startWidth + delta;

      // 限制最小和最大宽度
      if (newWidth < minWidth) {
        newWidth = collapsedWidth; // 吸附到折叠状态
      } else if (newWidth < minWidth) {
        newWidth = minWidth; // 最小可用宽度
      } else if (newWidth > maxWidth) {
        newWidth = maxWidth; // 最大宽度
      }

      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, collapsedWidth, minWidth, maxWidth]);

  return {
    sidebarWidth,
    isResizing,
    handleMouseDown,
    handleSidebarClick,
    collapseSidebar,
  };
}

