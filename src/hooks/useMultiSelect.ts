import { useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import type Konva from 'konva';
import type { AnyBoardObject } from '../services/boardService';
import type { Frame } from '../types/board';
import { batchUpdateObjects } from '../services/boardService';
import {
  getBoundingBox,
  rectanglesIntersect,
  transformGroupMove,
  transformGroupResize,
  transformGroupRotate,
  type BBox,
} from '../utils/selectionMath';
import {
  findContainingFrameForGroup,
  scaleGroupToFitFrame,
} from '../utils/containment';

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

export interface GroupTransformPreview {
  scaleX: number;
  scaleY: number;
  rotation: number;
}

/** Always-derived bounding box around selected objects */
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
  const [transformPreview, setTransformPreview] = useState<GroupTransformPreview | null>(null);
  const [groupHoveredFrameId, setGroupHoveredFrameId] = useState<string | null>(null);
  const [selectionHidden, setSelectionHidden] = useState(false);

  // Derive selection box from actual objects — always correct, no manual tracking.
  // When objects update (e.g. after Firestore commit), this recalculates automatically.
  const selectionBox = useMemo<SelectionBox | null>(() => {
    if (selectedIds.size === 0) return null;
    const selected = objects.filter(
      (o) => selectedIds.has(o.id) && o.type !== 'connector'
    );
    if (selected.length === 0) return null;
    const bbox = getBoundingBox(selected);
    if (!bbox) return null;
    return { ...bbox, rotation: 0 };
  }, [objects, selectedIds]);

  // Ref mirrors for use inside event callbacks (avoids stale closures)
  const objectsRef = useRef(objects);
  objectsRef.current = objects;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;
  const selectionBoxRef = useRef(selectionBox);
  selectionBoxRef.current = selectionBox;
  const isMarqueeActiveRef = useRef(false);

  // Track pending preview clears after transform commits.
  // When Firestore's optimistic update fires onSnapshot (updating `objects`),
  // useLayoutEffect clears the preview before the browser paints —
  // so the user never sees a frame with both new positions AND old preview offsets.
  const pendingClearRef = useRef<'drag' | 'transform' | null>(null);

  useLayoutEffect(() => {
    if (pendingClearRef.current === 'drag') {
      setGroupDragOffset(null);
      setSelectionHidden(false);
      pendingClearRef.current = null;
    } else if (pendingClearRef.current === 'transform') {
      setTransformPreview(null);
      setSelectionHidden(false);
      pendingClearRef.current = null;
    }
  }, [objects]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setGroupDragOffset(null);
    setTransformPreview(null);
    setGroupHoveredFrameId(null);
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
        }

        return null;
      });
    },
    []
  );

  const handleGroupDragMove = useCallback((dx: number, dy: number) => {
    setGroupDragOffset({ dx, dy });

    // Detect frame hover during group drag for visual feedback
    const selected = objectsRef.current.filter((obj) =>
      selectedIdsRef.current.has(obj.id)
    );
    if (selected.length === 0) return;

    const movedObjects = selected.map((obj) => ({
      ...obj,
      x: obj.x + dx,
      y: obj.y + dy,
    }));

    const frames = objectsRef.current.filter(
      (o): o is Frame => o.type === 'frame' && !selectedIdsRef.current.has(o.id)
    );

    const containingFrame = findContainingFrameForGroup(movedObjects, frames);
    setGroupHoveredFrameId(containingFrame?.id ?? null);
  }, []);

  const handleGroupDragEnd = useCallback(
    async (dx: number, dy: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      // Move all selected objects
      let updates = transformGroupMove(selected, dx, dy);

      // Check if the moved group should be placed inside a frame
      const movedObjects = selected.map((obj) => ({
        ...obj,
        x: obj.x + dx,
        y: obj.y + dy,
      }));

      const frames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame' && !selectedIdsRef.current.has(o.id)
      );

      const containingFrame = findContainingFrameForGroup(movedObjects, frames);

      if (containingFrame) {
        // Scale the group to fit inside the frame if needed
        const scaleUpdates = scaleGroupToFitFrame(movedObjects, containingFrame);

        if (scaleUpdates) {
          // Replace position/size updates with scaled versions
          updates = scaleUpdates.map((scaled) => {
            const original = updates.find((u) => u.id === scaled.id);
            return {
              id: scaled.id,
              updates: {
                ...original?.updates,
                x: scaled.x,
                y: scaled.y,
                width: scaled.width,
                height: scaled.height,
                parentId: containingFrame.id,
              },
            };
          });
        } else {
          // Group fits, just set parentId
          updates = updates.map((update) => ({
            ...update,
            updates: {
              ...update.updates,
              parentId: containingFrame.id,
            },
          }));
        }
      } else {
        // No containing frame — clear parentId for all selected objects
        updates = updates.map((update) => ({
          ...update,
          updates: {
            ...update.updates,
            parentId: '',
          },
        }));
      }

      pendingClearRef.current = 'drag';
      setSelectionHidden(true);
      setGroupHoveredFrameId(null);

      await batchUpdateObjects(boardId, updates);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingClearRef.current === 'drag') {
        pendingClearRef.current = null;
        setGroupDragOffset(null);
        setSelectionHidden(false);
      }
    },
    [boardId]
  );

  const handleGroupResizeMove = useCallback((scaleX: number, scaleY: number) => {
    setTransformPreview((prev) => ({
      scaleX,
      scaleY,
      rotation: prev?.rotation ?? 0,
    }));
  }, []);

  const handleGroupResize = useCallback(
    async (scaleX: number, scaleY: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      // Use raw object bounding box (not padded selectionBox) for transform anchor
      const bbox = getBoundingBox(selected);
      if (!bbox) return;

      const updates = transformGroupResize(selected, bbox, scaleX, scaleY, bbox.x, bbox.y);

      pendingClearRef.current = 'transform';
      setSelectionHidden(true);

      await batchUpdateObjects(boardId, updates);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingClearRef.current === 'transform') {
        pendingClearRef.current = null;
        setTransformPreview(null);
        setSelectionHidden(false);
      }
    },
    [boardId]
  );

  const handleGroupRotateMove = useCallback((deltaAngle: number) => {
    setTransformPreview((prev) => ({
      scaleX: prev?.scaleX ?? 1,
      scaleY: prev?.scaleY ?? 1,
      rotation: deltaAngle,
    }));
  }, []);

  const handleGroupRotate = useCallback(
    async (deltaAngle: number) => {
      const selected = objectsRef.current.filter((obj) =>
        selectedIdsRef.current.has(obj.id)
      );
      if (selected.length === 0) return;

      // Use raw object bounding box (not padded selectionBox) for transform center
      const bbox = getBoundingBox(selected);
      if (!bbox) return;

      const updates = transformGroupRotate(selected, bbox, deltaAngle);

      pendingClearRef.current = 'transform';
      setSelectionHidden(true);

      await batchUpdateObjects(boardId, updates);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingClearRef.current === 'transform') {
        pendingClearRef.current = null;
        setTransformPreview(null);
        setSelectionHidden(false);
      }
    },
    [boardId]
  );

  return {
    selectedIds,
    marquee,
    isMarqueeActive,
    groupDragOffset,
    selectionBox,
    selectionHidden,
    transformPreview,
    groupHoveredFrameId,
    clearSelection,
    isSelected,
    selectObject,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleGroupDragMove,
    handleGroupDragEnd,
    handleGroupResizeMove,
    handleGroupResize,
    handleGroupRotateMove,
    handleGroupRotate,
  };
}
