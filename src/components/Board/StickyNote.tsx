import { useRef, useState, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { StickyNote as StickyNoteType } from '../../types/board';

interface StickyNoteProps {
  note: StickyNoteType;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
}

export function StickyNoteComponent({ note, onDragEnd, onTextChange, onDelete }: StickyNoteProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) return;

    const stage = textRef.current?.getStage();
    if (!stage) return;
    const container = stage.container();

    const textarea = document.createElement('textarea');
    const textNode = textRef.current!;
    const textPosition = textNode.absolutePosition();
    const stageBox = container.getBoundingClientRect();
    const scale = stage.scaleX();

    textarea.value = note.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPosition.y * scale}px`;
    textarea.style.left = `${stageBox.left + textPosition.x * scale}px`;
    textarea.style.width = `${(note.width - 20) * scale}px`;
    textarea.style.height = `${(note.height - 20) * scale}px`;
    textarea.style.fontSize = `${14 * scale}px`;
    textarea.style.fontFamily = 'sans-serif';
    textarea.style.padding = '4px';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.background = 'transparent';
    textarea.style.zIndex = '1000';
    textarea.style.lineHeight = '1.4';

    document.body.appendChild(textarea);
    textarea.focus();

    const handleBlur = () => {
      onTextChange(note.id, textarea.value);
      setIsEditing(false);
      textarea.remove();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBlur();
      }
    };

    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('keydown', handleKeyDown);
      if (textarea.parentNode) textarea.remove();
    };
  }, [isEditing, note.id, note.text, note.width, note.height, onTextChange]);

  return (
    <Group
      x={note.x}
      y={note.y}
      draggable
      onDragEnd={(e) => {
        onDragEnd(note.id, e.target.x(), e.target.y());
      }}
      onDblClick={() => setIsEditing(true)}
      onDblTap={() => setIsEditing(true)}
    >
      <Rect
        width={note.width}
        height={note.height}
        fill={note.color}
        cornerRadius={4}
        shadowColor="rgba(0,0,0,0.15)"
        shadowBlur={8}
        shadowOffsetY={2}
      />
      {/* Delete button area (top-right corner) */}
      <Rect
        x={note.width - 24}
        y={4}
        width={20}
        height={20}
        fill="transparent"
        onClick={() => onDelete(note.id)}
        onTap={() => onDelete(note.id)}
      />
      <Text
        x={note.width - 20}
        y={4}
        text="x"
        fontSize={14}
        fill="#999"
        listening={false}
      />
      <Text
        ref={textRef}
        x={10}
        y={10}
        width={note.width - 20}
        height={note.height - 20}
        text={note.text || (isEditing ? '' : 'Double-click to edit')}
        fontSize={14}
        fontFamily="sans-serif"
        fill={note.text ? '#333' : '#999'}
        lineHeight={1.4}
        listening={false}
      />
    </Group>
  );
}
