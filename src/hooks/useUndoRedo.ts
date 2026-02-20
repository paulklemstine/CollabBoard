import React, { useRef, useState, useCallback, useEffect } from 'react';
import { batchAddObjects, batchDeleteObjects, type AnyBoardObject } from '../services/boardService';
import { loadUndoState, saveUndoState } from '../services/undoHistoryService';

export interface UndoChange {
  objectId: string;
  before: AnyBoardObject | null; // null = object was created
  after: AnyBoardObject | null;  // null = object was deleted
}

export interface UndoEntry {
  changes: UndoChange[];
}

const MAX_UNDO = 50;
const SAVE_DEBOUNCE_MS = 2000;

export function useUndoRedo(
  boardId: string,
  userId: string,
  objectsRef?: React.RefObject<AnyBoardObject[]>,
) {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isUndoRedoingRef = useRef(false);
  const lockRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      saveUndoState(boardId, userId, undoStackRef.current, redoStackRef.current);
    }, SAVE_DEBOUNCE_MS);
  }, [boardId, userId]);

  // Load persisted state on mount
  useEffect(() => {
    let cancelled = false;
    loadUndoState(boardId, userId).then((state) => {
      if (cancelled || !state) return;
      undoStackRef.current = state.undoStack;
      redoStackRef.current = state.redoStack;
      updateFlags();
    });
    return () => { cancelled = true; };
  }, [boardId, userId, updateFlags]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        saveUndoState(boardId, userId, undoStackRef.current, redoStackRef.current);
      }
    };
  }, [boardId, userId]);

  const pushUndo = useCallback(
    (entry: UndoEntry) => {
      if (isUndoRedoingRef.current) return;
      if (entry.changes.length === 0) return;
      undoStackRef.current.push(entry);
      if (undoStackRef.current.length > MAX_UNDO) {
        undoStackRef.current.shift();
      }
      // New action clears redo stack
      redoStackRef.current = [];
      updateFlags();
      scheduleSave();
    },
    [updateFlags, scheduleSave]
  );

  const applyChanges = useCallback(
    async (changes: UndoChange[], direction: 'undo' | 'redo'): Promise<UndoChange[]> => {
      const toRestore: AnyBoardObject[] = [];
      const toDelete: string[] = [];
      const appliedChanges: UndoChange[] = [];
      const currentObjects = objectsRef?.current ?? [];

      for (const change of changes) {
        const target = direction === 'undo' ? change.before : change.after;
        const currentObj = currentObjects.find(o => o.id === change.objectId);

        // Skip if a peer has modified this object since our action
        if (currentObj?.lastModifiedBy && currentObj.lastModifiedBy !== userId) {
          continue;
        }

        appliedChanges.push(change);

        if (target === null) {
          // Delete (undo a create, or redo a delete)
          if (currentObj) {
            toDelete.push(change.objectId);
          }
        } else {
          // Restore/create — stamp ourselves as modifier
          toRestore.push({
            ...target,
            lastModifiedBy: userId,
            updatedAt: Date.now(),
          });
        }
      }

      if (toRestore.length === 0 && toDelete.length === 0) {
        return appliedChanges;
      }

      isUndoRedoingRef.current = true;
      try {
        const promises: Promise<void>[] = [];
        if (toRestore.length > 0) promises.push(batchAddObjects(boardId, toRestore));
        if (toDelete.length > 0) promises.push(batchDeleteObjects(boardId, toDelete));
        await Promise.all(promises);
      } finally {
        isUndoRedoingRef.current = false;
      }

      return appliedChanges;
    },
    [boardId, userId, objectsRef]
  );

  const undo = useCallback(async () => {
    if (lockRef.current || undoStackRef.current.length === 0) return;
    lockRef.current = true;
    try {
      const entry = undoStackRef.current.pop()!;
      const applied = await applyChanges(entry.changes, 'undo');
      if (applied.length > 0) {
        redoStackRef.current.push({ changes: applied });
      }
      updateFlags();
      scheduleSave();
    } finally {
      lockRef.current = false;
    }
  }, [applyChanges, updateFlags, scheduleSave]);

  const redo = useCallback(async () => {
    if (lockRef.current || redoStackRef.current.length === 0) return;
    lockRef.current = true;
    try {
      const entry = redoStackRef.current.pop()!;
      const applied = await applyChanges(entry.changes, 'redo');
      if (applied.length > 0) {
        undoStackRef.current.push({ changes: applied });
      }
      updateFlags();
      scheduleSave();
    } finally {
      lockRef.current = false;
    }
  }, [applyChanges, updateFlags, scheduleSave]);

  return { pushUndo, undo, redo, canUndo, canRedo, isUndoRedoingRef };
}
