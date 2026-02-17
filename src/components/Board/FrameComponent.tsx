import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { Frame } from '../../types/board';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 200;
const MIN_HEIGHT = 150;

interface FrameComponentProps {
  frame: Frame;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onClick?: (id: string) => void;
  isHovered?: boolean;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onConnectorHoverEnter?: (id: string) => void;
  onConnectorHoverLeave?: () => void;
  isConnectorHighlighted?: boolean;
  isNew?: boolean;
  dragOffset?: { x: number; y: number };
  parentRotation?: number;
}

export function FrameComponent({ frame, onDragMove, onDragEnd, onDelete, onTitleChange, onClick, isHovered, onResize, onRotate, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, dragOffset, parentRotation }: FrameComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const titleRef = useRef<Konva.Text>(null);
  const borderRef = useRef<Konva.Rect>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(frame.width);
  const [localHeight, setLocalHeight] = useState(frame.height);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(frame.width);
      setLocalHeight(frame.height);
    }
  }, [frame.width, frame.height, isResizing]);

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
      // Subtract dragOffset to get the actual position (not the visual position)
      const actualX = e.target.x() - localWidth / 2 - (dragOffset?.x || 0);
      const actualY = e.target.y() - localHeight / 2 - (dragOffset?.y || 0);
      onDragMove(frame.id, actualX, actualY);
    },
    [frame.id, onDragMove, localWidth, localHeight, dragOffset]
  );

  // Hover animation via Konva Tween — priority: containment isHovered > isMouseHovered > default
  useEffect(() => {
    const rect = borderRef.current;
    if (!rect) return;

    // Destroy any in-flight tween
    if (tweenRef.current) {
      tweenRef.current.destroy();
      tweenRef.current = null;
    }

    if (isHovered) {
      // Containment hover — strongest visual
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.25,
        stroke: '#a78bfa',
        strokeWidth: 3.5,
        fill: 'rgba(167, 139, 250, 0.1)',
        shadowColor: '#a78bfa',
        shadowBlur: 16,
        shadowOpacity: 0.5,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else if (isMouseHovered) {
      // Mouse hover — warm purple
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: '#c084fc',
        strokeWidth: 3,
        fill: 'rgba(250, 245, 255, 0.2)',
        shadowColor: 'rgba(168, 85, 247, 0.2)',
        shadowBlur: 10,
        shadowOpacity: 0.4,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else {
      // Default — violet base
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: '#a78bfa',
        strokeWidth: 2.5,
        fill: 'rgba(250, 245, 255, 0.12)',
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOpacity: 0,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    }

    return () => {
      if (tweenRef.current) {
        tweenRef.current.destroy();
        tweenRef.current = null;
      }
    };
  }, [isHovered, isMouseHovered]);

  useEffect(() => {
    if (!isEditing) return;

    const stage = titleRef.current?.getStage();
    if (!stage) return;
    const container = stage.container();

    const input = document.createElement('input');
    const textNode = titleRef.current!;
    const stageBox = container.getBoundingClientRect();
    const scale = stage.scaleX();

    const textPosition = textNode.absolutePosition();

    textNode.hide();
    textNode.getLayer()?.batchDraw();

    input.value = frame.title;
    input.style.position = 'absolute';
    input.style.top = `${stageBox.top + textPosition.y}px`;
    input.style.left = `${stageBox.left + textPosition.x}px`;
    input.style.width = `${(localWidth - 40) * scale}px`;
    input.style.fontSize = `${13 * scale}px`;
    input.style.fontFamily = "'Inter', sans-serif";
    input.style.fontWeight = '600';
    input.style.padding = '2px 4px';
    input.style.border = '1px solid #3b82f6';
    input.style.outline = 'none';
    input.style.background = 'white';
    input.style.borderRadius = '4px';
    input.style.zIndex = '1000';

    document.body.appendChild(input);
    input.focus();
    input.select();

    const finish = () => {
      onTitleChange(frame.id, input.value);
      setIsEditing(false);
      textNode.show();
      textNode.getLayer()?.batchDraw();
      input.remove();
    };

    const handleBlur = () => finish();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        finish();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeyDown);
      textNode.show();
      textNode.getLayer()?.batchDraw();
      if (input.parentNode) input.remove();
    };
  }, [isEditing, frame.id, frame.title, localWidth, onTitleChange]);

  // Apply parent drag offset and rotation
  const displayX = frame.x + (dragOffset?.x || 0);
  const displayY = frame.y + (dragOffset?.y || 0);
  const displayRotation = (frame.rotation || 0) + (parentRotation || 0);

  return (
    <Group
      x={displayX + localWidth / 2}
      y={displayY + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      rotation={displayRotation}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        // Subtract dragOffset to get the actual position (not the visual position)
        const actualX = e.target.x() - localWidth / 2 - (dragOffset?.x || 0);
        const actualY = e.target.y() - localHeight / 2 - (dragOffset?.y || 0);
        onDragEnd(frame.id, actualX, actualY);
      }}
      onClick={() => onClick?.(frame.id)}
      onTap={() => onClick?.(frame.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(frame.id);
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
      {/* Frame border */}
      <Rect
        ref={borderRef}
        width={localWidth}
        height={localHeight}
        stroke={isConnectorHighlighted ? '#818cf8' : '#a78bfa'}
        strokeWidth={isConnectorHighlighted ? 4 : 2.5}
        dash={[12, 6]}
        fill="rgba(250, 245, 255, 0.12)"
        cornerRadius={16}
      />
      {/* Flash overlay for new objects */}
      {isNew && (
        <Rect
          ref={flashOverlayRef}
          width={localWidth}
          height={localHeight}
          fill="#fbbf24"
          opacity={0}
          cornerRadius={16}
          listening={false}
        />
      )}
      {/* Title background with vibrant rainbow gradient */}
      <Rect
        x={0}
        y={-36}
        width={localWidth}
        height={36}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: localWidth, y: 0 }}
        fillLinearGradientColorStops={[
          0, 'rgba(251, 146, 60, 0.18)',
          0.25, 'rgba(251, 113, 133, 0.16)',
          0.5, 'rgba(168, 85, 247, 0.16)',
          0.75, 'rgba(96, 165, 250, 0.14)',
          1, 'rgba(74, 222, 128, 0.12)'
        ]}
        cornerRadius={[16, 16, 0, 0]}
      />
      {/* Left accent bar — rainbow */}
      <Rect
        x={0}
        y={-36}
        width={4}
        height={36}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 36 }}
        fillLinearGradientColorStops={[0, '#f472b6', 0.33, '#a78bfa', 0.66, '#60a5fa', 1, '#34d399']}
        cornerRadius={[16, 0, 0, 0]}
      />
      {/* Title text */}
      <Text
        ref={titleRef}
        x={16}
        y={-28}
        text={frame.title || 'Double-click to edit'}
        fontSize={14}
        fontFamily="'Inter', sans-serif"
        fontStyle="700"
        fill={frame.title ? '#581c87' : '#a78bfa'}
        listening={false}
      />
      {/* Double-click area for title editing */}
      <Rect
        x={0}
        y={-36}
        width={localWidth - 30}
        height={36}
        fill="transparent"
        onDblClick={() => setIsEditing(true)}
        onDblTap={() => setIsEditing(true)}
      />
      {/* Delete button */}
      <Rect
        x={localWidth - 28}
        y={-32}
        width={22}
        height={22}
        fill={isDeleteHovered ? 'rgba(239,68,68,0.25)' : 'rgba(0,0,0,0.05)'}
        cornerRadius={8}
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(frame.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(frame.id);
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
        x={localWidth - 23}
        y={-29}
        text={'\u00d7'}
        fontSize={16}
        fontStyle="bold"
        fill={isDeleteHovered ? '#ef4444' : '#666'}
        listening={false}
      />
      {/* Rotate handle (bottom-left) */}
      {!isEditing && onRotate && (
        <Rect
          x={-10}
          y={localHeight - 10}
          width={20}
          height={20}
          fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'}
          opacity={isRotateHovered ? 1 : 0.4}
          cornerRadius={10}
          draggable
          onMouseEnter={(e) => {
            setIsRotateHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'grab';
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
            const center = group.absolutePosition();
            const initialAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            rotateStartRef.current = { angle: initialAngle, rotation: frame.rotation || 0 };
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            if (!rotateStartRef.current) return;
            const stage = e.target.getStage();
            if (!stage) return;
            const pointer = stage.getPointerPosition();
            if (!pointer) return;
            const group = e.target.getParent();
            const center = group.absolutePosition();
            const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
            const delta = currentAngle - rotateStartRef.current.angle;
            onRotate(frame.id, rotateStartRef.current.rotation + delta);
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            if (rotateStartRef.current) {
              const stage = e.target.getStage();
              if (stage) {
                const pointer = stage.getPointerPosition();
                if (pointer) {
                  const group = e.target.getParent();
                  const center = group.absolutePosition();
                  const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
                  const delta = currentAngle - rotateStartRef.current.angle;
                  onRotate(frame.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: -10, y: localHeight - 10 });
          }}
        />
      )}
      {/* Resize handle */}
      {!isEditing && onResize && (
        <Rect
          x={localWidth - 10}
          y={localHeight - 10}
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
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 10);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + 10);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS) {
              lastResizeUpdate.current = now;
              onResize(frame.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 10);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + 10);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            onResize(frame.id, newWidth, newHeight);
            setIsResizing(false);
            e.target.position({ x: newWidth - 10, y: newHeight - 10 });
          }}
        />
      )}
    </Group>
  );
}
