import { useRef, useCallback, useState } from 'react';
import { Group, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { Marquee, GroupDragOffset, SelectionBox, GroupTransformPreview } from '../../hooks/useMultiSelect';

const HANDLE_SIZE = 16;

interface SelectionOverlayProps {
  marquee: Marquee | null;
  selectedIds: Set<string>;
  selectionBox: SelectionBox | null;
  groupDragOffset: GroupDragOffset | null;
  transformPreview: GroupTransformPreview | null;
  onGroupDragMove: (dx: number, dy: number) => void;
  onGroupDragEnd: (dx: number, dy: number) => void;
  onGroupResizeMove: (scaleX: number, scaleY: number) => void;
  onGroupResize: (scaleX: number, scaleY: number) => void;
  onGroupRotateMove: (deltaAngle: number) => void;
  onGroupRotate: (deltaAngle: number) => void;
  onDeleteSelected: () => void;
}

export function SelectionOverlay({
  marquee,
  selectedIds,
  selectionBox,
  groupDragOffset,
  transformPreview,
  onGroupDragMove,
  onGroupDragEnd,
  onGroupResizeMove,
  onGroupResize,
  onGroupRotateMove,
  onGroupRotate,
  onDeleteSelected,
}: SelectionOverlayProps) {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const rotateStartRef = useRef<{ angle: number } | null>(null);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  // Compute display position with drag offset applied
  const box = selectionBox;
  const displayX = box ? box.x + (groupDragOffset?.dx ?? 0) : 0;
  const displayY = box ? box.y + (groupDragOffset?.dy ?? 0) : 0;

  // Apply live transform preview
  const displayWidth = box ? box.width * (transformPreview?.scaleX ?? 1) : 0;
  const displayHeight = box ? box.height * (transformPreview?.scaleY ?? 1) : 0;
  const displayRotation = (box?.rotation ?? 0) + (transformPreview?.rotation ?? 0);

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

      // Reset handle position
      e.target.position({ x: box.width - HANDLE_SIZE / 2, y: box.height - HANDLE_SIZE / 2 });
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

      // Reset handle position
      e.target.position({ x: -HANDLE_SIZE / 2, y: box.height - HANDLE_SIZE / 2 });
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
      {box && selectedIds.size > 1 && (
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
          onMouseEnter={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'move';
          }}
          onMouseLeave={(e) => {
            const stage = e.target.getStage();
            if (stage) stage.container().style.cursor = 'default';
          }}
        >
          {/* Dashed selection border */}
          <Rect
            width={displayWidth}
            height={displayHeight}
            stroke="#3b82f6"
            strokeWidth={2}
            dash={[8, 4]}
            fill="transparent"
          />

          {/* Resize handle (bottom-right) */}
          <Rect
            x={displayWidth - HANDLE_SIZE / 2}
            y={displayHeight - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="#3b82f6"
            cornerRadius={3}
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'nwse-resize';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'move';
            }}
            onDragStart={handleResizeDragStart}
            onDragMove={handleResizeDragMove}
            onDragEnd={handleResizeDragEnd}
          />

          {/* Rotate handle (bottom-left) */}
          <Rect
            x={-HANDLE_SIZE / 2}
            y={displayHeight - HANDLE_SIZE / 2}
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            fill="#8b5cf6"
            cornerRadius={HANDLE_SIZE / 2}
            draggable
            onMouseEnter={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'alias';
            }}
            onMouseLeave={(e) => {
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'move';
            }}
            onDragStart={handleRotateDragStart}
            onDragMove={handleRotateDragMove}
            onDragEnd={handleRotateDragEnd}
          />

          {/* Delete button (top-right) */}
          <Rect
            x={displayWidth - 24}
            y={-28}
            width={24}
            height={24}
            fill={isDeleteHovered ? 'rgba(239,68,68,0.25)' : 'rgba(0,0,0,0.08)'}
            cornerRadius={8}
            onClick={(e) => {
              e.cancelBubble = true;
              onDeleteSelected();
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onDeleteSelected();
            }}
            onMouseEnter={(e) => {
              setIsDeleteHovered(true);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
              setIsDeleteHovered(false);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'move';
            }}
          />
          <Text
            x={displayWidth - 19}
            y={-25}
            text={'\u00d7'}
            fontSize={16}
            fontStyle="bold"
            fill={isDeleteHovered ? '#ef4444' : '#666'}
            listening={false}
          />

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
