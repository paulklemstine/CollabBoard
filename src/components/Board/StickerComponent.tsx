import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { Sticker } from '../../types/board';

const DRAG_THROTTLE_MS = 50;
const MIN_SIZE = 50;
const BASE_FONT_SIZE = 120;
const BASE_SIZE = 150;

interface StickerComponentProps {
  sticker: Sticker;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  dragOffset?: { x: number; y: number };
  parentRotation?: number;
  isNew?: boolean;
  isSelected?: boolean;
  groupDragOffset?: { dx: number; dy: number } | null;
  groupTransformPreview?: any;
  selectionBox?: any;
}

export function StickerComponent({
  sticker,
  onDragMove,
  onDragEnd,
  onDelete,
  onClick,
  onResize,
  onRotate: _onRotate,
  dragOffset,
  parentRotation: _parentRotation,
  isNew: _isNew,
  isSelected: _isSelected,
  groupDragOffset,
  groupTransformPreview: _groupTransformPreview,
  selectionBox: _selectionBox
}: StickerComponentProps) {
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
      draggable={!groupDragOffset}
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
      {/* Just the emoji - no background */}
      <Text
        text={sticker.emoji}
        fontSize={fontSize}
        listening={false}
      />
      {/* Delete button */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - 20}
          y={-20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete?.(sticker.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete?.(sticker.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
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
          <Rect
            width={40}
            height={40}
            fill={isDeleteHovered ? '#ef4444' : '#94a3b8'}
            opacity={isDeleteHovered ? 1 : 0.4}
            cornerRadius={8}
          />
          <Text
            text="❌"
            fontSize={24}
            width={40}
            height={40}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle */}
      {onResize && isMouseHovered && (
        <Group
          x={localWidth - 20}
          y={localHeight - 20}
          draggable
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
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
            const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 20, e.target.y() + 20));
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
            const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 20, e.target.y() + 20));
            setLocalWidth(newSize);
            setLocalHeight(newSize);
            onResize(sticker.id, newSize, newSize);
            setIsResizing(false);
            e.target.position({ x: newSize - 20, y: newSize - 20 });
          }}
        >
          <Rect
            width={40}
            height={40}
            fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
            opacity={isResizeHovered ? 1 : 0.4}
            cornerRadius={8}
          />
          <Text
            text="↔️"
            fontSize={24}
            width={40}
            height={40}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
