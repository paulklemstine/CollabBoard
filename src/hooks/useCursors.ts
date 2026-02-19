import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, set, off, onDisconnect } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { CursorPosition } from '../types/board';

const THROTTLE_MS = 100; // ~10 updates per second

// Cursor timeout: remove cursors if no update for 3 seconds
// (should be longer than THROTTLE_MS but short enough to feel responsive)
export const CURSOR_TIMEOUT = 3000;

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
    const userCursorRef = ref(rtdb, `boards/${boardId}/cursors/${userId}`);

    // Configure disconnect handler to remove cursor when user disconnects
    onDisconnect(userCursorRef).remove();

    onValue(cursorsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setCursors([]);
        return;
      }

      const now = Date.now();
      const remoteCursors = Object.values(data as Record<string, CursorPosition>).filter(
        (cursor) => {
          // Filter out own cursor
          if (cursor.userId === userId) return false;

          // Filter out stale cursors (no update for CURSOR_TIMEOUT)
          const timeSinceUpdate = now - cursor.timestamp;
          return timeSinceUpdate < CURSOR_TIMEOUT;
        }
      );
      setCursors(remoteCursors);
    });

    return () => {
      off(cursorsRef);
      // Remove cursor when component unmounts
      set(userCursorRef, null);
    };
  }, [boardId, userId]);

  const updateCursor = useCallback(
    (x: number, y: number, viewport?: { x: number; y: number; scale: number }) => {
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
        ...(viewport && {
          viewportX: viewport.x,
          viewportY: viewport.y,
          viewportScale: viewport.scale,
        }),
      });
    },
    [boardId, userId, displayName, userColor]
  );

  return { cursors, updateCursor };
}
