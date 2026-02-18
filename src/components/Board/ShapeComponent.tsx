import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import Konva from 'konva';
import type { Shape } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 40;

interface ShapeComponentProps {
  shape: Shape;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onConnectorHoverEnter?: (id: string) => void;
  onConnectorHoverLeave?: () => void;
  isConnectorHighlighted?: boolean;
  isNew?: boolean;
  parentRotation?: number;
  dragOffset?: { x: number; y: number };
  isSelected?: boolean;
  groupDragOffset?: { dx: number; dy: number } | null;
  groupTransformPreview?: GroupTransformPreview | null;
  selectionBox?: SelectionBox | null;
}

export function ShapeComponent({ shape, onDragMove, onDragEnd, onDelete, onClick, onResize, onRotate, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, parentRotation, dragOffset, isSelected, groupDragOffset, groupTransformPreview, selectionBox }: ShapeComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(shape.width);
  const [localHeight, setLocalHeight] = useState(shape.height);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(shape.width);
      setLocalHeight(shape.height);
    }
  }, [shape.width, shape.height, isResizing]);

  useEffect(() => {
    if (!isNew || !flashOverlayRef.current) return;
    const node = flashOverlayRef.current;
    let destroyed = false;

    const pulse = (count: number) => {
      if (count >= 3 || destroyed) return;
      const tweenIn = new Konva.Tween({
        node,
        duration: 0.33,
        opacity: 0.45,
        easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          if (destroyed) return;
          const tweenOut = new Konva.Tween({
            node,
            duration: 0.33,
            opacity: 0,
            easing: Konva.Easings.EaseInOut,
            onFinish: () => pulse(count + 1),
          });
          tweenOut.play();
        },
      });
      tweenIn.play();
    };
    pulse(0);

    return () => { destroyed = true; };
  }, [isNew]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(shape.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
    },
    [shape.id, onDragMove, localWidth, localHeight]
  );

  // Calculate live transform when part of a multi-select group
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(shape, selectionBox, groupTransformPreview)
    : null;

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
    let newWidth = Math.max(MIN_WIDTH, e.target.x() + 20);
    let newHeight: number;

    if (shape.shapeType === 'circle') {
      newHeight = newWidth; // enforce square for circles
    } else if (shape.shapeType === 'line') {
      newHeight = localHeight; // lock height for lines
    } else {
      newHeight = Math.max(MIN_HEIGHT, e.target.y() + 20);
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
    let newWidth = Math.max(MIN_WIDTH, e.target.x() + 20);
    let newHeight: number;

    if (shape.shapeType === 'circle') {
      newHeight = newWidth;
    } else if (shape.shapeType === 'line') {
      newHeight = localHeight;
    } else {
      newHeight = Math.max(MIN_HEIGHT, e.target.y() + 20);
    }

    setLocalWidth(newWidth);
    setLocalHeight(newHeight);
    onResize?.(shape.id, newWidth, newHeight);
    setIsResizing(false);

    // For line shapes, position handle on right edge
    if (shape.shapeType === 'line') {
      e.target.position({ x: newWidth - 20, y: localHeight / 2 - 20 });
    } else {
      e.target.position({ x: newWidth - 20, y: newHeight - 20 });
    }
  };

  // Handle position for line shapes: right edge, vertically centered
  const handleX = localWidth - 20;
  const handleY = shape.shapeType === 'line' ? localHeight / 2 - 20 : localHeight - 20;

  return (
    <Group
      x={shape.x + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={shape.y + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(shape.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(shape.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(shape.id)}
      onTap={() => onClick?.(shape.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(shape.id);
        const stage = e.target.getStage();
        if (stage && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
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
      {/* Selection highlight */}
      {isSelected && (
        <Rect
          width={localWidth}
          height={localHeight}
          stroke="#3b82f6"
          strokeWidth={3}
          dash={[8, 4]}
          fill="transparent"
          cornerRadius={shape.shapeType === 'circle' ? localWidth / 2 : 16}
          listening={false}
        />
      )}
      {/* Flash overlay for new objects */}
      {isNew && (
        <Rect
          ref={flashOverlayRef}
          width={localWidth}
          height={localHeight}
          fill="#fbbf24"
          opacity={0}
          cornerRadius={shape.shapeType === 'circle' ? localWidth / 2 : 16}
          listening={false}
        />
      )}
      {/* Delete button */}
      {onDelete && (
        <Group
          x={localWidth - 20}
          y={-20}
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
            if (stage && isMouseHovered && !isResizeHovered && !isRotateHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
        >
          <Rect
            width={20}
            height={20}
            fill={isDeleteHovered ? '#ef4444' : '#94a3b8'}
            opacity={isDeleteHovered ? 1 : 0.4}
            cornerRadius={4}
          />
          <Text
            text="❌"
            fontSize={12}
            x={4}
            y={4}
            listening={false}
          />
        </Group>
      )}
      {/* Rotate handle (bottom-left) */}
      {onRotate && (
        <Group
          x={-20}
          y={localHeight - 20}
          draggable
          onMouseEnter={(e) => {
            setIsRotateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'alias';
          }}
          onMouseLeave={(e) => {
            setIsRotateHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const group = e.target.getParent();
            if (!group) return;
            const center = group.absolutePosition();
            const initialAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            rotateStartRef.current = { angle: initialAngle, rotation: shape.rotation || 0 };
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (!rotateStartRef.current) return;
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const group = e.target.getParent();
            if (!group) return;
            const center = group.absolutePosition();
            const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            const delta = currentAngle - rotateStartRef.current.angle;
            onRotate(shape.id, rotateStartRef.current.rotation + delta);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            if (rotateStartRef.current) {
              const stage = e.target.getStage();
              if (stage) {
                const pointer = stage.getPointerPosition();
                if (pointer) {
                  const group = e.target.getParent();
                  if (!group) return;
                  const center = group.absolutePosition();
                  const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
                  const delta = currentAngle - rotateStartRef.current.angle;
                  onRotate(shape.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: -20, y: localHeight - 20 });
          }}
        >
          <Rect
            width={20}
            height={20}
            fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'}
            opacity={isRotateHovered ? 1 : 0.4}
            cornerRadius={4}
          />
          <Text
            text="🔄"
            fontSize={12}
            x={4}
            y={4}
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle */}
      {onResize && (
        <Group
          x={handleX}
          y={handleY}
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
        >
          <Rect
            width={20}
            height={20}
            fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
            opacity={isResizeHovered ? 1 : 0.4}
            cornerRadius={4}
          />
          <Text
            text="↔️"
            fontSize={12}
            x={4}
            y={4}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
