import { useRef, useState, useCallback } from 'react';
import { batchAddObjects, batchDeleteObjects, type AnyBoardObject } from '../services/boardService';

export interface UndoChange {
  objectId: string;
  before: AnyBoardObject | null; // null = object was created
  after: AnyBoardObject | null;  // null = object was deleted
}

export interface UndoEntry {
  changes: UndoChange[];
}

const MAX_UNDO = 50;

export function useUndoRedo(boardId: string) {
  const undoStackRef = useRef<UndoEntry[]>([]);
  const redoStackRef = useRef<UndoEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isUndoRedoingRef = useRef(false);
  const lockRef = useRef(false);

  const updateFlags = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, []);

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
    },
    [updateFlags]
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
    } finally {
      lockRef.current = false;
    }
  }, [applyChanges, updateFlags]);

  const redo = useCallback(async () => {
    if (lockRef.current || redoStackRef.current.length === 0) return;
    lockRef.current = true;
    try {
      const entry = redoStackRef.current.pop()!;
      await applyChanges(entry.changes, 'redo');
      undoStackRef.current.push(entry);
      updateFlags();
    } finally {
      lockRef.current = false;
    }
  }, [applyChanges, updateFlags]);

  return { pushUndo, undo, redo, canUndo, canRedo, isUndoRedoingRef };
}
