import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Circle, Line, Text } from 'react-konva';
import Konva from 'konva';
import type { Shape } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 40;
const MIN_LINE_LENGTH = 20;

/** Generate points for a regular polygon inscribed in a bounding box */
function regularPolygonPoints(w: number, h: number, sides: number): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2;
  const ry = h / 2;
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (Math.PI * 2 * i) / sides - Math.PI / 2;
    pts.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return pts;
}

/** Generate points for a 5-point star inscribed in a bounding box */
function starPoints(w: number, h: number): number[] {
  const cx = w / 2;
  const cy = h / 2;
  const outerRx = w / 2;
  const outerRy = h / 2;
  const innerRx = w / 4.5;
  const innerRy = h / 4.5;
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI * 2 * i) / 10 - Math.PI / 2;
    const rx = i % 2 === 0 ? outerRx : innerRx;
    const ry = i % 2 === 0 ? outerRy : innerRy;
    pts.push(cx + rx * Math.cos(angle), cy + ry * Math.sin(angle));
  }
  return pts;
}

/** Generate points for an arrow shape */
function arrowPoints(w: number, h: number): number[] {
  const headStart = w * 0.6;
  const shaftTop = h * 0.25;
  const shaftBottom = h * 0.75;
  return [
    0, shaftTop,
    headStart, shaftTop,
    headStart, 0,
    w, h / 2,
    headStart, h,
    headStart, shaftBottom,
    0, shaftBottom,
  ];
}

/** Generate points for a cross/plus shape */
function crossPoints(w: number, h: number): number[] {
  const t = 0.3; // arm thickness ratio
  const x1 = w * t;
  const x2 = w * (1 - t);
  const y1 = h * t;
  const y2 = h * (1 - t);
  return [
    x1, 0,  x2, 0,  x2, y1,
    w, y1,  w, y2,  x2, y2,
    x2, h,  x1, h,  x1, y2,
    0, y2,  0, y1,  x1, y1,
  ];
}

interface ShapeComponentProps {
  shape: Shape;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onLineEndpointMove?: (id: string, x: number, y: number, width: number, rotation: number) => void;
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

export function ShapeComponent({ shape, onDragMove, onDragEnd, onDelete, onClick, onResize, onRotate, onLineEndpointMove, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, parentRotation, dragOffset, isSelected, groupDragOffset, groupTransformPreview, selectionBox }: ShapeComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const lastEndpointUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
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
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  // Endpoint drag ref: stores fixed endpoint coords and which end is being dragged
  const endpointDragRef = useRef<{ fixedX: number; fixedY: number; end: 'left' | 'right' } | null>(null);

  const isLine = shape.shapeType === 'line';

  useEffect(() => {
    if (!isResizing && !isEndpointDragging) {
      setLocalWidth(shape.width);
      setLocalHeight(shape.height);
    }
  }, [shape.width, shape.height, isResizing, isEndpointDragging]);

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

    // Final persist
    onLineEndpointMove(shape.id, result.x, result.y, result.width, result.rotation);

    // Reset handle position (Konva moves the draggable element)
    const end = endpointDragRef.current.end;
    if (end === 'left') {
      e.target.position({ x: -20, y: localHeight / 2 - 20 });
    } else {
      e.target.position({ x: result.width - 20, y: localHeight / 2 - 20 });
    }

    // Reset state
    endpointDragRef.current = null;
    setIsEndpointDragging(false);
    setLiveLineX(null);
    setLiveLineY(null);
    setLiveLineWidth(null);
    setLiveLineRotation(null);
  }, [onLineEndpointMove, shape.id, localHeight]);

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
    onResize?.(shape.id, newWidth, newHeight);
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

      {/* === LINE-SPECIFIC HANDLES: endpoint handles + centered delete === */}
      {isLine && onLineEndpointMove && isMouseHovered && (
        <>
          {/* Left endpoint handle */}
          <Group
            x={-20}
            y={localHeight / 2 - 20}
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
            onDragMove={handleEndpointDragMove}
            onDragEnd={(e) => {
              handleEndpointDragEnd(e);
              // Reset handle to its original local position
              e.target.position({ x: -20, y: localHeight / 2 - 20 });
            }}
          >
            <Circle
              x={20}
              y={20}
              radius={16}
              fill={isLeftEndpointHovered ? '#3b82f6' : '#94a3b8'}
              opacity={isLeftEndpointHovered ? 1 : 0.6}
              stroke="white"
              strokeWidth={2}
            />
            <Circle
              x={20}
              y={20}
              radius={5}
              fill="white"
              listening={false}
            />
          </Group>
          {/* Right endpoint handle */}
          <Group
            x={localWidth - 20}
            y={localHeight / 2 - 20}
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
            onDragMove={handleEndpointDragMove}
            onDragEnd={(e) => {
              handleEndpointDragEnd(e);
              e.target.position({ x: localWidth - 20, y: localHeight / 2 - 20 });
            }}
          >
            <Circle
              x={20}
              y={20}
              radius={16}
              fill={isRightEndpointHovered ? '#3b82f6' : '#94a3b8'}
              opacity={isRightEndpointHovered ? 1 : 0.6}
              stroke="white"
              strokeWidth={2}
            />
            <Circle
              x={20}
              y={20}
              radius={5}
              fill="white"
              listening={false}
            />
          </Group>
        </>
      )}
      {/* Line centered delete button */}
      {isLine && onDelete && isMouseHovered && (
        <Group
          x={localWidth / 2 - 20}
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

      {/* === NON-LINE HANDLES: original delete, rotate, resize === */}
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
