import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import type Konva from 'konva';
import type { Shape } from '../../types/board';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 40;

interface ShapeComponentProps {
  shape: Shape;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onConnectorHoverEnter?: (id: string) => void;
  onConnectorHoverLeave?: () => void;
  isConnectorHighlighted?: boolean;
  dragOffset?: { x: number; y: number };
}

export function ShapeComponent({ shape, onDragMove, onDragEnd, onDelete, onClick, onResize, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, dragOffset }: ShapeComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(shape.width);
  const [localHeight, setLocalHeight] = useState(shape.height);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(shape.width);
      setLocalHeight(shape.height);
    }
  }, [shape.width, shape.height, isResizing]);

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
    const highlighted = isConnectorHighlighted || isMouseHovered;
    const stroke = isConnectorHighlighted ? '#818cf8' : (isMouseHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)');
    const strokeWidth = isConnectorHighlighted ? 4 : (isMouseHovered ? 2.5 : 1.5);

    switch (shape.shapeType) {
      case 'rect':
        return (
          <Rect
            width={localWidth}
            height={localHeight}
            fill={shape.color}
            cornerRadius={16}
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'circle':
        return (
          <Circle
            x={localWidth / 2}
            y={localHeight / 2}
            radius={Math.min(localWidth, localHeight) / 2}
            fill={shape.color}
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 32 : 20}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 6 : 3}
            stroke={stroke}
            strokeWidth={strokeWidth}
          />
        );
      case 'line':
        return (
          <Line
            points={[0, localHeight / 2, localWidth, localHeight / 2]}
            stroke={isConnectorHighlighted ? '#818cf8' : shape.color}
            strokeWidth={isConnectorHighlighted ? 8 : 6}
            lineCap="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 18 : 10}
            shadowOpacity={highlighted ? 0.65 : 0.45}
          />
        );
    }
  };

  const handleResizeDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    let newWidth = Math.max(MIN_WIDTH, e.target.x() + 10);
    let newHeight: number;

    if (shape.shapeType === 'circle') {
      newHeight = newWidth; // enforce square for circles
    } else if (shape.shapeType === 'line') {
      newHeight = localHeight; // lock height for lines
    } else {
      newHeight = Math.max(MIN_HEIGHT, e.target.y() + 10);
    }

    setLocalWidth(newWidth);
    setLocalHeight(newHeight);

    const now = Date.now();
    if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS && onResize) {
      lastResizeUpdate.current = now;
      onResize(shape.id, newWidth, newHeight);
    }
  };

  const handleResizeDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    let newWidth = Math.max(MIN_WIDTH, e.target.x() + 10);
    let newHeight: number;

    if (shape.shapeType === 'circle') {
      newHeight = newWidth;
    } else if (shape.shapeType === 'line') {
      newHeight = localHeight;
    } else {
      newHeight = Math.max(MIN_HEIGHT, e.target.y() + 10);
    }

    setLocalWidth(newWidth);
    setLocalHeight(newHeight);
    onResize?.(shape.id, newWidth, newHeight);
    setIsResizing(false);

    // For line shapes, position handle on right edge
    if (shape.shapeType === 'line') {
      e.target.position({ x: newWidth - 10, y: localHeight / 2 - 10 });
    } else {
      e.target.position({ x: newWidth - 10, y: newHeight - 10 });
    }
  };

  // Handle position for line shapes: right edge, vertically centered
  const handleX = localWidth - 10;
  const handleY = shape.shapeType === 'line' ? localHeight / 2 - 10 : localHeight - 10;

  return (
    <Group
      x={shape.x + (dragOffset?.x ?? 0)}
      y={shape.y + (dragOffset?.y ?? 0)}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(shape.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(shape.id)}
      onTap={() => onClick?.(shape.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(shape.id);
        const stage = e.target.getStage();
        if (stage && !isDeleteHovered && !isResizeHovered) {
          stage.container().style.cursor = 'grab';
        }
      }}
      onMouseLeave={(e) => {
        setIsMouseHovered(false);
        onConnectorHoverLeave?.();
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      {renderShape()}
      {/* Delete button */}
      <Rect
        x={localWidth - 26}
        y={2}
        width={22}
        height={22}
        fill={isDeleteHovered ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.08)'}
        cornerRadius={6}
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(shape.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(shape.id);
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
      />
      <Text
        x={localWidth - 21}
        y={5}
        text={'\u00d7'}
        fontSize={16}
        fontStyle="bold"
        fill={isDeleteHovered ? '#ef4444' : '#666'}
        listening={false}
      />
      {/* Resize handle */}
      {onResize && (
        <Rect
          x={handleX}
          y={handleY}
          width={20}
          height={20}
          fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
          opacity={isResizeHovered ? 1 : 0.4}
          cornerRadius={3}
          draggable
          onMouseEnter={(e) => {
            setIsResizeHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'nwse-resize';
          }}
          onMouseLeave={(e) => {
            setIsResizeHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isDeleteHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
          }}
          onDragMove={handleResizeDragMove}
          onDragEnd={handleResizeDragEnd}
        />
      )}
    </Group>
  );
}
