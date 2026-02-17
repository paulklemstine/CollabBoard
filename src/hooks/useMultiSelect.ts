import { useState, useCallback, useRef } from 'react';
import type Konva from 'konva';
import type { AnyBoardObject } from '../services/boardService';
import { batchUpdateObjects } from '../services/boardService';
import {
  getBoundingBox,
  rectanglesIntersect,
  transformGroupMove,
  transformGroupResize,
  transformGroupRotate,
  type BBox,
} from '../utils/selectionMath';

export interface Marquee {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

export interface GroupDragOffset {
  dx: number;
  dy: number;
}

/** Cached selection bbox — not recalculated from objects after transforms */
export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function useMultiSelect(objects: AnyBoardObject[], boardId: string) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [groupDragOffset, setGroupDragOffset] = useState<GroupDragOffset | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  // Ref mirrors for use inside event callbacks (avoids stale closures)
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectionBoxRef = useRef(selectionBox);
  selectionBoxRef.current = selectionBox;
  const isMarqueeActiveRef = useRef(false);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setGroupDragOffset(null);
    setSelectionBox(null);
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const selectObject = useCallback(
    (id: string) => {
      const obj = objectsRef.current.find((o) => o.id === id);
      if (!obj || obj.type === 'connector') return;

      setSelectedIds(new Set([id]));
      setGroupDragOffset(null);
      setSelectionBox({
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        rotation: 0,
      });
    },
    []
  );

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return;
      if (e.evt.button !== 0) return;

      // Clear selection on any empty-canvas click
      setSelectedIds(new Set());
      setGroupDragOffset(null);
      setSelectionBox(null);

      // Only start marquee when Shift is held — otherwise allow normal pan
      if (!e.evt.shiftKey) return;

      const stage = e.target.getStage();
      if (!stage) return;

      // Stop pan immediately so it doesn't interfere with marquee coordinates
      stage.stopDrag();
      stage.draggable(false);

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const s = stage.scaleX();
      const worldX = (pointer.x - stage.x()) / s;
      const worldY = (pointer.y - stage.y()) / s;

      setMarquee({ startX: worldX, startY: worldY, endX: worldX, endY: worldY });
      setIsMarqueeActive(true);
      isMarqueeActiveRef.current = true;
    },
    []
  );

  const handleStageMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      // Use ref to avoid stale closure — state may not have re-rendered yet
      if (!isMarqueeActiveRef.current) return;

      const stage = e.target.getStage();
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const s = stage.scaleX();
      const worldX = (pointer.x - stage.x()) / s;
      const worldY = (pointer.y - stage.y()) / s;

      setMarquee((prev) => {
        if (!prev) return null;
        return { ...prev, endX: worldX, endY: worldY };
      });
    },
    []
  );

  const handleStageMouseUp = useCallback(
    (_e: Konva.KonvaEventObject<MouseEvent>) => {
      // Use ref to avoid stale closure
      if (!isMarqueeActiveRef.current) return;

      isMarqueeActiveRef.current = false;
      setIsMarqueeActive(false);

      // Re-enable pan (was disabled in handleStageMouseDown for Shift+drag)
      const stage = _e.target.getStage();
      if (stage) stage.draggable(true);

      setMarquee((currentMarquee) => {
        if (!currentMarquee) return null;

        const mx = Math.min(currentMarquee.startX, currentMarquee.endX);
        const my = Math.min(currentMarquee.startY, currentMarquee.endY);
        const mw = Math.abs(currentMarquee.endX - currentMarquee.startX);
        const mh = Math.abs(currentMarquee.endY - currentMarquee.startY);

        if (mw < 5 && mh < 5) {
          return null;
        }

        const marqueeBBox: BBox = { x: mx, y: my, width: mw, height: mh };

        const intersecting = new Set<string>();
        for (const obj of objectsRef.current) {
          if (obj.type === 'connector') continue;

          const objBBox: BBox = {
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
          };
          if (rectanglesIntersect(marqueeBBox, objBBox)) {
            intersecting.add(obj.id);
          }
        }

        if (intersecting.size > 0) {
          setSelectedIds(intersecting);

          const selectedObjs = objectsRef.current.filter((o) => intersecting.has(o.id));
          const bbox = getBoundingBox(selectedObjs);
          if (bbox) {
            setSelectionBox({ ...bbox, rotation: 0 });
          }
        }

        return null;
      });
    },
    []
  );

  const handleGroupDragMove = useCallback((dx: number, dy: number) => {
    setGroupDragOffset({ dx, dy });
  }, []);

  const handleGroupDragEnd = useCallback(
    async (dx: number, dy: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      const updates = transformGroupMove(selected, dx, dy);
      await batchUpdateObjects(boardId, updates);

      setSelectionBox((prev) => {
        if (!prev) return null;
        return { ...prev, x: prev.x + dx, y: prev.y + dy };
      });

      setTimeout(() => {
        setGroupDragOffset(null);
      }, 100);
    },
    [boardId]
  );

  const handleGroupResize = useCallback(
    async (scaleX: number, scaleY: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      const sbox = selectionBoxRef.current;
      if (!sbox) return;

      const bbox: BBox = { x: sbox.x, y: sbox.y, width: sbox.width, height: sbox.height };
      const updates = transformGroupResize(selected, bbox, scaleX, scaleY, sbox.x, sbox.y);
      await batchUpdateObjects(boardId, updates);

      setSelectionBox((prev) => {
        if (!prev) return null;
        return { ...prev, width: prev.width * scaleX, height: prev.height * scaleY };
      });
    },
    [boardId]
  );

  const handleGroupRotate = useCallback(
    async (deltaAngle: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      const sbox = selectionBoxRef.current;
      if (!sbox) return;

      const bbox: BBox = { x: sbox.x, y: sbox.y, width: sbox.width, height: sbox.height };
      const updates = transformGroupRotate(selected, bbox, deltaAngle);
      await batchUpdateObjects(boardId, updates);

      setSelectionBox((prev) => {
        if (!prev) return null;
        return { ...prev, rotation: prev.rotation + deltaAngle };
      });
    },
    [boardId]
  );

  return {
    selectedIds,
    marquee,
    isMarqueeActive,
    groupDragOffset,
    selectionBox,
    clearSelection,
    isSelected,
    selectObject,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleGroupDragMove,
    handleGroupDragEnd,
    handleGroupResize,
    handleGroupRotate,
  };
}
