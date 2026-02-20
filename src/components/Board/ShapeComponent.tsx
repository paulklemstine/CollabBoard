import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import Konva from 'konva';
import type { Shape } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { regularPolygonPoints, starPoints, arrowPoints, crossPoints } from '../../utils/shapePoints';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 40;
const MIN_LINE_LENGTH = 20;

interface ShapeComponentProps {
  shape: Shape;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
  onLineEndpointMove?: (id: string, x: number, y: number, width: number, rotation: number) => void;
  onLineEndpointEnd?: (id: string, x: number, y: number, width: number, rotation: number) => void;
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
  dragTint?: 'accept' | 'reject' | 'none';
}

export function ShapeComponent({ shape, onDragMove, onDragEnd, onDelete, onDuplicate, onClick, onResize, onRotate, onResizeEnd, onRotateEnd, onLineEndpointMove, onLineEndpointEnd, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, parentRotation, dragOffset, isSelected, groupDragOffset, groupTransformPreview, selectionBox, dragTint = 'none' }: ShapeComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const lastEndpointUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const [isLeftEndpointHovered, setIsLeftEndpointHovered] = useState(false);
  const [isRightEndpointHovered, setIsRightEndpointHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isEndpointDragging, setIsEndpointDragging] = useState(false);
  const [localWidth, setLocalWidth] = useState(shape.width);
  const [localHeight, setLocalHeight] = useState(shape.height);
  // Live line params during endpoint drag
  const [liveLineX, setLiveLineX] = useState<number | null>(null);
  const [liveLineY, setLiveLineY] = useState<number | null>(null);
  const [liveLineWidth, setLiveLineWidth] = useState<number | null>(null);
  const [liveLineRotation, setLiveLineRotation] = useState<number | null>(null);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const groupRef = useRef<Konva.Group>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const prevSelectedRef = useRef(false);
  const selectionRectRef = useRef<Konva.Rect>(null);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);
  // Endpoint drag ref: stores fixed endpoint coords and which end is being dragged
  const endpointDragRef = useRef<{ fixedX: number; fixedY: number; end: 'left' | 'right' } | null>(null);

  const isLine = shape.shapeType === 'line';

  useEffect(() => {
    if (!isResizing && !isEndpointDragging) {
      setLocalWidth(shape.width);
      setLocalHeight(shape.height);
    }
  }, [shape.width, shape.height, isResizing, isEndpointDragging]);

  // Drop bounce + flash pulse for new objects
  useEffect(() => {
    if (!isNew) return;
    let destroyed = false;

    if (groupRef.current) {
      const g = groupRef.current;
      g.scaleX(0.85);
      g.scaleY(0.85);
      new Konva.Tween({
        node: g, duration: 0.35, scaleX: 1, scaleY: 1,
        easing: Konva.Easings.ElasticEaseOut,
      }).play();
    }

    if (flashOverlayRef.current) {
      const node = flashOverlayRef.current;
      const pulse = (count: number) => {
        if (count >= 3 || destroyed) return;
        const tweenIn = new Konva.Tween({
          node, duration: 0.33, opacity: 0.45, easing: Konva.Easings.EaseInOut,
          onFinish: () => {
            if (destroyed) return;
            new Konva.Tween({
              node, duration: 0.33, opacity: 0, easing: Konva.Easings.EaseInOut,
              onFinish: () => pulse(count + 1),
            }).play();
          },
        });
        tweenIn.play();
      };
      pulse(0);
    }

    return () => { destroyed = true; };
  }, [isNew]);

  // Selection pop animation
  useEffect(() => {
    if (isSelected && !prevSelectedRef.current && groupRef.current) {
      const g = groupRef.current;
      new Konva.Tween({
        node: g, duration: 0.1, scaleX: 1.03, scaleY: 1.03, easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          new Konva.Tween({ node: g, duration: 0.1, scaleX: 1, scaleY: 1, easing: Konva.Easings.EaseInOut }).play();
        },
      }).play();
    }
    prevSelectedRef.current = !!isSelected;
  }, [isSelected]);

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

  // --- Line endpoint math ---
  const getLineEndpoints = useCallback(() => {
    const w = liveLineWidth ?? localWidth;
    const rot = liveLineRotation ?? (shape.rotation || 0);
    const sx = liveLineX ?? shape.x;
    const sy = liveLineY ?? shape.y;
    const cx = sx + w / 2;
    const cy = sy + 2; // height is 4, so center y offset is 2
    const rad = rot * (Math.PI / 180);
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const halfW = w / 2;
    return {
      left: { x: cx - halfW * cosR, y: cy - halfW * sinR },
      right: { x: cx + halfW * cosR, y: cy + halfW * sinR },
    };
  }, [localWidth, shape.rotation, shape.x, shape.y, liveLineX, liveLineY, liveLineWidth, liveLineRotation]);

  const computeLineFromEndpoints = (fixedX: number, fixedY: number, draggedX: number, draggedY: number) => {
    const dx = draggedX - fixedX;
    const dy = draggedY - fixedY;
    const newWidth = Math.max(MIN_LINE_LENGTH, Math.sqrt(dx * dx + dy * dy));
    const newRotation = Math.atan2(dy, dx) * (180 / Math.PI);
    const newX = (fixedX + draggedX) / 2 - newWidth / 2;
    const newY = (fixedY + draggedY) / 2 - 2; // height=4, center offset=2
    return { x: newX, y: newY, width: newWidth, rotation: newRotation };
  };

  const handleEndpointDragStart = useCallback((end: 'left' | 'right') => {
    const eps = getLineEndpoints();
    const fixed = end === 'left' ? eps.right : eps.left;
    endpointDragRef.current = { fixedX: fixed.x, fixedY: fixed.y, end };
    setIsEndpointDragging(true);
  }, [getLineEndpoints]);

  const handleEndpointDragMove = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (!endpointDragRef.current || !onLineEndpointMove) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    // Convert screen pointer to world space
    const transform = stage.getAbsoluteTransform().copy().invert();
    const worldPos = transform.point(pointer);

    const { fixedX, fixedY } = endpointDragRef.current;
    const result = computeLineFromEndpoints(fixedX, fixedY, worldPos.x, worldPos.y);

    // Update local state for live preview
    setLiveLineX(result.x);
    setLiveLineY(result.y);
    setLiveLineWidth(result.width);
    setLiveLineRotation(result.rotation);
    setLocalWidth(result.width);

    // Throttled Firestore write
    const now = Date.now();
    if (now - lastEndpointUpdate.current >= DRAG_THROTTLE_MS) {
      lastEndpointUpdate.current = now;
      onLineEndpointMove(shape.id, result.x, result.y, result.width, result.rotation);
    }
  }, [onLineEndpointMove, shape.id]);

  const handleEndpointDragEnd = useCallback((e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    if (!endpointDragRef.current || !onLineEndpointMove) return;
    const stage = e.target.getStage();
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const transform = stage.getAbsoluteTransform().copy().invert();
    const worldPos = transform.point(pointer);

    const { fixedX, fixedY } = endpointDragRef.current;
    const result = computeLineFromEndpoints(fixedX, fixedY, worldPos.x, worldPos.y);

    // Final persist — use onLineEndpointEnd (triggers undo) if available, fallback to onLineEndpointMove
    (onLineEndpointEnd ?? onLineEndpointMove)(shape.id, result.x, result.y, result.width, result.rotation);

    // Reset handle position (Konva moves the draggable element)
    const end = endpointDragRef.current.end;
    if (end === 'left') {
      e.target.position({ x: -28, y: localHeight / 2 - 28 });
    } else {
      e.target.position({ x: result.width - 28, y: localHeight / 2 - 28 });
    }

    // Reset state
    endpointDragRef.current = null;
    setIsEndpointDragging(false);
    setLiveLineX(null);
    setLiveLineY(null);
    setLiveLineWidth(null);
    setLiveLineRotation(null);
  }, [onLineEndpointMove, onLineEndpointEnd, shape.id, localHeight]);

  const renderShape = () => {
    const highlighted = isConnectorHighlighted || isMouseHovered;
    const defaultStroke = isMouseHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)';
    const stroke = isConnectorHighlighted ? '#818cf8' : (shape.strokeColor || defaultStroke);
    const strokeWidth = isConnectorHighlighted ? 4 : (shape.strokeColor ? 2 : (isMouseHovered ? 2.5 : 1.5));

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
      case 'triangle':
      case 'pentagon':
      case 'hexagon':
      case 'octagon': {
        const sides = shape.shapeType === 'triangle' ? 3 : shape.shapeType === 'pentagon' ? 5 : shape.shapeType === 'hexagon' ? 6 : 8;
        return (
          <Line
            points={regularPolygonPoints(localWidth, localHeight, sides)}
            closed
            fill={shape.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineJoin="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
          />
        );
      }
      case 'diamond':
        return (
          <Line
            points={[localWidth / 2, 0, localWidth, localHeight / 2, localWidth / 2, localHeight, 0, localHeight / 2]}
            closed
            fill={shape.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineJoin="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
          />
        );
      case 'star':
        return (
          <Line
            points={starPoints(localWidth, localHeight)}
            closed
            fill={shape.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineJoin="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
          />
        );
      case 'arrow':
        return (
          <Line
            points={arrowPoints(localWidth, localHeight)}
            closed
            fill={shape.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineJoin="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
          />
        );
      case 'cross':
        return (
          <Line
            points={crossPoints(localWidth, localHeight)}
            closed
            fill={shape.color}
            stroke={stroke}
            strokeWidth={strokeWidth}
            lineJoin="round"
            shadowColor={isConnectorHighlighted ? '#818cf8' : shape.color}
            shadowBlur={highlighted ? 30 : 18}
            shadowOpacity={highlighted ? 0.55 : 0.35}
            shadowOffsetY={highlighted ? 8 : 4}
          />
        );
      default:
        // Fallback: render as rectangle
        return (
          <Rect
            width={localWidth}
            height={localHeight}
            fill={shape.color}
            cornerRadius={16}
            shadowColor={shape.color}
            shadowBlur={18}
            shadowOpacity={0.35}
            shadowOffsetY={4}
            stroke={stroke}
            strokeWidth={strokeWidth}
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
    (onResizeEnd ?? onResize)?.(shape.id, newWidth, newHeight);
    setIsResizing(false);

    // For line shapes, position handle on right edge with 20px offset
    if (shape.shapeType === 'line') {
      e.target.position({ x: newWidth - 20, y: localHeight / 2 - 20 });
    } else {
      e.target.position({ x: newWidth - 20, y: newHeight - 20 });
    }
  };

  // Handle position for line shapes: right edge, vertically centered, with 20px offset
  const handleX = localWidth - 20;
  const handleY = isLine ? localHeight / 2 - 20 : localHeight - 20;

  // Use live line position during endpoint drag for immediate visual feedback
  const effectiveX = liveLineX ?? shape.x;
  const effectiveY = liveLineY ?? shape.y;
  const effectiveRotation = liveLineRotation ?? (shape.rotation || 0);

  return (
    <Group
      ref={groupRef}
      x={effectiveX + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={effectiveY + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={effectiveRotation + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset && !isEndpointDragging}
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
        if (stage && !isDeleteHovered && !isResizeHovered && !isRotateHovered && !isLeftEndpointHovered && !isRightEndpointHovered) {
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
      {/* Hit expansion — prevents onMouseLeave race when reaching action buttons */}
      <Rect x={-30} y={-30} width={localWidth + 60} height={localHeight + 60}
            fill="transparent" listening={true} />
      {renderShape()}
      {/* Selection highlight — only for single-select */}
      {isSelected && !selectionBox && (
        <Rect
          ref={selectionRectRef}
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
      {/* Multi-select violet glow */}
      {isSelected && selectionBox && (
        <Rect
          width={localWidth}
          height={localHeight}
          fill="transparent"
          shadowColor="#8b5cf6"
          shadowBlur={24}
          shadowOpacity={0.5}
          cornerRadius={shape.shapeType === 'circle' ? localWidth / 2 : 16}
          listening={false}
        />
      )}
      {/* Drag tint overlay for containment feedback */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={shape.shapeType === 'circle' ? localWidth / 2 : 16}
          fill={dragTint === 'accept' ? '#22c55e' : '#ef4444'}
          opacity={0.18}
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

      {/* === LINE-SPECIFIC HANDLES: endpoint handles + centered delete === */}
      {isLine && onLineEndpointMove && isMouseHovered && (
        <>
          {/* Left endpoint handle */}
          <Group
            x={-28}
            y={localHeight / 2 - 28}
            draggable
            onMouseEnter={(e) => {
              setIsMouseHovered(true);
              setIsLeftEndpointHovered(true);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              setIsLeftEndpointHovered(false);
              const stage = e.target.getStage();
              if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              handleEndpointDragStart('left');
            }}
            onDragMove={(e) => {
              handleEndpointDragMove(e);
              // Keep handle pinned at the left endpoint to prevent detachment
              e.target.position({ x: -28, y: localHeight / 2 - 28 });
            }}
            onDragEnd={(e) => {
              handleEndpointDragEnd(e);
              // Reset handle to its original local position
              e.target.position({ x: -28, y: localHeight / 2 - 28 });
            }}
          >
            <Circle
              x={28}
              y={28}
              radius={24}
              fill={isLeftEndpointHovered ? '#3b82f6' : '#94a3b8'}
              opacity={isLeftEndpointHovered ? 1 : 0.6}
              stroke="white"
              strokeWidth={2.5}
            />
            <Circle
              x={28}
              y={28}
              radius={8}
              fill="white"
              listening={false}
            />
          </Group>
          {/* Right endpoint handle */}
          <Group
            x={localWidth - 28}
            y={localHeight / 2 - 28}
            draggable
            onMouseEnter={(e) => {
              setIsMouseHovered(true);
              setIsRightEndpointHovered(true);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'crosshair';
            }}
            onMouseLeave={(e) => {
              setIsRightEndpointHovered(false);
              const stage = e.target.getStage();
              if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
            }}
            onDragStart={(e) => {
              e.cancelBubble = true;
              handleEndpointDragStart('right');
            }}
            onDragMove={(e) => {
              handleEndpointDragMove(e);
              // Keep handle pinned at the right endpoint to prevent detachment
              e.target.position({ x: localWidth - 28, y: localHeight / 2 - 28 });
            }}
            onDragEnd={(e) => {
              handleEndpointDragEnd(e);
              e.target.position({ x: localWidth - 28, y: localHeight / 2 - 28 });
            }}
          >
            <Circle
              x={28}
              y={28}
              radius={24}
              fill={isRightEndpointHovered ? '#3b82f6' : '#94a3b8'}
              opacity={isRightEndpointHovered ? 1 : 0.6}
              stroke="white"
              strokeWidth={2.5}
            />
            <Circle
              x={28}
              y={28}
              radius={8}
              fill="white"
              listening={false}
            />
          </Group>
        </>
      )}
      {/* Line centered copy button */}
      {isLine && onDuplicate && isMouseHovered && (
        <Group
          x={localWidth / 2 - 43}
          y={localHeight / 2 - 20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(shape.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(shape.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDuplicateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDuplicateHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
          }}
        >
          <Rect
            width={40}
            height={40}
            fill={isDuplicateHovered ? '#22c55e' : '#94a3b8'}
            opacity={isDuplicateHovered ? 1 : 0.4}
            cornerRadius={8}
          />
          <Text
            text={"\uD83D\uDCCB"}
            fontSize={24}
            width={40}
            height={40}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Line centered delete button */}
      {isLine && onDelete && isMouseHovered && (
        <Group
          x={localWidth / 2 + 3}
          y={localHeight / 2 - 20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete(shape.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete(shape.id);
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
            if (stage && isMouseHovered) stage.container().style.cursor = 'grab';
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

      {/* === NON-LINE HANDLES: duplicate, delete, rotate, resize === */}
      {/* Duplicate button (top-left, non-line) */}
      {!isLine && onDuplicate && isMouseHovered && (
        <Group
          x={-20}
          y={-20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(shape.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(shape.id);
          }}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDuplicateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDuplicateHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
        >
          <Rect
            width={40}
            height={40}
            fill={isDuplicateHovered ? '#22c55e' : '#94a3b8'}
            opacity={isDuplicateHovered ? 1 : 0.4}
            cornerRadius={8}
          />
          <Text
            text={"\uD83D\uDCCB"}
            fontSize={24}
            width={40}
            height={40}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Delete button (non-line) */}
      {!isLine && onDelete && isMouseHovered && (
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
            setIsMouseHovered(true);
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
      {/* Rotate handle (bottom-left, non-line only) */}
      {!isLine && onRotate && isMouseHovered && (
        <Group
          x={-20}
          y={localHeight - 20}
          draggable
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
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
            e.target.position({ x: -20, y: localHeight - 20 });
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
                  (onRotateEnd ?? onRotate)(shape.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: -20, y: localHeight - 20 });
          }}
        >
          <Rect
            width={40}
            height={40}
            fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'}
            opacity={isRotateHovered ? 1 : 0.4}
            cornerRadius={8}
          />
          <Text
            text="🔄"
            fontSize={24}
            width={40}
            height={40}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle (non-line only) */}
      {!isLine && onResize && isMouseHovered && (
        <Group
          x={handleX}
          y={handleY}
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
