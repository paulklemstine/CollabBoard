import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, off } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { CursorPosition } from '../types/board';

const THROTTLE_MS = 100; // ~10 updates per second

export function useCursors(
  boardId: string,
  userId: string,
  displayName: string = 'Anonymous',
  userColor: string = '#6366f1'
) {
  const [cursors, setCursors] = useState<CursorPosition[]>([]);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const cursorsRef = ref(rtdb, `boards/${boardId}/cursors`);
    onValue(cursorsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCursors([]);
        return;
      }
      const remoteCursors = Object.values(data as Record<string, CursorPosition>).filter(
        (cursor) => cursor.userId !== userId
      );
      setCursors(remoteCursors);
    });

    return () => {
      off(cursorsRef);
    };
  }, [boardId, userId]);

  const updateCursor = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - lastUpdateRef.current < THROTTLE_MS) return;
      lastUpdateRef.current = now;

      const cursorRef = ref(rtdb, `boards/${boardId}/cursors/${userId}`);
      set(cursorRef, {
        userId,
        x,
        y,
        name: displayName,
        color: userColor,
        timestamp: now,
      });
    },
    [boardId, userId, displayName, userColor]
  );

  return { cursors, updateCursor };
}
