import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { Sticker } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';

const DRAG_THROTTLE_MS = 50;
const MIN_SIZE = 50;
const BASE_FONT_SIZE = 145;
const BASE_SIZE = 150;

interface StickerComponentProps {
  sticker: Sticker;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  onResizeEnd?: (id: string, width: number, height: number) => void;
  onRotateEnd?: (id: string, rotation: number) => void;
  dragOffset?: { x: number; y: number };
  parentRotation?: number;
  isNew?: boolean;
  isSelected?: boolean;
  groupDragOffset?: { dx: number; dy: number } | null;
  groupTransformPreview?: GroupTransformPreview | null;
  selectionBox?: SelectionBox | null;
  dragTint?: 'accept' | 'reject' | 'none';
}

export function StickerComponent({
  sticker,
  onDragMove,
  onDragEnd,
  onDelete,
  onDuplicate,
  onClick,
  onResize,
  onRotate,
  onResizeEnd,
  onRotateEnd,
  dragOffset,
  parentRotation,
  isNew,
  isSelected,
  groupDragOffset,
  groupTransformPreview,
  selectionBox,
  dragTint = 'none',
}: StickerComponentProps) {
  const groupRef = useRef<Konva.Group>(null);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const prevSelectedRef = useRef(false);
  const selectionRectRef = useRef<Konva.Rect>(null);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(sticker.width);
  const [localHeight, setLocalHeight] = useState(sticker.height);
  const gifImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(sticker.width);
      setLocalHeight(sticker.height);
    }
  }, [sticker.width, sticker.height, isResizing]);

  // HTML <img> overlay for GIF stickers — browser handles animation natively,
  // no Konva canvas redraws needed. Position synced via CSS matrix() transform.
  useEffect(() => {
    if (!sticker.gifUrl) return;

    const group = groupRef.current;
    if (!group) return;
    const stage = group.getStage();
    if (!stage) return;
    const container = stage.container();

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.src = sticker.gifUrl;
    img.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;transform-origin:0 0;';
    container.appendChild(img);
    gifImgRef.current = img;

    let rafId: number;

    const sync = () => {
      if (!groupRef.current) { rafId = requestAnimationFrame(sync); return; }
      const m = groupRef.current.getAbsoluteTransform().getMatrix();
      img.style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`;
      img.style.width = `${localWidth}px`;
      img.style.height = `${localHeight}px`;
      rafId = requestAnimationFrame(sync);
    };
    rafId = requestAnimationFrame(sync);

    return () => {
      cancelAnimationFrame(rafId);
      img.remove();
      gifImgRef.current = null;
    };
  }, [sticker.gifUrl, localWidth, localHeight]);

  // Drop bounce + flash for new stickers
  useEffect(() => {
    if (!isNew) return;

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
      new Konva.Tween({
        node, duration: 0.6, opacity: 0.5,
        onFinish: () => {
          new Konva.Tween({ node, duration: 0.4, opacity: 0 }).play();
        },
      }).play();
    }
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
      onDragMove(sticker.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
    },
    [sticker.id, onDragMove, localWidth, localHeight]
  );

  const handleResizeDragMove = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    // Enforce square for stickers
    const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 20, e.target.y() + 20));
    setLocalWidth(newSize);
    setLocalHeight(newSize);

    const now = Date.now();
    if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS && onResize) {
      lastResizeUpdate.current = now;
      onResize(sticker.id, newSize, newSize);
    }
  };

  const handleResizeDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    e.cancelBubble = true;
    const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + 20, e.target.y() + 20));
    setLocalWidth(newSize);
    setLocalHeight(newSize);
    (onResizeEnd ?? onResize)?.(sticker.id, newSize, newSize);
    setIsResizing(false);
    e.target.position({ x: newSize - 20, y: newSize - 20 });
  };

  // Calculate live transform offsets for multi-select
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(sticker, selectionBox, groupTransformPreview)
    : null;

  // Scale emoji font size proportionally - make it larger to fill space better
  const fontSize = (localWidth / BASE_SIZE) * BASE_FONT_SIZE;
  // Visible panel trimmed to hug the emoji glyph tighter
  const panelX = localWidth * 0.10;
  const panelHeight = localHeight - localHeight * 0.03;

  return (
    <Group
      ref={groupRef}
      x={sticker.x + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={sticker.y + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(sticker.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(sticker.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(sticker.id)}
      onTap={() => onClick?.(sticker.id)}
      onMouseEnter={(e) => {
        setIsMouseHovered(true);
        const stage = e.target.getStage();
        if (stage && !isDeleteHovered && !isResizeHovered && !isRotateHovered) {
          stage.container().style.cursor = 'grab';
        }
      }}
      onMouseLeave={(e) => {
        setIsMouseHovered(false);
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'default';
      }}
    >
      {/* Hit expansion — prevents onMouseLeave race when reaching action buttons */}
      <Rect x={-30} y={-30} width={localWidth + 60} height={localHeight + 60}
            fill="transparent" listening={true} />
      {/* Transparent background rect for hit detection */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill="transparent"
      />
      {/* Emoji (non-GIF stickers only — GIF rendered as HTML overlay) */}
      {!sticker.gifUrl && (
        <Text
          text={sticker.emoji}
          fontSize={fontSize}
          x={-localWidth * 0.10}
          listening={false}
        />
      )}
      {/* Selection highlight — only for single-select */}
      {isSelected && !selectionBox && (
        <Rect
          ref={selectionRectRef}
          x={panelX}
          width={localWidth - panelX}
          height={panelHeight}
          stroke="#3b82f6"
          strokeWidth={3}
          dash={[8, 4]}
          fill="transparent"
          cornerRadius={16}
          listening={false}
        />
      )}
      {/* Multi-select violet glow */}
      {isSelected && selectionBox && (
        <Rect
          x={panelX}
          width={localWidth - panelX}
          height={panelHeight}
          fill="transparent"
          shadowColor="#8b5cf6"
          shadowBlur={24}
          shadowOpacity={0.5}
          cornerRadius={16}
          listening={false}
        />
      )}
      {/* Drag tint overlay for containment feedback */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={16}
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
          cornerRadius={16}
          listening={false}
        />
      )}
      {/* Duplicate button (top-left) */}
      {onDuplicate && isMouseHovered && (
        <Group
          x={-20}
          y={-20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(sticker.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(sticker.id);
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
      {/* Delete button */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - 20}
          y={-20}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete(sticker.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete(sticker.id);
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
      {/* Rotate handle (bottom-left) */}
      {onRotate && isMouseHovered && (
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
            rotateStartRef.current = { angle: initialAngle, rotation: sticker.rotation || 0 };
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
            onRotate(sticker.id, rotateStartRef.current.rotation + delta);
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
                  (onRotateEnd ?? onRotate)(sticker.id, rotateStartRef.current.rotation + delta);
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
      {/* Resize handle */}
      {onResize && isMouseHovered && (
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
            if (stage) stage.container().style.cursor = 'grab';
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
