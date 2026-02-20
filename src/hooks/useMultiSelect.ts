import { useState, useCallback, useRef, useMemo, useLayoutEffect } from 'react';
import type Konva from 'konva';
import type { AnyBoardObject } from '../services/boardService';
import type { Frame } from '../types/board';
import { batchUpdateObjects } from '../services/boardService';
import type { UndoEntry, UndoChange } from './useUndoRedo';
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
  groupFitsInFrame,
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

export function useMultiSelect(
  objects: AnyBoardObject[],
  boardId: string,
  pushUndo?: (entry: UndoEntry) => void,
) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [isMarqueeActive, setIsMarqueeActive] = useState(false);
  const [groupDragOffset, setGroupDragOffset] = useState<GroupDragOffset | null>(null);
  const [transformPreview, setTransformPreview] = useState<GroupTransformPreview | null>(null);
  const [groupHoveredFrame, setGroupHoveredFrame] = useState<{ id: string; fits: boolean } | null>(null);
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

  // Stable ref for pushUndo (avoids dep-array churn)
  const pushUndoRef = useRef(pushUndo);
  pushUndoRef.current = pushUndo;

  /** Build undo changes from selected objects and their batch updates */
  const buildGroupUndoChanges = useCallback(
    (selected: AnyBoardObject[], updates: Array<{ id: string; updates: Partial<AnyBoardObject> }>): UndoChange[] => {
      const changes: UndoChange[] = [];
      const now = Date.now();
      for (const { id, updates: upd } of updates) {
        const before = selected.find((o) => o.id === id);
        if (before) {
          const after = structuredClone({ ...before, ...upd, updatedAt: now });
          changes.push({ objectId: id, before: structuredClone(before), after });
        }
      }
      return changes;
    },
    []
  );

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
    setGroupHoveredFrame(null);
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

  const selectMultiple = useCallback(
    (ids: Set<string>) => {
      setSelectedIds(ids);
      setGroupDragOffset(null);
    },
    []
  );

  const handleStageMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target !== e.target.getStage()) return;

      // Any click on empty canvas clears selection
      setSelectedIds(new Set());
      setGroupDragOffset(null);

      // Marquee only on right-click or shift+left-click
      const isRightClick = e.evt.button === 2;
      const isShiftLeftClick = e.evt.button === 0 && e.evt.shiftKey;
      if (!isRightClick && !isShiftLeftClick) return;

      const stage = e.target.getStage();
      if (!stage) return;

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
    setGroupHoveredFrame(containingFrame ? { id: containingFrame.id, fits: groupFitsInFrame(movedObjects, containingFrame) } : null);
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

      // Reject oversized groups — only accept if group fits in frame
      const fits = containingFrame ? groupFitsInFrame(movedObjects, containingFrame) : false;

      if (containingFrame && fits) {
        // Group fits, set parentId
        updates = updates.map((update) => ({
          ...update,
          updates: {
            ...update.updates,
            parentId: containingFrame.id,
          },
        }));
      } else {
        // No containing frame or doesn't fit — clear parentId for all selected objects
        updates = updates.map((update) => ({
          ...update,
          updates: {
            ...update.updates,
            parentId: '',
          },
        }));
      }

      // Push undo before committing
      if (pushUndoRef.current) {
        const changes = buildGroupUndoChanges(selected, updates);
        if (changes.length > 0) pushUndoRef.current({ changes });
      }

      pendingClearRef.current = 'drag';
      setSelectionHidden(true);
      setGroupHoveredFrame(null);

      await batchUpdateObjects(boardId, updates);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingClearRef.current === 'drag') {
        pendingClearRef.current = null;
        setGroupDragOffset(null);
        setSelectionHidden(false);
      }
    },
    [boardId, buildGroupUndoChanges]
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

      // Push undo before committing
      if (pushUndoRef.current) {
        const changes = buildGroupUndoChanges(selected, updates);
        if (changes.length > 0) pushUndoRef.current({ changes });
      }

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
    [boardId, buildGroupUndoChanges]
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

      // Push undo before committing
      if (pushUndoRef.current) {
        const changes = buildGroupUndoChanges(selected, updates);
        if (changes.length > 0) pushUndoRef.current({ changes });
      }

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
    [boardId, buildGroupUndoChanges]
  );

  return {
    selectedIds,
    marquee,
    isMarqueeActive,
    groupDragOffset,
    selectionBox,
    selectionHidden,
    transformPreview,
    groupHoveredFrame,
    clearSelection,
    isSelected,
    selectObject,
    selectMultiple,
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
