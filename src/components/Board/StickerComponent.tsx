import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Sticker } from '../../types/board';

const DRAG_THROTTLE_MS = 50;
const MIN_SIZE = 32;
const BASE_FONT_SIZE = 48;
const BASE_SIZE = 56;

interface StickerComponentProps {
  sticker: Sticker;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  dragOffset?: { x: number; y: number };
}

export function StickerComponent({ sticker, onDragMove, onDragEnd, onDelete, onClick, onResize, dragOffset }: StickerComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(sticker.width);
  const [localHeight, setLocalHeight] = useState(sticker.height);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(sticker.width);
      setLocalHeight(sticker.height);
    }
  }, [sticker.width, sticker.height, isResizing]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(sticker.id, e.target.x(), e.target.y());
    },
    [sticker.id, onDragMove]
  );

  // Scale emoji font size proportionally
  const fontSize = (localWidth / BASE_SIZE) * BASE_FONT_SIZE;

  return (
    <Group
      x={sticker.x + (dragOffset?.x ?? 0)}
      y={sticker.y + (dragOffset?.y ?? 0)}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(sticker.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(sticker.id)}
      onTap={() => onClick?.(sticker.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grab';
      }}
      onMouseLeave={(e) => {
        setIsMouseHovered(false);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      {/* Hit area with subtle background glow */}
      <Rect
        width={localWidth + 8}
        height={localHeight + 8}
        x={-4}
        y={-4}
        fill={isMouseHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)'}
        cornerRadius={12}
        shadowColor="rgba(0,0,0,0.08)"
        shadowBlur={isMouseHovered ? 14 : 8}
        shadowOffsetY={2}
      />
      <Text
        text={sticker.emoji}
        fontSize={fontSize}
        listening={false}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={4}
        shadowOffsetY={2}
      />
      {/* Delete button */}
      <Rect
        x={localWidth - 14}
        y={-2}
        width={18}
        height={18}
        fill={isDeleteHovered ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.06)'}
        cornerRadius={5}
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(sticker.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(sticker.id);
        }}
        onMouseEnter={(e) => {
          setIsDeleteHovered(true);
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          setIsDeleteHovered(false);
          const stage = e.target.getStage();
          if (stage) stage.container().style.cursor = 'grab';
        }}
      />
      <Text
        x={localWidth - 10}
        y={0}
        text={'\u00d7'}
        fontSize={14}
        fontStyle="bold"
        fill={isDeleteHovered ? '#ef4444' : '#666'}
        listening={false}
      />
      {/* Resize handle */}
      {onResize && (
        <Rect
          x={localWidth - 6}
          y={localHeight - 6}
          width={12}
          height={12}
          fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
          opacity={isResizeHovered ? 1 : 0.4}
          cornerRadius={2}
          draggable
          onMouseEnter={(e) => {
            setIsResizeHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'nwse-resize';
          }}
          onMouseLeave={(e) => {
            setIsResizeHovered(false);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'grab';
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            // Enforce square for stickers
            const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 6, e.target.y() + 6));
            setLocalWidth(newSize);
            setLocalHeight(newSize);
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS) {
              lastResizeUpdate.current = now;
              onResize(sticker.id, newSize, newSize);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 6, e.target.y() + 6));
            setLocalWidth(newSize);
            setLocalHeight(newSize);
            onResize(sticker.id, newSize, newSize);
            setIsResizing(false);
            e.target.position({ x: newSize - 6, y: newSize - 6 });
          }}
        />
      )}
    </Group>
  );
}
