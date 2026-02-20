import { useRef, useState, useCallback, useEffect } from 'react';
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

export function useUndoRedo(boardId: string, userId: string) {
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
    async (changes: UndoChange[], direction: 'undo' | 'redo') => {
      const toRestore: AnyBoardObject[] = [];
      const toDelete: string[] = [];

      for (const change of changes) {
        const target = direction === 'undo' ? change.before : change.after;
        if (target === null) {
          toDelete.push(change.objectId);
        } else {
          toRestore.push(target);
        }
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
    },
    [boardId]
  );

  const undo = useCallback(async () => {
    if (lockRef.current || undoStackRef.current.length === 0) return;
    lockRef.current = true;
    try {
      const entry = undoStackRef.current.pop()!;
      await applyChanges(entry.changes, 'undo');
      redoStackRef.current.push(entry);
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
      await applyChanges(entry.changes, 'redo');
      undoStackRef.current.push(entry);
      updateFlags();
      scheduleSave();
    } finally {
      lockRef.current = false;
    }
  }, [applyChanges, updateFlags, scheduleSave]);

  return { pushUndo, undo, redo, canUndo, canRedo, isUndoRedoingRef };
}
