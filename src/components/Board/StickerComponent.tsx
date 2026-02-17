import { useRef, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import type Konva from 'konva';
import type { Sticker } from '../../types/board';

const DRAG_THROTTLE_MS = 50;

interface StickerComponentProps {
  sticker: Sticker;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
}

export function StickerComponent({ sticker, onDragMove, onDragEnd, onDelete, onClick }: StickerComponentProps) {
  const lastDragUpdate = useRef(0);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(sticker.id, e.target.x(), e.target.y());
    },
    [sticker.id, onDragMove]
  );

  return (
    <Group
      x={sticker.x}
      y={sticker.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={(e) => {
        onDragEnd(sticker.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(sticker.id)}
      onTap={() => onClick?.(sticker.id)}
    >
      <Text
        text={sticker.emoji}
        fontSize={48}
        listening={false}
      />
      {/* Delete button */}
      <Rect
        x={sticker.width - 16}
        y={0}
        width={16}
        height={16}
        fill="transparent"
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(sticker.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(sticker.id);
        }}
      />
      <Text
        x={sticker.width - 14}
        y={0}
        text="x"
        fontSize={12}
        fill="#999"
        listening={false}
      />
    </Group>
  );
}
