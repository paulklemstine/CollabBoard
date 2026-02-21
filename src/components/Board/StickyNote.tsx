import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { StickyNote as StickyNoteType } from '../../types/board';
import { getContrastTextColor, getComplementaryColor } from '../../utils/colors';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';
import { getHandleLayout, MAX_HANDLE_SIZE } from '../../utils/handleLayout';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 100;
const MIN_HEIGHT = 100;

interface StickyNoteProps {
  note: StickyNoteType;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onTextChange: (id: string, text: string) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
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

export function StickyNoteComponent({ note, onDragMove, onDragEnd, onTextChange, onDelete, onDuplicate, onClick, onResize, onRotate, onResizeEnd, onRotateEnd, onConnectorHoverEnter, onConnectorHoverLeave, isConnectorHighlighted, isNew, parentRotation, dragOffset, isSelected, groupDragOffset, groupTransformPreview, selectionBox, dragTint = 'none' }: StickyNoteProps) {
  const textRef = useRef<Konva.Text>(null);
  const [isEditing, setIsEditing] = useState(false);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(note.width);
  const [localHeight, setLocalHeight] = useState(note.height);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const groupRef = useRef<Konva.Group>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const resizeHandleSizeRef = useRef(MAX_HANDLE_SIZE);
  const prevSelectedRef = useRef(false);
  const selectionRectRef = useRef<Konva.Rect>(null);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(note.width);
      setLocalHeight(note.height);
    }
  }, [note.width, note.height, isResizing]);

  // Drop bounce + flash pulse for new objects
  useEffect(() => {
    if (!isNew) return;
    let destroyed = false;

    // Scale-bounce on the group
    if (groupRef.current) {
      const g = groupRef.current;
      g.scaleX(0.85);
      g.scaleY(0.85);
      const bounce = new Konva.Tween({
        node: g,
        duration: 0.35,
        scaleX: 1,
        scaleY: 1,
        easing: Konva.Easings.ElasticEaseOut,
      });
      bounce.play();
    }

    // Flash pulse
    if (flashOverlayRef.current) {
      const node = flashOverlayRef.current;
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
    }

    return () => { destroyed = true; };
  }, [isNew]);

  // Selection pop animation
  useEffect(() => {
    if (isSelected && !prevSelectedRef.current && groupRef.current) {
      const g = groupRef.current;
      const pop = new Konva.Tween({
        node: g,
        duration: 0.1,
        scaleX: 1.03,
        scaleY: 1.03,
        easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          new Konva.Tween({
            node: g,
            duration: 0.1,
            scaleX: 1,
            scaleY: 1,
            easing: Konva.Easings.EaseInOut,
          }).play();
        },
      });
      pop.play();
    }
    prevSelectedRef.current = !!isSelected;
  }, [isSelected]);

  const handleDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const now = Date.now();
      if (now - lastDragUpdate.current < DRAG_THROTTLE_MS) return;
      lastDragUpdate.current = now;
      onDragMove(note.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
    },
    [note.id, onDragMove, localWidth, localHeight]
  );

  // Calculate live transform when part of a multi-select group
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(note, selectionBox, groupTransformPreview)
    : null;

  // Stable refs for editing overlay — prevents textarea recreation on Firestore updates
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;
  const noteRef = useRef(note);
  noteRef.current = note;
  const localWidthRef = useRef(localWidth);
  localWidthRef.current = localWidth;
  const localHeightRef = useRef(localHeight);
  localHeightRef.current = localHeight;

  // Inline editing overlay — only create/destroy when isEditing toggles
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
    const n = noteRef.current;

    const textColor = n.textColor || getContrastTextColor(n.color);

    // Calculate display rotation (note rotation + parent rotation)
    const rotation = (n.rotation || 0) + (parentRotation || 0);

    textarea.value = n.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${(localWidthRef.current - 20) * scale}px`;
    textarea.style.height = `${(localHeightRef.current - 20) * scale}px`;
    textarea.style.fontSize = `${(n.fontSize ?? 15) * scale}px`;
    textarea.style.fontFamily = n.fontFamily || "'Inter', sans-serif";
    textarea.style.fontWeight = n.fontWeight === 'bold' ? '700' : '400';
    textarea.style.fontStyle = n.fontStyle === 'italic' ? 'italic' : 'normal';
    textarea.style.textAlign = n.textAlign || 'left';
    textarea.style.padding = '4px';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.background = 'transparent';
    textarea.style.zIndex = '1000';
    textarea.style.lineHeight = '1.4';
    textarea.style.color = textColor;
    textarea.style.transformOrigin = 'top left';
    textarea.style.transform = `rotate(${rotation}deg)`;

    document.body.appendChild(textarea);
    textarea.focus();

    let debounceTimer: ReturnType<typeof setTimeout>;

    const handleInput = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        onTextChangeRef.current(noteRef.current.id, textarea.value);
      }, 300);
    };

    const handleBlur = () => {
      clearTimeout(debounceTimer);
      onTextChangeRef.current(noteRef.current.id, textarea.value);
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
  // Only recreate textarea when editing starts/stops — use refs for everything else
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const hl = getHandleLayout(localWidth, localHeight);

  return (
    <Group
      ref={groupRef}
      x={note.x + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={note.y + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(note.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={() => {
      }}
      onDragEnd={(e) => {
        onDragEnd(note.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(note.id)}
      onTap={() => onClick?.(note.id)}
      onDblClick={() => setIsEditing(true)}
      onDblTap={() => setIsEditing(true)}
      onMouseEnter={() => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(note.id);
      }}
      onMouseLeave={() => {
        setIsMouseHovered(false);
        onConnectorHoverLeave?.();
      }}
    >
      {/* Hit expansion — prevents onMouseLeave race when reaching action buttons */}
      <Rect x={-30} y={-30} width={localWidth + 60} height={localHeight + 60}
            fill="transparent" listening={true} />
      {/* Main note body */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill={note.color}
        cornerRadius={14}
        shadowColor={isSelected && selectionBox ? '#8b5cf6' : (isConnectorHighlighted ? '#818cf8' : note.color)}
        shadowBlur={isSelected && selectionBox ? 24 : ((isConnectorHighlighted || isMouseHovered) ? 28 : 18)}
        shadowOffsetY={(isConnectorHighlighted || isMouseHovered) ? 10 : 6}
        shadowOffsetX={(isConnectorHighlighted || isMouseHovered) ? 2 : 0}
        shadowOpacity={isSelected && selectionBox ? 0.5 : ((isConnectorHighlighted || isMouseHovered) ? 0.45 : 0.3)}
        stroke={isConnectorHighlighted ? '#818cf8' : (note.borderColor || getComplementaryColor(note.color))}
        strokeWidth={isConnectorHighlighted ? 4 : (note.borderColor ? 2.5 : 3)}
      />
      {/* Hover tint overlay */}
      {isMouseHovered && !isSelected && !isConnectorHighlighted && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={14}
          fill="#3b82f6"
          opacity={0.12}
          listening={false}
        />
      )}
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
          cornerRadius={14}
          listening={false}
        />
      )}
      {/* Drag tint overlay for containment feedback */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={8}
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
          cornerRadius={14}
          listening={false}
        />
      )}
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
      {/* Duplicate button (top-left) */}
      {onDuplicate && isMouseHovered && (
        <Group
          x={0}
          y={0}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(note.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(note.id);
          }}
          onMouseEnter={() => {
            setIsMouseHovered(true);
            setIsDuplicateHovered(true);
          }}
          onMouseLeave={() => {
            setIsDuplicateHovered(false);
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isDuplicateHovered ? '#22c55e' : '#94a3b8'}
            opacity={isDuplicateHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text={"\uD83D\uDCCB"}
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Delete button area (top-right corner) */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={0}
          onClick={() => onDelete(note.id)}
          onTap={() => onDelete(note.id)}
          onMouseEnter={() => {
            setIsMouseHovered(true);
            setIsDeleteHovered(true);
          }}
          onMouseLeave={() => {
            setIsDeleteHovered(false);
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isDeleteHovered ? '#ef4444' : '#94a3b8'}
            opacity={isDeleteHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="❌"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {!isEditing && (
        <Text
          ref={textRef}
          x={10}
          y={10}
          width={localWidth - 20}
          height={localHeight - 20}
          text={note.text || 'Double-click to edit'}
          fontSize={note.fontSize ?? 15}
          fontFamily={note.fontFamily || "'Inter', sans-serif"}
          fontStyle={`${note.fontWeight === 'bold' ? 'bold' : 'normal'}${note.fontStyle === 'italic' ? ' italic' : ''}`}
          align={note.textAlign || 'left'}
          fill={note.textColor || getContrastTextColor(note.color)}
          opacity={note.text ? 1 : 0.5}
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
      {/* Rotate handle (bottom-left) */}
      {!isEditing && onRotate && isMouseHovered && (
        <Group
          x={0}
          y={localHeight - hl.size}
          draggable
          onMouseEnter={() => {
            setIsMouseHovered(true);
            setIsRotateHovered(true);
          }}
          onMouseLeave={() => {
            setIsRotateHovered(false);
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
            rotateStartRef.current = { angle: initialAngle, rotation: note.rotation || 0 };
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
            onRotate(note.id, rotateStartRef.current.rotation + delta);
            e.target.position({ x: 0, y: localHeight - hl.size });
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
                  (onRotateEnd ?? onRotate)(note.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: 0, y: localHeight - hl.size });
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'}
            opacity={isRotateHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="🔄"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle */}
      {!isEditing && onResize && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={localHeight - hl.size}
          draggable
          onMouseEnter={() => {
            setIsMouseHovered(true);
            setIsResizeHovered(true);
          }}
          onMouseLeave={() => {
            setIsResizeHovered(false);
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
            resizeHandleSizeRef.current = hl.size;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const hs = resizeHandleSizeRef.current;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + hs);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + hs);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            // Clamp handle to component edge so it doesn't detach at min size
            e.target.position({ x: newWidth - hs, y: newHeight - hs });
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS) {
              lastResizeUpdate.current = now;
              onResize(note.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + resizeHandleSizeRef.current);
            const newHeight = Math.max(MIN_HEIGHT, e.target.y() + resizeHandleSizeRef.current);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            (onResizeEnd ?? onResize)(note.id, newWidth, newHeight);
            setIsResizing(false);
            // Reset handle position to bottom-right of new size
            const newHl = getHandleLayout(newWidth, newHeight);
            e.target.position({ x: newWidth - newHl.size, y: newHeight - newHl.size });
          }}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
            opacity={isResizeHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            x={0}
            y={0}
            width={hl.size}
            height={hl.size}
            text="↔️"
            fontSize={hl.fontSize}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
