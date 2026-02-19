import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect, Image } from 'react-konva';
import Konva from 'konva';
import type { Sticker } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';

const DRAG_THROTTLE_MS = 50;
const MIN_SIZE = 50;
const BASE_FONT_SIZE = 120;
const BASE_SIZE = 150;

interface StickerComponentProps {
  sticker: Sticker;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
  onClick?: (id: string) => void;
  onResize?: (id: string, width: number, height: number) => void;
  onRotate?: (id: string, rotation: number) => void;
  dragOffset?: { x: number; y: number };
  parentRotation?: number;
  isNew?: boolean;
  isSelected?: boolean;
  groupDragOffset?: { dx: number; dy: number } | null;
  groupTransformPreview?: GroupTransformPreview | null;
  selectionBox?: SelectionBox | null;
}

export function StickerComponent({
  sticker,
  onDragMove,
  onDragEnd,
  onDelete,
  onClick,
  onResize,
  onRotate,
  dragOffset,
  parentRotation,
  isNew,
  isSelected,
  groupDragOffset,
  groupTransformPreview,
  selectionBox
}: StickerComponentProps) {
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [localWidth, setLocalWidth] = useState(sticker.width);
  const [localHeight, setLocalHeight] = useState(sticker.height);
  const [gifCanvas, setGifCanvas] = useState<HTMLCanvasElement | null>(null);
  const gifImageRef = useRef<Konva.Image>(null);
  const gifAnimRef = useRef<number>(0);

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(sticker.width);
      setLocalHeight(sticker.height);
    }
  }, [sticker.width, sticker.height, isResizing]);

  // Animate GIF: append a hidden <img> to the DOM so the browser decodes
  // and advances GIF frames, then continuously capture them onto a canvas
  // for Konva to render.
  useEffect(() => {
    if (!sticker.gifUrl) {
      setGifCanvas(null);
      return;
    }

    const img = document.createElement('img');
    // Hide the img but keep it in the DOM so the browser animates GIF frames
    img.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;pointer-events:none;opacity:0;';
    document.body.appendChild(img);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let stopped = false;

    img.onload = () => {
      if (stopped) return;
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      setGifCanvas(canvas);

      // Animation loop: draw current img frame onto canvas, then tell Konva to update
      const tick = () => {
        if (stopped) return;
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
        }
        gifImageRef.current?.getLayer()?.batchDraw();
        gifAnimRef.current = requestAnimationFrame(tick);
      };
      gifAnimRef.current = requestAnimationFrame(tick);
    };
    img.onerror = () => setGifCanvas(null);
    img.src = sticker.gifUrl;

    return () => {
      stopped = true;
      cancelAnimationFrame(gifAnimRef.current);
      img.src = '';
      img.remove();
    };
  }, [sticker.gifUrl]);

  // Flash animation for new stickers
  useEffect(() => {
    if (isNew && flashOverlayRef.current) {
      const tween = new Konva.Tween({
        node: flashOverlayRef.current,
        duration: 0.6,
        opacity: 0.5,
        onFinish: () => {
          const fadeOut = new Konva.Tween({
            node: flashOverlayRef.current!,
            duration: 0.4,
            opacity: 0,
          });
          fadeOut.play();
        },
      });
      tween.play();
    }
  }, [isNew]);

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
    onResize?.(sticker.id, newSize, newSize);
    setIsResizing(false);
    e.target.position({ x: newSize - 20, y: newSize - 20 });
  };

  // Calculate live transform offsets for multi-select
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(sticker, selectionBox, groupTransformPreview)
    : null;

  // Scale emoji font size proportionally - make it larger to fill space better
  const fontSize = (localWidth / BASE_SIZE) * BASE_FONT_SIZE;

  return (
    <Group
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
      {/* Transparent background rect for hit detection */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill="transparent"
      />
      {/* GIF or Emoji */}
      {sticker.gifUrl ? (
        gifCanvas ? (
          <Image
            ref={gifImageRef}
            image={gifCanvas}
            width={localWidth}
            height={localHeight}
            listening={false}
          />
        ) : (
          <Rect width={localWidth} height={localHeight} fill="#e5e7eb" cornerRadius={8} listening={false} />
        )
      ) : (
        <Text
          text={sticker.emoji}
          fontSize={fontSize}
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
          cornerRadius={16}
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
                  onRotate(sticker.id, rotateStartRef.current.rotation + delta);
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
