'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Space, Spin, Typography, theme } from 'antd';
import { BookOutlined } from '@ant-design/icons';
import { KnowledgeList } from '@/components/knowledge/KnowledgeList';
import { KnowledgePreview } from '@/components/knowledge/KnowledgePreview';
import { useExamKnowledgeBases, useInterviewKnowledgeBases } from '@/hooks/useKnowledge';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import type { KnowledgeBase } from '@/types';

const { Text } = Typography;

type SessionType = 'exam' | 'interview';

interface KnowledgeAssistiveTouchProps {
  sessionType: SessionType;
  ownerId: number;
  isRequesting: boolean;
  bottomSafe: number;
}

interface FloatPos {
  left: number;
  top: number;
}

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function toRgba(color: string, alpha: number) {
  // 仅做轻量处理：支持 #RGB/#RRGGBB 与 rgb/rgba；其它格式直接回退透明
  const a = clamp(alpha, 0, 1);
  if (color.startsWith('#')) {
    const hex = color.replace('#', '').trim();
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
  }

  const rgbMatch = color
    .replace(/\s+/g, '')
    .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([\d.]+))?\)$/i);
  if (rgbMatch) {
    const r = Number(rgbMatch[1] || 0);
    const g = Number(rgbMatch[2] || 0);
    const b = Number(rgbMatch[3] || 0);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  return `rgba(0, 0, 0, ${a})`;
}

export function KnowledgeAssistiveTouch({
  sessionType,
  ownerId,
  isRequesting,
  bottomSafe,
}: KnowledgeAssistiveTouchProps) {
  const { token } = theme.useToken();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // Hooks 必须保持稳定调用：用参数开关，而不是条件调用
  const { knowledgeBases: examKbs, isLoading: examLoading } = useExamKnowledgeBases(
    sessionType === 'exam' ? ownerId : null
  );
  const { knowledgeBases: interviewKbs, isLoading: interviewLoading } = useInterviewKnowledgeBases(
    sessionType === 'interview' ? ownerId : null
  );

  const { knowledgeBases, loading } = useMemo(() => {
    if (sessionType === 'exam') {
      return { knowledgeBases: examKbs, loading: examLoading };
    }
    return { knowledgeBases: interviewKbs, loading: interviewLoading };
  }, [examKbs, examLoading, interviewKbs, interviewLoading, sessionType]);

  const [listOpen, setListOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selectedKnowledge: KnowledgeBase | null = useMemo(() => {
    if (!previewOpen || !selectedId) return null;
    return knowledgeBases.find((kb) => kb.id === selectedId) || null;
  }, [knowledgeBases, previewOpen, selectedId]);

  const size = isMobile ? 46 : 54; // 圆形按钮直径（移动端更小）
  const edgePadding = 10;
  const topSafe = 72;

  const [pos, setPos] = useState<FloatPos>({ left: 0, top: 0 });

  const dragRef = useRef<{
    active: boolean;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    startLeft: number;
    startTop: number;
    moved: boolean;
  } | null>(null);

  // 解决“拖拽结束后 click 仍触发打开 Modal”的误触
  const lastDragMovedRef = useRef(false);

  const prevRequestingRef = useRef<boolean>(false);

  const calcSnapLeft = (nextLeft: number) => {
    const width = window.innerWidth || 0;
    const centerX = nextLeft + size / 2;
    const isLeftSide = centerX <= width / 2;
    return isLeftSide ? edgePadding : Math.max(edgePadding, width - size - edgePadding);
  };

  const clampTop = (nextTop: number) => {
    const height = window.innerHeight || 0;
    const minTop = topSafe;
    const maxTop = Math.max(minTop, height - bottomSafe - size);
    return clamp(nextTop, minTop, maxTop);
  };

  const clampLeft = (nextLeft: number) => {
    const width = window.innerWidth || 0;
    const minLeft = edgePadding;
    const maxLeft = Math.max(minLeft, width - size - edgePadding);
    return clamp(nextLeft, minLeft, maxLeft);
  };

  useEffect(() => {
    // 初始定位：默认靠右、垂直居中
    if (typeof window === 'undefined') return;
    const width = window.innerWidth || 0;
    const height = window.innerHeight || 0;
    const initLeft = Math.max(edgePadding, width - size - edgePadding);
    const initTop = clampTop(Math.round(height / 2 - size / 2));
    setPos({ left: initLeft, top: initTop });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 触发快答时（false -> true），立即关闭两个 Modal
    const was = prevRequestingRef.current;
    if (!was && isRequesting) {
      setPreviewOpen(false);
      setSelectedId(null);
      setListOpen(false);
    }
    prevRequestingRef.current = isRequesting;
  }, [isRequesting]);

  useEffect(() => {
    // 视口变化时：保持贴边并限制范围
    const handleResize = () => {
      setPos((prev) => {
        const nextTop = clampTop(prev.top);
        const nextLeft = clampLeft(prev.left);
        // 仍保持吸附
        const snappedLeft = calcSnapLeft(nextLeft);
        return { left: snappedLeft, top: nextTop };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [bottomSafe, size]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }
    const current = e.currentTarget;
    const rect = current.getBoundingClientRect();

    lastDragMovedRef.current = false;
    dragRef.current = {
      active: true,
      pointerId: e.pointerId,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startLeft: pos.left,
      startTop: pos.top,
      moved: false,
    };

    try {
      current.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !drag.active || drag.pointerId !== e.pointerId) return;

    const nextLeft = clampLeft(e.clientX - drag.offsetX);
    const nextTop = clampTop(e.clientY - drag.offsetY);

    // 标记是否发生拖动，用于阻止拖动后 click 打开 Modal
    if (!drag.moved) {
      const dx = Math.abs(nextLeft - drag.startLeft);
      const dy = Math.abs(nextTop - drag.startTop);
      if (dx + dy > 6) {
        drag.moved = true;
      }
    }

    setPos({ left: nextLeft, top: nextTop });
  };

  const endDrag = (pointerId: number) => {
    const drag = dragRef.current;
    if (!drag || !drag.active || drag.pointerId !== pointerId) return;
    lastDragMovedRef.current = drag.moved;
    dragRef.current = null;

    setPos((prev) => {
      const snappedLeft = calcSnapLeft(prev.left);
      const nextTop = clampTop(prev.top);
      return { left: snappedLeft, top: nextTop };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    endDrag(e.pointerId);
  };

  const handleClick = () => {
    if (lastDragMovedRef.current) {
      // click 紧随 pointerup：此时认为是一次拖拽结束，不打开
      lastDragMovedRef.current = false;
      return;
    }
    if (listOpen || previewOpen) {
      setPreviewOpen(false);
      setSelectedId(null);
      setListOpen(false);
      return;
    }
    setListOpen(true);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          left: pos.left,
          top: pos.top,
          width: size,
          height: size,
          borderRadius: '50%',
          zIndex: 1200,
          background: toRgba(token.colorPrimary, 0.18),
          // border: `1px solid ${toRgba(token.colorPrimary, 0.28)}`,
          boxShadow: token.boxShadow,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          touchAction: 'none',
          backdropFilter: 'blur(6px)',
          cursor: 'pointer',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={handleClick}
        aria-label="知识库悬浮按钮"
      >
        <BookOutlined style={{ fontSize: isMobile ? 20 : 22, color: token.colorPrimary }} />
      </div>

      {/* 列表 Modal（保持打开，预览 Modal 盖在上面） */}
      <Modal
        title=""
        open={listOpen}
        onCancel={() => {
          setListOpen(false);
          setPreviewOpen(false);
          setSelectedId(null);
        }}
        footer={null}
        width={900}
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <Spin size="large" tip="加载中..." />
          </div>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Text type="secondary">
              点击条目可预览；触发快答（Ctrl + Shift + 回车）或者点击悬浮窗 会自动关闭。
            </Text>
            <KnowledgeList
              knowledgeBases={knowledgeBases}
              loading={false}
              onView={(id) => {
                setSelectedId(id);
                setPreviewOpen(true);
              }}
              showActions={false}
            />
          </Space>
        )}
      </Modal>

      <KnowledgePreview
        knowledge={selectedKnowledge}
        open={previewOpen}
        onClose={() => {
          setPreviewOpen(false);
          setSelectedId(null);
        }}
      />
    </>
  );
}


