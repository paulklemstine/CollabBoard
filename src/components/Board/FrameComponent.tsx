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
}

export function FrameComponent({ frame, onDragMove, onDragEnd, onDelete, onTitleChange, onClick, isHovered, onResize }: FrameComponentProps) {
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const titleRef = useRef<Konva.Text>(null);
  const borderRef = useRef<Konva.Rect>(null);
  const tweenRef = useRef<Konva.Tween | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(frame.width);
  const [localHeight, setLocalHeight] = useState(frame.height);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(frame.width);
      setLocalHeight(frame.height);
    }
  }, [frame.width, frame.height, isResizing]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(frame.id, e.target.x(), e.target.y());
    },
    [frame.id, onDragMove]
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
        duration: 0.2,
        stroke: '#3b82f6',
        strokeWidth: 3,
        fill: 'rgba(59, 130, 246, 0.08)',
        shadowColor: '#3b82f6',
        shadowBlur: 12,
        shadowOpacity: 0.4,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else if (isMouseHovered) {
      // Mouse hover — subtle darkened stroke
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: '#64748b',
        strokeWidth: 2.5,
        fill: 'rgba(241, 245, 249, 0.25)',
        shadowColor: 'rgba(0,0,0,0.1)',
        shadowBlur: 6,
        shadowOpacity: 0.3,
        easing: Konva.Easings.EaseInOut,
      });
      tweenRef.current.play();
    } else {
      // Default
      tweenRef.current = new Konva.Tween({
        node: rect,
        duration: 0.15,
        stroke: '#94a3b8',
        strokeWidth: 2,
        fill: 'rgba(241, 245, 249, 0.15)',
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

  return (
    <Group
      x={frame.x}
      y={frame.y}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(frame.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(frame.id)}
      onTap={() => onClick?.(frame.id)}
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
      {/* Frame border */}
      <Rect
        ref={borderRef}
        width={localWidth}
        height={localHeight}
        stroke="#94a3b8"
        strokeWidth={2}
        dash={[8, 4]}
        fill="rgba(241, 245, 249, 0.15)"
        cornerRadius={12}
      />
      {/* Title background with gradient accent */}
      <Rect
        x={0}
        y={-32}
        width={localWidth}
        height={32}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: localWidth, y: 0 }}
        fillLinearGradientColorStops={[0, 'rgba(99, 102, 241, 0.12)', 0.5, 'rgba(168, 85, 247, 0.08)', 1, 'rgba(236, 72, 153, 0.06)']}
        cornerRadius={[12, 12, 0, 0]}
      />
      {/* Left accent bar */}
      <Rect
        x={0}
        y={-32}
        width={3}
        height={32}
        fillLinearGradientStartPoint={{ x: 0, y: 0 }}
        fillLinearGradientEndPoint={{ x: 0, y: 32 }}
        fillLinearGradientColorStops={[0, '#6366f1', 1, '#a855f7']}
        cornerRadius={[12, 0, 0, 0]}
      />
      {/* Title text */}
      <Text
        ref={titleRef}
        x={14}
        y={-24}
        text={frame.title || 'Untitled Frame'}
        fontSize={13}
        fontFamily="'Inter', sans-serif"
        fontStyle="600"
        fill={frame.title ? '#334155' : '#94a3b8'}
        listening={false}
      />
      {/* Double-click area for title editing */}
      <Rect
        x={0}
        y={-32}
        width={localWidth - 30}
        height={32}
        fill="transparent"
        onDblClick={() => setIsEditing(true)}
        onDblTap={() => setIsEditing(true)}
      />
      {/* Delete button */}
      <Rect
        x={localWidth - 28}
        y={-28}
        width={22}
        height={22}
        fill={isDeleteHovered ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.05)'}
        cornerRadius={6}
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
          if (stage) stage.container().style.cursor = 'grab';
        }}
      />
      <Text
        x={localWidth - 23}
        y={-25}
        text={'\u00d7'}
        fontSize={16}
        fontStyle="bold"
        fill={isDeleteHovered ? '#ef4444' : '#666'}
        listening={false}
      />
      {/* Resize handle */}
      {!isEditing && onResize && (
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
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 6);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + 6);
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
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 6);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + 6);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            onResize(frame.id, newWidth, newHeight);
            setIsResizing(false);
            e.target.position({ x: newWidth - 6, y: newHeight - 6 });
          }}
        />
      )}
    </Group>
  );
}
