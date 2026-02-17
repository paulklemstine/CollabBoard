import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { StickyNote as StickyNoteType } from '../../types/board';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

interface StickyNoteProps {
  note: StickyNoteType;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onConnectorHoverEnter?: (id: string) => void;
  onConnectorHoverLeave?: () => void;
  isConnectorHighlighted?: boolean;
  dragOffset?: { x: number; y: number };
}

export function StickyNoteComponent({ note, onDragMove, onDragEnd, onTextChange, onDelete, onClick, onResize, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, dragOffset }: StickyNoteProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(note.width);
  const [localHeight, setLocalHeight] = useState(note.height);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(note.width);
      setLocalHeight(note.height);
    }
  }, [note.width, note.height, isResizing]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(note.id, e.target.x(), e.target.y());
    },
    [note.id, onDragMove]
  );

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
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${(localWidth - 20) * scale}px`;
    textarea.style.height = `${(localHeight - 20) * scale}px`;
    textarea.style.fontSize = `${14 * scale}px`;
    textarea.style.fontFamily = "'Inter', sans-serif";
    textarea.style.padding = '4px';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.background = 'transparent';
    textarea.style.zIndex = '1000';
    textarea.style.lineHeight = '1.4';
    textarea.style.color = '#1e293b';

    document.body.appendChild(textarea);
    textarea.focus();

    let debounceTimer: ReturnType<typeof setTimeout>;

    const handleInput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onTextChange(note.id, textarea.value);
      }, 300);
    };

    const handleBlur = () => {
      clearTimeout(debounceTimer);
      onTextChange(note.id, textarea.value);
      setIsEditing(false);
      textarea.remove();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleBlur();
      }
    };

    textarea.addEventListener('input', handleInput);
    textarea.addEventListener('blur', handleBlur);
    textarea.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(debounceTimer);
      textarea.removeEventListener('input', handleInput);
      textarea.removeEventListener('blur', handleBlur);
      textarea.removeEventListener('keydown', handleKeyDown);
      if (textarea.parentNode) textarea.remove();
    };
  }, [isEditing, note.id, note.text, localWidth, localHeight, onTextChange]);

  return (
    <Group
      x={note.x + (dragOffset?.x ?? 0)}
      y={note.y + (dragOffset?.y ?? 0)}
      draggable
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(note.id, e.target.x(), e.target.y());
      }}
      onClick={() => onClick?.(note.id)}
      onTap={() => onClick?.(note.id)}
      onDblClick={() => setIsEditing(true)}
      onDblTap={() => setIsEditing(true)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(note.id);
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
      {/* Main note body */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill={note.color}
        cornerRadius={14}
        shadowColor={isConnectorHighlighted ? '#818cf8' : note.color}
        shadowBlur={(isConnectorHighlighted || isMouseHovered) ? 28 : 18}
        shadowOffsetY={(isConnectorHighlighted || isMouseHovered) ? 10 : 6}
        shadowOffsetX={(isConnectorHighlighted || isMouseHovered) ? 2 : 0}
        shadowOpacity={(isConnectorHighlighted || isMouseHovered) ? 0.45 : 0.3}
        stroke={isConnectorHighlighted ? '#818cf8' : (isMouseHovered ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)')}
        strokeWidth={isConnectorHighlighted ? 4 : (isMouseHovered ? 2 : 1.5)}
      />
      {/* Decorative tape strip at top center */}
      <Rect
        x={localWidth / 2 - 24}
        y={-6}
        width={48}
        height={14}
        fill="rgba(255, 255, 255, 0.55)"
        cornerRadius={3}
        shadowColor="rgba(0,0,0,0.06)"
        shadowBlur={4}
        shadowOffsetY={1}
        rotation={-1}
      />
      {/* Folded corner effect */}
      <Rect
        x={localWidth - 22}
        y={localHeight - 22}
        width={22}
        height={22}
        fill="rgba(0,0,0,0.08)"
        cornerRadius={[8, 0, 8, 0]}
      />
      {/* Delete button area (top-right corner) */}
      <Rect
        x={localWidth - 28}
        y={4}
        width={24}
        height={24}
        fill={isDeleteHovered ? 'rgba(239,68,68,0.25)' : 'rgba(0,0,0,0.04)'}
        cornerRadius={8}
        onClick={() => onDelete(note.id)}
        onTap={() => onDelete(note.id)}
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
        x={localWidth - 22}
        y={7}
        text={'\u00d7'}
        fontSize={16}
        fontStyle="bold"
        fill={isDeleteHovered ? '#ef4444' : '#666'}
        listening={false}
      />
      {!isEditing && (
        <Text
          ref={textRef}
          x={10}
          y={10}
          width={localWidth - 20}
          height={localHeight - 20}
          text={note.text || 'Double-click to edit'}
          fontSize={15}
          fontFamily="'Inter', sans-serif"
          fill={note.text ? '#334155' : '#64748b'}
          lineHeight={1.4}
          listening={false}
        />
      )}
      {isEditing && (
        <Text
          ref={textRef}
          x={10}
          y={10}
          width={0}
          height={0}
          text=""
          listening={false}
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
              onResize(note.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 10);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + 10);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            onResize(note.id, newWidth, newHeight);
            setIsResizing(false);
            // Reset handle position to bottom-right of new size
            e.target.position({ x: newWidth - 10, y: newHeight - 10 });
          }}
        />
      )}
    </Group>
  );
}
