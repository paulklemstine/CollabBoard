import { useRef, useCallback } from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { Shape } from '../../types/board';

const DRAG_THROTTLE_MS = 50;

interface ShapeComponentProps {
  shape: Shape;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
}

export function ShapeComponent({ shape, onDragMove, onDragEnd, onDelete, onClick }: ShapeComponentProps) {
  const lastDragUpdate = useRef(0);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(shape.id, e.target.x(), e.target.y());
    },
    [shape.id, onDragMove]
  );

  const renderShape = () => {
    switch (shape.shapeType) {
      case 'rect':
        return (
          <Rect
            width={shape.width}
            height={shape.height}
            fill={shape.color}
            cornerRadius={2}
          />
        );
      case 'circle':
        return (
          <Circle
            x={shape.width / 2}
            y={shape.height / 2}
            radius={Math.min(shape.width, shape.height) / 2}
            fill={shape.color}
          />
        );
      case 'line':
        return (
          <Line
            points={[0, shape.height / 2, shape.width, shape.height / 2]}
            stroke={shape.color}
            strokeWidth={3}
          />
        );
    }
  };

  return (
    <Group
      x={shape.x}
      y={shape.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={(e) => {
        onDragEnd(shape.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(shape.id)}
      onTap={() => onClick?.(shape.id)}
    >
      {renderShape()}
      {/* Delete button */}
      <Rect
        x={shape.width - 24}
        y={4}
        width={20}
        height={20}
        fill="transparent"
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(shape.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(shape.id);
        }}
      />
      <Text
        x={shape.width - 20}
        y={4}
        text="x"
        fontSize={14}
        fill="#999"
        listening={false}
      />
    </Group>
  );
}
