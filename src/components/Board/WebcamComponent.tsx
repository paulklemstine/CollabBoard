import { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Text, Rect } from 'react-konva';
import Konva from 'konva';
import type { Webcam } from '../../types/board';
import { calculateGroupObjectTransform } from '../../utils/groupTransform';
import type { GroupTransformPreview, SelectionBox } from '../../hooks/useMultiSelect';
import { useMarchingAnts } from '../../hooks/useMarchingAnts';
import { getHandleLayout } from '../../utils/handleLayout';

const DRAG_THROTTLE_MS = 50;
const MIN_WIDTH = 80;
const ASPECT_RATIO = 0.75; // 4:3

interface WebcamComponentProps {
  webcam: Webcam;
  mediaStream: MediaStream | null;
  isMine: boolean;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string, x: number, y: number) => void;
  onDelete?: (id: string) => void;
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

export function WebcamComponent({
  webcam,
  mediaStream,
  isMine,
  onDragMove,
  onDragEnd,
  onDelete,
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
}: WebcamComponentProps) {
  const groupRef = useRef<Konva.Group>(null);
  const flashOverlayRef = useRef<Konva.Rect>(null);
  const rotateStartRef = useRef<{ angle: number; rotation: number } | null>(null);
  const prevSelectedRef = useRef(false);
  const selectionRectRef = useRef<Konva.Rect>(null);
  useMarchingAnts(selectionRectRef, !!isSelected && !selectionBox);
  const lastDragUpdate = useRef(0);
  const lastResizeUpdate = useRef(0);
  const resizeHandleSizeRef = useRef(0);
  const [isMouseHovered, setIsMouseHovered] = useState(false);
  const [isResizeHovered, setIsResizeHovered] = useState(false);
  const [isRotateHovered, setIsRotateHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const safeWidth = Number.isFinite(webcam.width) ? webcam.width : 320;
  const safeHeight = Number.isFinite(webcam.height) ? webcam.height : 240;
  const safeX = Number.isFinite(webcam.x) ? webcam.x : 0;
  const safeY = Number.isFinite(webcam.y) ? webcam.y : 0;

  const [localWidth, setLocalWidth] = useState(safeWidth);
  const [localHeight, setLocalHeight] = useState(safeHeight);
  const localSizeRef = useRef({ w: safeWidth, h: safeHeight });

  useEffect(() => {
    if (!isResizing) {
      setLocalWidth(safeWidth);
      setLocalHeight(safeHeight);
    }
  }, [safeWidth, safeHeight, isResizing]);

  useEffect(() => {
    localSizeRef.current = { w: localWidth, h: localHeight };
  }, [localWidth, localHeight]);

  // HTML <video> overlay — browser handles video natively,
  // position synced via CSS matrix() transform (same as GIF stickers).
  useEffect(() => {
    if (!mediaStream) return;

    let rafId: number;
    let video: HTMLVideoElement | null = null;

    const tryMount = () => {
      const group = groupRef.current;
      if (!group || !group.getStage()) {
        rafId = requestAnimationFrame(tryMount);
        return;
      }
      const container = group.getStage()!.container();
      video = document.createElement('video');
      video.srcObject = mediaStream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = isMine; // Mute own feed to prevent echo
      video.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;transform-origin:0 0;object-fit:cover;border-radius:12px;';
      container.appendChild(video);
      rafId = requestAnimationFrame(sync);
    };

    const sync = () => {
      if (!groupRef.current || !video) {
        rafId = requestAnimationFrame(sync);
        return;
      }
      const m = groupRef.current.getAbsoluteTransform().getMatrix();
      video.style.transform = `matrix(${m[0]},${m[1]},${m[2]},${m[3]},${m[4]},${m[5]})`;
      video.style.width = `${localSizeRef.current.w}px`;
      video.style.height = `${localSizeRef.current.h}px`;
      rafId = requestAnimationFrame(sync);
    };

    rafId = requestAnimationFrame(tryMount);

    return () => {
      cancelAnimationFrame(rafId);
      if (video) video.remove();
    };
  }, [mediaStream, isMine]);

  // Drop bounce + flash for new webcams
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
      onDragMove(webcam.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
    },
    [webcam.id, onDragMove, localWidth, localHeight]
  );

  // Calculate live transform offsets for multi-select
  const liveTransform = groupTransformPreview && selectionBox
    ? calculateGroupObjectTransform(webcam, selectionBox, groupTransformPreview)
    : null;

  const hl = getHandleLayout(localWidth, localHeight);
  const labelHeight = 28;

  return (
    <Group
      ref={groupRef}
      x={safeX + (dragOffset?.x ?? 0) + (groupDragOffset?.dx ?? 0) + (liveTransform?.orbitOffset.x ?? 0) + localWidth / 2}
      y={safeY + (dragOffset?.y ?? 0) + (groupDragOffset?.dy ?? 0) + (liveTransform?.orbitOffset.y ?? 0) + localHeight / 2}
      offsetX={localWidth / 2}
      offsetY={localHeight / 2}
      scaleX={liveTransform?.scaleX ?? 1}
      scaleY={liveTransform?.scaleY ?? 1}
      rotation={(webcam.rotation || 0) + (parentRotation || 0) + (liveTransform?.rotationDelta ?? 0)}
      draggable={!groupDragOffset}
      onDragMove={handleDragMove}
      onDragStart={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = 'grabbing';
      }}
      onDragEnd={(e) => {
        const stage = e.target.getStage();
        if (stage) stage.container().style.cursor = isMouseHovered ? 'grab' : 'default';
        onDragEnd(webcam.id, e.target.x() - localWidth / 2, e.target.y() - localHeight / 2);
      }}
      onClick={() => onClick?.(webcam.id)}
      onTap={() => onClick?.(webcam.id)}
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
      {/* Hit expansion */}
      <Rect x={-30} y={-30} width={localWidth + 60} height={localHeight + 60 + labelHeight}
            fill="transparent" listening={true} />

      {/* Dark background (visible when no stream / offline) */}
      <Rect
        width={localWidth}
        height={localHeight}
        fill="#1e1e2e"
        cornerRadius={12}
      />

      {/* Offline placeholder when no stream */}
      {!mediaStream && (
        <>
          {/* Camera icon */}
          <Text
            text={"\uD83D\uDCF7"}
            fontSize={Math.min(localWidth, localHeight) * 0.25}
            width={localWidth}
            height={localHeight * 0.6}
            y={localHeight * 0.1}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
          {/* Offline text */}
          <Text
            text="Offline"
            fontSize={14}
            fill="#94a3b8"
            width={localWidth}
            y={localHeight * 0.65}
            align="center"
            listening={false}
          />
        </>
      )}

      {/* Name label at bottom */}
      <Rect
        x={0}
        y={localHeight}
        width={localWidth}
        height={labelHeight}
        fill="rgba(30, 30, 46, 0.8)"
        cornerRadius={[0, 0, 8, 8]}
        listening={false}
      />
      <Text
        text={webcam.label}
        fontSize={13}
        fill="#e2e8f0"
        x={8}
        y={localHeight + 6}
        width={localWidth - 16}
        ellipsis={true}
        wrap="none"
        listening={false}
      />

      {/* Selection highlight — single-select */}
      {isSelected && !selectionBox && (
        <Rect
          ref={selectionRectRef}
          x={-2}
          y={-2}
          width={localWidth + 4}
          height={localHeight + labelHeight + 4}
          stroke="#3b82f6"
          strokeWidth={3}
          dash={[8, 4]}
          fill="transparent"
          cornerRadius={14}
          listening={false}
        />
      )}
      {/* Multi-select violet glow */}
      {isSelected && selectionBox && (
        <Rect
          x={-2}
          y={-2}
          width={localWidth + 4}
          height={localHeight + labelHeight + 4}
          fill="transparent"
          shadowColor="#8b5cf6"
          shadowBlur={24}
          shadowOpacity={0.5}
          cornerRadius={14}
          listening={false}
        />
      )}
      {/* Drag tint overlay */}
      {dragTint !== 'none' && (
        <Rect
          width={localWidth}
          height={localHeight}
          cornerRadius={12}
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
          fill="#3b82f6"
          opacity={0}
          cornerRadius={12}
          listening={false}
        />
      )}

      {/* Delete button (top-right) — inside bounds */}
      {onDelete && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={0}
          onClick={(e) => {
            e.cancelBubble = true;
            onDelete(webcam.id);
          }}
          onTap={(e) => {
            e.cancelBubble = true;
            onDelete(webcam.id);
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

      {/* Rotate handle (bottom-left) — inside bounds */}
      {onRotate && isMouseHovered && (
        <Group
          x={0}
          y={localHeight - hl.size}
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
            rotateStartRef.current = { angle: initialAngle, rotation: webcam.rotation || 0 };
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
            onRotate(webcam.id, rotateStartRef.current.rotation + delta);
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
                  (onRotateEnd ?? onRotate)(webcam.id, rotateStartRef.current.rotation + delta);
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

      {/* Resize handle (bottom-right) — inside bounds, enforces 4:3 */}
      {onResize && isMouseHovered && (
        <Group
          x={localWidth - hl.size}
          y={localHeight - hl.size}
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
            if (stage && isMouseHovered && !isDeleteHovered) {
              stage.container().style.cursor = 'grab';
            }
          }}
          onDragStart={(e) => {
            e.cancelBubble = true;
            setIsResizing(true);
            resizeHandleSizeRef.current = hl.size;
          }}
          onDragMove={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + resizeHandleSizeRef.current);
            const newHeight = newWidth * ASPECT_RATIO;
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            const now = Date.now();
            if (now - lastResizeUpdate.current >= DRAG_THROTTLE_MS && onResize) {
              lastResizeUpdate.current = now;
              onResize(webcam.id, newWidth, newHeight);
            }
          }}
          onDragEnd={(e) => {
            e.cancelBubble = true;
            const newWidth = Math.max(MIN_WIDTH, e.target.x() + resizeHandleSizeRef.current);
            const newHeight = newWidth * ASPECT_RATIO;
            setLocalWidth(newWidth);
            setLocalHeight(newHeight);
            (onResizeEnd ?? onResize)?.(webcam.id, newWidth, newHeight);
            setIsResizing(false);
            e.target.position({ x: newWidth - resizeHandleSizeRef.current, y: newHeight - resizeHandleSizeRef.current });
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
