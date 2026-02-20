import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { TextObject } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 100;
const BASE_MIN_HEIGHT = 30;

interface TextComponentProps {
  textObj: TextObject;
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

export function TextComponent({
  textObj, onDragMove, onDragEnd, onTextChange, onDelete, onDuplicate, onClick,
  onResize, onRotate, onResizeEnd, onRotateEnd, onConnectorHoverEnter, onConnectorHoverLeave,
  isConnectorHighlighted, isNew, parentRotation, dragOffset,
  isSelected, groupDragOffset, groupTransformPreview, selectionBox,
  dragTint = 'none',
}: TextComponentProps) {
  // Minimum height must fit at least one line of text (fontSize * lineHeight + padding)
  const minHeight = Math.max(BASE_MIN_HEIGHT, Math.ceil(textObj.fontSize * 1.4) + 8);
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
  const [localWidth, setLocalWidth] = useState(textObj.width);
  const [localHeight, setLocalHeight] = useState(textObj.height);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(textObj.width);
      setLocalHeight(textObj.height);
    }
  }, [textObj.width, textObj.height, isResizing]);

  // Auto-fit height to text content (grow and shrink, never below minHeight)
  useEffect(() => {
    if (!textRef.current || isEditing || isResizing) return;
    const node = textRef.current;
    // Temporarily remove height constraint so Konva wraps at the current width but auto-sizes height
    const prevH = node.height();
    node.height(undefined as unknown as number);
    const naturalH = node.height();
    node.height(prevH); // restore
    const neededH = Math.max(minHeight, naturalH + 8); // padding + min
    if (Math.abs(neededH - localHeight) > 1) {
      setLocalHeight(neededH);
      onResize?.(textObj.id, localWidth, neededH);
    }
  }, [textObj.text, textObj.fontSize, textObj.fontFamily, textObj.fontWeight, textObj.fontStyle, localWidth, localHeight, isEditing, isResizing]);

  useEffect(() => {
    if (!isNew || !flashOverlayRef.current) return;
    const node = flashOverlayRef.current;
    let destroyed = false;
    const pulse = (count: number) => {
      if (count >= 3 || destroyed) return;
      const tweenIn = new Konva.Tween({
        node, duration: 0.33, opacity: 0.45, easing: Konva.Easings.EaseInOut,
        onFinish: () => {
          if (destroyed) return;
          const tweenOut = new Konva.Tween({
            node, duration: 0.33, opacity: 0, easing: Konva.Easings.EaseInOut,
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
      onDragMove(textObj.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
    },
    [textObj.id, onDragMove, localWidth, localHeight]
  );

  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(textObj, selectionBox, groupTransformPreview)
    : null;

  // Build Konva fontStyle from fontWeight + fontStyle
  const konvaFontStyle = [
    textObj.fontWeight === 'bold' ? 'bold' : '',
    textObj.fontStyle === 'italic' ? 'italic' : '',
  ].filter(Boolean).join(' ') || 'normal';

  // Inline editing overlay
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
    const rotation = (textObj.rotation || 0) + (parentRotation || 0);

    textarea.value = textObj.text;
    textarea.style.position = 'absolute';
    textarea.style.top = `${stageBox.top + textPosition.y}px`;
    textarea.style.left = `${stageBox.left + textPosition.x}px`;
    textarea.style.width = `${(localWidth - 16) * scale}px`;
    textarea.style.height = `${(localHeight - 8) * scale}px`;
    textarea.style.fontSize = `${textObj.fontSize * scale}px`;
    textarea.style.fontFamily = textObj.fontFamily;
    textarea.style.fontWeight = textObj.fontWeight;
    textarea.style.fontStyle = textObj.fontStyle;
    textarea.style.textAlign = textObj.textAlign;
    textarea.style.padding = '4px';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'transparent';
    textarea.style.zIndex = '1000';
    textarea.style.lineHeight = '1.4';
    textarea.style.color = textObj.color;
    textarea.style.transformOrigin = 'top left';
    textarea.style.transform = `rotate(${rotation}deg)`;

    // Auto-grow textarea height to fit content
    const autoGrow = () => {
      textarea.style.height = 'auto';
      const scrollH = textarea.scrollHeight;
      textarea.style.height = `${scrollH}px`;
      // Grow the component panel to match (convert screen px back to world px)
      const neededH = scrollH / scale + 8; // add padding
      if (neededH > localHeight) {
        setLocalHeight(neededH);
        onResize?.(textObj.id, localWidth, neededH);
      }
    };

    document.body.appendChild(textarea);
    textarea.focus();
    autoGrow(); // initial size

    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleInput = () => {
      autoGrow();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onTextChange(textObj.id, textarea.value), 300);
    };
    const handleBlur = () => {
      clearTimeout(debounceTimer);
      onTextChange(textObj.id, textarea.value);
      autoGrow(); // final resize
      setIsEditing(false);
      textarea.remove();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleBlur();
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
  }, [isEditing, textObj.id, textObj.text, textObj.rotation, textObj.fontSize, textObj.fontFamily, textObj.fontWeight, textObj.fontStyle, textObj.textAlign, textObj.color, localWidth, localHeight, onTextChange, parentRotation]);

  const hasBg = textObj.bgColor && textObj.bgColor !== 'transparent';
  const hasBorder = textObj.borderColor && textObj.borderColor !== 'transparent';

  return (
    <Group
      x={textObj.x + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={textObj.y + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(textObj.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(textObj.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(textObj.id)}
      onTap={() => onClick?.(textObj.id)}
      onDblClick={() => setIsEditing(true)}
      onDblTap={() => setIsEditing(true)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        onConnectorHoverEnter?.(textObj.id);
        const stage = e.target.getStage();
        if (stage && !isDeleteHovered && !isResizeHovered && !isRotateHovered)
          stage.container().style.cursor = 'grab';
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
      {/* Invisible hit area for drag & click events */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill="#000"
        opacity={0}
      />
      {/* Optional background */}
      {hasBg && (
        <Rect
          width={localWidth}
          height={localHeight}
          fill={textObj.bgColor}
          cornerRadius={6}
          stroke={hasBorder ? textObj.borderColor : undefined}
          strokeWidth={hasBorder ? 2 : 0}
        />
      )}
      {/* Hover outline (when no bg) */}
      {!hasBg && isMouseHovered && (
        <Rect
          width={localWidth}
          height={localHeight}
          fill="transparent"
          stroke="#94a3b8"
          strokeWidth={1}
          dash={[4, 3]}
          cornerRadius={4}
          listening={false}
        />
      )}
      {/* Connector highlight */}
      {isConnectorHighlighted && (
        <Rect
          width={localWidth}
          height={localHeight}
          fill="transparent"
          stroke="#818cf8"
          strokeWidth={3}
          cornerRadius={6}
          listening={false}
        />
      )}
      {/* Selection highlight */}
      {isSelected && (
        <Rect
          width={localWidth}
          height={localHeight}
          stroke="#3b82f6"
          strokeWidth={3}
          dash={[8, 4]}
          fill="transparent"
          cornerRadius={6}
          listening={false}
        />
      )}
      {/* Flash overlay */}
      {/* Drag tint overlay for containment feedback */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={6}
          fill={dragTint === 'accept' ? '#22c55e' : '#ef4444'}
          opacity={0.18}
          listening={false}
        />
      )}
      {isNew && (
        <Rect
          ref={flashOverlayRef}
          width={localWidth}
          height={localHeight}
          fill="#22d3ee"
          opacity={0}
          cornerRadius={6}
          listening={false}
        />
      )}
      {/* Text content */}
      {!isEditing && (
        <Text
          ref={textRef}
          x={8}
          y={4}
          width={localWidth - 16}
          height={localHeight - 8}
          text={textObj.text || 'Double-click to type'}
          fontSize={textObj.fontSize}
          fontFamily={textObj.fontFamily}
          fontStyle={konvaFontStyle}
          align={textObj.textAlign}
          fill={textObj.color}
          opacity={textObj.text ? 1 : 0.4}
          lineHeight={1.4}
          listening={false}
        />
      )}
      {isEditing && (
        <Text
          ref={textRef}
          x={8}
          y={4}
          width={0}
          height={0}
          text=""
          listening={false}
        />
      )}
      {/* Duplicate button */}
      {onDuplicate && isMouseHovered && (
        <Group
          x={localWidth - 66}
          y={-20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(textObj.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(textObj.id);
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
            if (stage && isMouseHovered && !isDeleteHovered && !isResizeHovered && !isRotateHovered)
              stage.container().style.cursor = 'grab';
          }}
        >
          <Rect width={40} height={40} fill={isDuplicateHovered ? '#22c55e' : '#94a3b8'} opacity={isDuplicateHovered ? 1 : 0.4} cornerRadius={8} />
          <Text x={0} y={0} width={40} height={40} text={"\uD83D\uDCCB"} fontSize={24} align="center" verticalAlign="middle" listening={false} />
        </Group>
      )}
      {/* Delete button */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - 20}
          y={-20}
          onClick={() => onDelete(textObj.id)}
          onTap={() => onDelete(textObj.id)}
          onMouseEnter={(e) => {
            setIsMouseHovered(true);
            setIsDeleteHovered(true);
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'pointer';
          }}
          onMouseLeave={(e) => {
            setIsDeleteHovered(false);
            const stage = e.target.getStage();
            if (stage && isMouseHovered && !isResizeHovered && !isRotateHovered)
              stage.container().style.cursor = 'grab';
          }}
        >
          <Rect width={40} height={40} fill={isDeleteHovered ? '#ef4444' : '#94a3b8'} opacity={isDeleteHovered ? 1 : 0.4} cornerRadius={8} />
          <Text x={0} y={0} width={40} height={40} text="❌" fontSize={24} align="center" verticalAlign="middle" listening={false} />
        </Group>
      )}
      {/* Rotate handle */}
      {!isEditing && onRotate && isMouseHovered && (
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
            rotateStartRef.current = { angle: initialAngle, rotation: textObj.rotation || 0 };
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
            onRotate(textObj.id, rotateStartRef.current.rotation + delta);
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
                  (onRotateEnd ?? onRotate)(textObj.id, rotateStartRef.current.rotation + delta);
                }
              }
            }
            rotateStartRef.current = null;
            e.target.position({ x: -20, y: localHeight - 20 });
          }}
        >
          <Rect width={40} height={40} fill={isRotateHovered ? '#8b5cf6' : '#94a3b8'} opacity={isRotateHovered ? 1 : 0.4} cornerRadius={8} />
          <Text x={0} y={0} width={40} height={40} text="🔄" fontSize={24} align="center" verticalAlign="middle" listening={false} />
        </Group>
      )}
      {/* Resize handle */}
      {!isEditing && onResize && isMouseHovered && (
        <Group
          x={localWidth - 20}
          y={localHeight - 20}
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
            if (stage && isMouseHovered && !isDeleteHovered)
              stage.container().style.cursor = 'grab';
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 20);
            const newHeight = Math.max(minHeight, e.target.y() + 20);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS) {
              lastResizeUpdate.current = now;
              onResize(textObj.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + 20);
            const newHeight = Math.max(minHeight, e.target.y() + 20);
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            (onResizeEnd ?? onResize)(textObj.id, newWidth, newHeight);
            setIsResizing(false);
            e.target.position({ x: newWidth - 20, y: newHeight - 20 });
          }}
        >
          <Rect width={40} height={40} fill={isResizeHovered ? '#3b82f6' : '#94a3b8'} opacity={isResizeHovered ? 1 : 0.4} cornerRadius={8} />
          <Text x={0} y={0} width={40} height={40} text="↔️" fontSize={24} align="center" verticalAlign="middle" listening={false} />
        </Group>
      )}
    </Group>
  );
}
