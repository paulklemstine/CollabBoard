import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { Sticker } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';
import { getHandleLayout, MAX_HANDLE_SIZE } from '../../utils/handleLayout';

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
  const resizeHandleSizeRef = useRef(MAX_HANDLE_SIZE);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const safeWidth = Number.isFinite(sticker.width) ? sticker.width : BASE_SIZE;
  const safeHeight = Number.isFinite(sticker.height) ? sticker.height : BASE_SIZE;
  const safeX = Number.isFinite(sticker.x) ? sticker.x : 0;
  const safeY = Number.isFinite(sticker.y) ? sticker.y : 0;
  const [localWidth, setLocalWidth] = useState(safeWidth);
  const [localHeight, setLocalHeight] = useState(safeHeight);
  const gifImgRef = useRef<HTMLImageElement | null>(null);
  const localSizeRef = useRef({ w: safeWidth, h: safeHeight });

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(safeWidth);
      setLocalHeight(safeHeight);
    }
  }, [safeWidth, safeHeight, isResizing]);

  // Keep ref in sync so the RAF loop reads latest dimensions without re-running the effect
  useEffect(() => {
    localSizeRef.current = { w: localWidth, h: localHeight };
  }, [localWidth, localHeight]);

  // HTML <img> overlay for GIF stickers — browser handles animation natively,
  // no Konva canvas redraws needed. Position synced via CSS matrix() transform.
  useEffect(() => {
    if (!sticker.gifUrl) return;

    // Defer overlay creation until the Konva Group is mounted and has a stage
    let rafId: number;
    let img: HTMLImageElement | null = null;

    const tryMount = () => {
      const group = groupRef.current;
      if (!group || !group.getStage()) {
        rafId = requestAnimationFrame(tryMount);
        return;
      }
      const container = group.getStage()!.container();
      img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.src = sticker.gifUrl!;
      img.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;transform-origin:0 0;';
      container.appendChild(img);
      gifImgRef.current = img;
      rafId = requestAnimationFrame(sync);
    };

    const sync = () => {
      if (!groupRef.current || !img) { rafId = requestAnimationFrame(sync); return; }
      const m = groupRef.current.getAbsoluteTransform().getMatrix();
      img.style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`;
      img.style.width = `${localSizeRef.current.w}px`;
      img.style.height = `${localSizeRef.current.h}px`;
      rafId = requestAnimationFrame(sync);
    };

    rafId = requestAnimationFrame(tryMount);

    return () => {
      cancelAnimationFrame(rafId);
      if (img) img.remove();
      gifImgRef.current = null;
    };
  }, [sticker.gifUrl]);

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
    const hs = resizeHandleSizeRef.current;
    const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + hs, e.target.y() + hs));
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
    const hs = resizeHandleSizeRef.current;
    const newSize = Math.max(MIN_SIZE, Math.max(e.target.x() + hs, e.target.y() + hs));
    setLocalWidth(newSize);
    setLocalHeight(newSize);
    (onResizeEnd ?? onResize)?.(sticker.id, newSize, newSize);
    setIsResizing(false);
    const newHl = getHandleLayout(newSize, newSize);
    e.target.position({ x: newSize - newHl.size, y: newSize - newHl.size });
  };

  // Calculate live transform offsets for multi-select
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(sticker, selectionBox, groupTransformPreview)
    : null;

  const hl = getHandleLayout(localWidth, localHeight);

  // Scale emoji font size proportionally - make it larger to fill space better
  const fontSize = (localWidth / BASE_SIZE) * BASE_FONT_SIZE;
  // Visible panel trimmed to hug the emoji glyph tighter
  const panelX = localWidth * 0.10;
  const panelHeight = localHeight - localHeight * 0.03;

  return (
    <Group
      ref={groupRef}
      x={safeX + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={safeY + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(sticker.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={() => {
      }}
      onDragEnd={(e) => {
        onDragEnd(sticker.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(sticker.id)}
      onTap={() => onClick?.(sticker.id)}
      onMouseEnter={() => {
        setIsMouseHovered(true);
      }}
      onMouseLeave={() => {
        setIsMouseHovered(false);
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
      {/* Hover highlight */}
      {isMouseHovered && !isSelected && (
        <Rect
          x={panelX}
          width={localWidth - panelX + localWidth * 0.05}
          height={panelHeight}
          fill="transparent"
          stroke="#a78bfa"
          strokeWidth={2}
          cornerRadius={16}
          shadowColor="#8b5cf6"
          shadowBlur={16}
          shadowOpacity={0.35}
          listening={false}
        />
      )}
      {/* Selection highlight — only for single-select */}
      {isSelected && !selectionBox && (
        <Rect
          ref={selectionRectRef}
          x={panelX}
          width={localWidth - panelX + localWidth * 0.05}
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
          width={localWidth - panelX + localWidth * 0.05}
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
          x={0}
          y={0}
          onClick={(e) => {
            e.cancelBubble = true;
            onDuplicate(sticker.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDuplicate(sticker.id);
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
            text={"\uD83D\uDCCB"}
            fontSize={hl.fontSize}
            width={hl.size}
            height={hl.size}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Delete button (top-right) */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={0}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete(sticker.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete(sticker.id);
          }}
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
            text="❌"
            fontSize={hl.fontSize}
            width={hl.size}
            height={hl.size}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Rotate handle (bottom-left) */}
      {onRotate && isMouseHovered && (
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
                  (onRotateEnd ?? onRotate)(sticker.id, rotateStartRef.current.rotation + delta);
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
            text="🔄"
            fontSize={hl.fontSize}
            width={hl.size}
            height={hl.size}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
      {/* Resize handle (bottom-right) */}
      {onResize && isMouseHovered && (
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
          onDragMove={handleResizeDragMove}
          onDragEnd={handleResizeDragEnd}
        >
          <Rect
            width={hl.size}
            height={hl.size}
            fill={isResizeHovered ? '#3b82f6' : '#94a3b8'}
            opacity={isResizeHovered ? 1 : 0.4}
            cornerRadius={hl.cornerRadius}
          />
          <Text
            text="↔️"
            fontSize={hl.fontSize}
            width={hl.size}
            height={hl.size}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
