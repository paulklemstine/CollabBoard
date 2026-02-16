import { useState, useEffect, useCallback } from 'react';
import {
  addObject,
  updateObject,
  deleteObject,
  subscribeToBoard,
  type AnyBoardObject,
} from '../services/boardService';
import type { StickyNote } from '../types/board';

const STICKY_COLORS = ['#fef08a', '#fde68a', '#bbf7d0', '#bfdbfe', '#e9d5ff', '#fecaca'];

export function useBoard(boardId: string, userId: string) {
  const [objects, setObjects] = useState<AnyBoardObject[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToBoard(boardId, setObjects);
    return unsubscribe;
  }, [boardId]);

  const addStickyNote = useCallback(
    (x: number = 200, y: number = 200) => {
      const note: StickyNote = {
        id: crypto.randomUUID(),
        type: 'sticky',
        x,
        y,
        width: 200,
        height: 200,
        rotation: 0,
        createdBy: userId,
        updatedAt: Date.now(),
        text: '',
        color: STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      };
      addObject(boardId, note);
    },
    [boardId, userId]
  );

  const moveObject = useCallback(
    (objectId: string, x: number, y: number) => {
      updateObject(boardId, objectId, { x, y });
    },
    [boardId]
  );

  const updateText = useCallback(
    (objectId: string, text: string) => {
      updateObject(boardId, objectId, { text } as Partial<StickyNote>);
    },
    [boardId]
  );

  const removeObject = useCallback(
    (objectId: string) => {
      deleteObject(boardId, objectId);
    },
    [boardId]
  );

  return { objects, addStickyNote, moveObject, updateText, removeObject };
}
