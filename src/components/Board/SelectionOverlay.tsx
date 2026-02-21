import { useRef, useCallback, useState, useEffect } from 'react';
import { Group, Rect, Text } from 'react-konva';
import Konva from 'konva';
import type { Marquee, GroupDragOffset, SelectionBox, GroupTransformPreview } from '../../hooks/useMultiSelect';
import { getHandleLayout } from '../../utils/handleLayout';

const SELECTION_PADDING = 8;

interface SelectionOverlayProps {
  marquee: Marquee | null;
  selectedIds: Set<string>;
  selectionBox: SelectionBox | null;
  selectionHidden: boolean;
  groupDragOffset: GroupDragOffset | null;
  transformPreview: GroupTransformPreview | null;
  onGroupDragMove: (dx: number, dy: number) => void;
  onGroupDragEnd: (dx: number, dy: number) => void;
  onGroupResizeMove: (scaleX: number, scaleY: number) => void;
  onGroupResize: (scaleX: number, scaleY: number) => void;
  onGroupRotateMove: (deltaAngle: number) => void;
  onGroupRotate: (deltaAngle: number) => void;
  onDeleteSelected: () => void;
  onDuplicateSelected?: () => void;
}

export function SelectionOverlay({
  marquee,
  selectedIds,
  selectionBox,
  selectionHidden,
  groupDragOffset,
  transformPreview,
  onGroupDragMove,
  onGroupDragEnd,
  onGroupResizeMove,
  onGroupResize,
  onGroupRotateMove,
  onGroupRotate,
  onDeleteSelected,
  onDuplicateSelected,
}: SelectionOverlayProps) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const rotateStartRef = useRef<{ angle: number } | null>(null);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);
  const [isDuplicateHovered, setIsDuplicateHovered] = useState(false);
  const dashAnimRef = useRef<Konva.Rect>(null);

  // Marching ants animation on selection border
  useEffect(() => {
    if (!dashAnimRef.current) return;
    const anim = new Konva.Animation((frame) => {
      if (dashAnimRef.current && frame) {
        dashAnimRef.current.dashOffset(-frame.time * 0.03);
      }
    }, dashAnimRef.current.getLayer());
    anim.start();
    return () => { anim.stop(); };
  }, [selectionBox, selectedIds.size]);

  // Compute display position with drag offset + padding applied
  const box = selectionBox;
  const P = SELECTION_PADDING;
  const displayX = box ? box.x + (groupDragOffset?.dx ?? 0) - P : 0;
  const displayY = box ? box.y + (groupDragOffset?.dy ?? 0) - P : 0;

  // Apply live transform preview + padding
  const displayWidth = box ? box.width * (transformPreview?.scaleX ?? 1) + P * 2 : 0;
  const displayHeight = box ? box.height * (transformPreview?.scaleY ?? 1) + P * 2 : 0;
  const displayRotation = (box?.rotation ?? 0) + (transformPreview?.rotation ?? 0);
  const hl = getHandleLayout(displayWidth, displayHeight);

  const handleBBoxDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      dragStartRef.current = { x: e.target.x(), y: e.target.y() };
    },
    []
  );

  const handleBBoxDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!dragStartRef.current) return;

      const dx = e.target.x() - dragStartRef.current.x;
      const dy = e.target.y() - dragStartRef.current.y;
      onGroupDragMove(dx, dy);
    },
    [onGroupDragMove]
  );

  const handleBBoxDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!dragStartRef.current) return;

      const dx = e.target.x() - dragStartRef.current.x;
      const dy = e.target.y() - dragStartRef.current.y;

      e.target.position(dragStartRef.current);
      dragStartRef.current = null;

      onGroupDragEnd(dx, dy);
    },
    [onGroupDragEnd]
  );

  const handleResizeDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!box) return;
      resizeStartRef.current = {
        x: e.target.x(),
        y: e.target.y(),
        width: box.width,
        height: box.height,
      };
    },
    [box]
  );

  const handleResizeDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!resizeStartRef.current || !box) return;

      const dx = e.target.x() - resizeStartRef.current.x;
      const dy = e.target.y() - resizeStartRef.current.y;

      const scaleX = Math.max(0.1, (resizeStartRef.current.width + dx) / resizeStartRef.current.width);
      const scaleY = Math.max(0.1, (resizeStartRef.current.height + dy) / resizeStartRef.current.height);

      // Clamp handle position so it doesn't detach at min scale
      const clampedX = resizeStartRef.current.x + (scaleX - 1) * resizeStartRef.current.width;
      const clampedY = resizeStartRef.current.y + (scaleY - 1) * resizeStartRef.current.height;
      e.target.position({ x: clampedX, y: clampedY });

      onGroupResizeMove(scaleX, scaleY);
    },
    [box, onGroupResizeMove]
  );

  const handleResizeDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!resizeStartRef.current || !box) return;

      const dx = e.target.x() - resizeStartRef.current.x;
      const dy = e.target.y() - resizeStartRef.current.y;

      const scaleX = Math.max(0.1, (resizeStartRef.current.width + dx) / resizeStartRef.current.width);
      const scaleY = Math.max(0.1, (resizeStartRef.current.height + dy) / resizeStartRef.current.height);

      // Reset handle position (compute layout from box + padding)
      const P = SELECTION_PADDING;
      const resetW = box.width + P * 2;
      const resetH = box.height + P * 2;
      const resetHl = getHandleLayout(resetW, resetH);
      e.target.position({ x: resetW - resetHl.size, y: resetH - resetHl.size });
      resizeStartRef.current = null;

      onGroupResize(scaleX, scaleY);
    },
    [box, onGroupResize]
  );

  const handleRotateDragStart = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!box) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Get the absolute position of the group (center of selection box)
      const group = e.target.getParent();
      if (!group) return;
      const center = group.absolutePosition();

      const initialAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
      rotateStartRef.current = { angle: initialAngle };
    },
    [box]
  );

  const handleRotateDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!rotateStartRef.current || !box) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const group = e.target.getParent();
      if (!group) return;
      const center = group.absolutePosition();

      const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
      const delta = currentAngle - rotateStartRef.current.angle;

      onGroupRotateMove(delta);
      if (box) {
        const P = SELECTION_PADDING;
        const resetH = box.height + P * 2;
        const resetHl = getHandleLayout(box.width + P * 2, resetH);
        e.target.position({ x: 0, y: resetH - resetHl.size });
      }
    },
    [box, onGroupRotateMove]
  );

  const handleRotateDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      e.cancelBubble = true;
      if (!rotateStartRef.current || !box) return;

      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const group = e.target.getParent();
      if (!group) return;
      const center = group.absolutePosition();

      const currentAngle = Math.atan2(pointer.y - center.y, pointer.x - center.x) * (180 / Math.PI);
      const delta = currentAngle - rotateStartRef.current.angle;

      // Reset handle position (compute layout from box + padding)
      const P = SELECTION_PADDING;
      const resetH = box.height + P * 2;
      const resetHl = getHandleLayout(box.width + P * 2, resetH);
      e.target.position({ x: 0, y: resetH - resetHl.size });
      rotateStartRef.current = null;

      onGroupRotate(delta);
    },
    [box, onGroupRotate]
  );

  return (
    <Group>
      {/* Marquee rectangle during drag */}
      {marquee && (
        <Rect
          x={Math.min(marquee.startX, marquee.endX)}
          y={Math.min(marquee.startY, marquee.endY)}
          width={Math.abs(marquee.endX - marquee.startX)}
          height={Math.abs(marquee.endY - marquee.startY)}
          fill="rgba(59, 130, 246, 0.1)"
          stroke="#3b82f6"
          strokeWidth={1}
          dash={[6, 3]}
          listening={false}
        />
      )}

      {/* Selection bounding box with handles — only for multi-select (2+) */}
      {box && selectedIds.size > 1 && !selectionHidden && (
        <Group
          x={displayX + displayWidth / 2}
          y={displayY + displayHeight / 2}
          offsetX={displayWidth / 2}
          offsetY={displayHeight / 2}
          rotation={displayRotation}
          draggable
          onDragStart={handleBBoxDragStart}
          onDragMove={handleBBoxDragMove}
          onDragEnd={handleBBoxDragEnd}
        >
          {/* Dashed selection border — marching ants */}
          <Rect
            ref={dashAnimRef}
            width={displayWidth}
            height={displayHeight}
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[8, 4]}
            fill="transparent"
          />

          {/* Resize handle (bottom-right) */}
          <Group
            x={displayWidth - hl.size}
            y={displayHeight - hl.size}
            draggable
            onDragStart={handleResizeDragStart}
            onDragMove={handleResizeDragMove}
            onDragEnd={handleResizeDragEnd}
          >
            <Rect
              width={hl.size}
              height={hl.size}
              fill="#3b82f6"
              opacity={0.6}
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

          {/* Rotate handle (bottom-left) */}
          <Group
            x={0}
            y={displayHeight - hl.size}
            draggable
            onDragStart={handleRotateDragStart}
            onDragMove={handleRotateDragMove}
            onDragEnd={handleRotateDragEnd}
          >
            <Rect
              width={hl.size}
              height={hl.size}
              fill="#8b5cf6"
              opacity={0.6}
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

          {/* Duplicate button (top-left) */}
          {onDuplicateSelected && (
            <Group
              x={0}
              y={0}
              onClick={(e) => {
                e.cancelBubble = true;
                onDuplicateSelected();
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onDuplicateSelected();
              }}
              onMouseEnter={() => {
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
          <Group
            x={displayWidth - hl.size}
            y={0}
            onClick={(e) => {
              e.cancelBubble = true;
              onDeleteSelected();
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onDeleteSelected();
            }}
            onMouseEnter={() => {
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

          {/* Selection count badge */}
          <Text
            x={4}
            y={-24}
            text={`${selectedIds.size} selected`}
            fontSize={11}
            fontFamily="'Inter', sans-serif"
            fill="#3b82f6"
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
