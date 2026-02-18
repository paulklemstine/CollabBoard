import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect, Circle, Path } from 'react-konva';
import Konva from 'konva';
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
  const groupRef = useRef<Konva.Group>(null);
  const hoverTweenRef = useRef<Konva.Tween | null>(null);
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

  // Elastic bounce on hover
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    if (hoverTweenRef.current) {
      hoverTweenRef.current.destroy();
      hoverTweenRef.current = null;
    }

    if (isMouseHovered) {
      hoverTweenRef.current = new Konva.Tween({
        node: group,
        duration: 0.3,
        scaleX: 1.15,
        scaleY: 1.15,
        easing: Konva.Easings.ElasticEaseOut,
      });
      hoverTweenRef.current.play();
    } else {
      hoverTweenRef.current = new Konva.Tween({
        node: group,
        duration: 0.2,
        scaleX: 1,
        scaleY: 1,
        easing: Konva.Easings.EaseInOut,
      });
      hoverTweenRef.current.play();
    }

    return () => {
      if (hoverTweenRef.current) {
        hoverTweenRef.current.destroy();
      }
    };
  }, [isMouseHovered]);

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
      ref={groupRef}
      x={sticker.x + (dragOffset?.x ?? 0)}
      y={sticker.y + (dragOffset?.y ?? 0)}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        hoverTweenRef.current?.destroy();
        hoverTweenRef.current = null;
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
      {/* Hit area with playful colored glow */}
      <Rect
        width={localWidth + 12}
        height={localHeight + 12}
        x={-6}
        y={-6}
        fill={isMouseHovered ? 'rgba(251, 191, 36, 0.2)' : 'rgba(255,255,255,0.35)'}
        cornerRadius={16}
        shadowColor={isMouseHovered ? '#fbbf24' : 'rgba(0,0,0,0.06)'}
        shadowBlur={isMouseHovered ? 24 : 10}
        shadowOffsetY={isMouseHovered ? 4 : 2}
        shadowOpacity={isMouseHovered ? 0.5 : 0.3}
      />
      <Text
        text={sticker.emoji}
        fontSize={fontSize}
        listening={false}
        shadowColor="rgba(0,0,0,0.2)"
        shadowBlur={isMouseHovered ? 8 : 5}
        shadowOffsetY={isMouseHovered ? 4 : 2}
      />
      {/* Delete button */}
      <Group
        x={localWidth - 10}
        y={-10}
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
          if (stage && isMouseHovered && !isResizeHovered) {
            stage.container().style.cursor = 'grab';
          }
        }}
      >
        <Circle
          radius={10}
          fill={isDeleteHovered ? '#ef4444' : '#94a3b8'}
          opacity={isDeleteHovered ? 1 : 0.4}
        />
        <Path
          x={-5}
          y={-5}
          data="M3 6h12M5 6V4a1 1 0 011-1h2a1 1 0 011 1v2m3 0V4a1 1 0 011-1h2a1 1 0 011 1v2M4 6v10a1 1 0 001 1h8a1 1 0 001-1V6H4z"
          stroke="white"
          strokeWidth={1.2}
          fill="transparent"
          scaleX={0.7}
          scaleY={0.7}
          listening={false}
        />
      </Group>
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
