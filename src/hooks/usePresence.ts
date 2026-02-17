import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set, onDisconnect, off } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { PresenceUser } from '../types/board';

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

export function pickColor(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function usePresence(
  boardId: string,
  userId: string,
  displayName: string,
  email: string
) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
  const color = useMemo(() => pickColor(userId), [userId]);

  useEffect(() => {
    const userPresenceRef = ref(rtdb, `boards/${boardId}/presence/${userId}`);
    const allPresenceRef = ref(rtdb, `boards/${boardId}/presence`);

    // Set user online
    set(userPresenceRef, {
      uid: userId,
      displayName,
      email,
      color,
      online: true,
      lastSeen: Date.now(),
    });

    // Configure disconnect handler
    onDisconnect(userPresenceRef).remove();

    // Subscribe to all presence
    onValue(allPresenceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setOnlineUsers([]);
        return;
      }
      const users = Object.values(data as Record<string, PresenceUser>).filter(
        (u) => u.online
      );
      setOnlineUsers(users);
    });

    return () => {
      off(allPresenceRef);
      set(userPresenceRef, {
        uid: userId,
        displayName,
        email,
        color,
        online: false,
        lastSeen: Date.now(),
      });
    };
  }, [boardId, userId, displayName, email, color]);

  return { onlineUsers };
}
