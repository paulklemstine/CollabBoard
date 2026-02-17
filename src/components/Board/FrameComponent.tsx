import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { Frame } from '../../types/board';

const DRAG_THROTTLE_MS = 50;

interface FrameComponentProps {
  frame: Frame;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete: (id: string) => void;
  onTitleChange: (id: string, title: string) => void;
  onClick?: (id: string) => void;
}

export function FrameComponent({ frame, onDragMove, onDragEnd, onDelete, onTitleChange, onClick }: FrameComponentProps) {
  const lastDragUpdate = useRef(0);
  const titleRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(frame.id, e.target.x(), e.target.y());
    },
    [frame.id, onDragMove]
  );

  useEffect(() => {
    if (!isEditing) return;

    const stage = titleRef.current?.getStage();
    if (!stage) return;
    const container = stage.container();

    const input = document.createElement('input');
    const textNode = titleRef.current!;
    const textPosition = textNode.absolutePosition();
    const stageBox = container.getBoundingClientRect();
    const scale = stage.scaleX();

    input.value = frame.title;
    input.style.position = 'absolute';
    input.style.top = `${stageBox.top + textPosition.y * scale}px`;
    input.style.left = `${stageBox.left + textPosition.x * scale}px`;
    input.style.width = `${(frame.width - 40) * scale}px`;
    input.style.fontSize = `${14 * scale}px`;
    input.style.fontFamily = 'sans-serif';
    input.style.fontWeight = 'bold';
    input.style.padding = '2px 4px';
    input.style.border = '1px solid #3b82f6';
    input.style.outline = 'none';
    input.style.background = 'white';
    input.style.zIndex = '1000';

    document.body.appendChild(input);
    input.focus();
    input.select();

    const handleBlur = () => {
      onTitleChange(frame.id, input.value);
      setIsEditing(false);
      input.remove();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        handleBlur();
      }
    };

    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeyDown);

    return () => {
      input.removeEventListener('blur', handleBlur);
      input.removeEventListener('keydown', handleKeyDown);
      if (input.parentNode) input.remove();
    };
  }, [isEditing, frame.id, frame.title, frame.width, onTitleChange]);

  return (
    <Group
      x={frame.x}
      y={frame.y}
      draggable
      onDragMove={handleDragMove}
      onDragEnd={(e) => {
        onDragEnd(frame.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(frame.id)}
      onTap={() => onClick?.(frame.id)}
    >
      {/* Frame border */}
      <Rect
        width={frame.width}
        height={frame.height}
        stroke="#94a3b8"
        strokeWidth={2}
        dash={[8, 4]}
        fill="rgba(241, 245, 249, 0.3)"
        cornerRadius={8}
      />
      {/* Title background */}
      <Rect
        x={0}
        y={-28}
        width={frame.width}
        height={28}
        fill="rgba(241, 245, 249, 0.8)"
        cornerRadius={[8, 8, 0, 0]}
      />
      {/* Title text */}
      <Text
        ref={titleRef}
        x={10}
        y={-22}
        text={frame.title || 'Untitled Frame'}
        fontSize={14}
        fontFamily="sans-serif"
        fontStyle="bold"
        fill={frame.title ? '#334155' : '#94a3b8'}
        listening={false}
      />
      {/* Double-click area for title editing */}
      <Rect
        x={0}
        y={-28}
        width={frame.width - 30}
        height={28}
        fill="transparent"
        onDblClick={() => setIsEditing(true)}
        onDblTap={() => setIsEditing(true)}
      />
      {/* Delete button */}
      <Rect
        x={frame.width - 24}
        y={-24}
        width={20}
        height={20}
        fill="transparent"
        onClick={(e) => {
          e.cancelBubble = true;
          onDelete(frame.id);
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onDelete(frame.id);
        }}
      />
      <Text
        x={frame.width - 20}
        y={-24}
        text="x"
        fontSize={14}
        fill="#999"
        listening={false}
      />
    </Group>
  );
}
