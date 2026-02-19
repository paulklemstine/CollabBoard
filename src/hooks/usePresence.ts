import { useState, useEffect, useMemo } from 'react';
import { ref, onValue, set, remove, onDisconnect, off } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { PresenceUser } from '../types/board';

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

// Heartbeat: update lastSeen every 15 seconds
export const HEARTBEAT_INTERVAL = 15000;
// Users not seen within this window are considered offline (stale RTDB entries)
export const PRESENCE_TIMEOUT = 45000;

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

    // Function to update user presence with current timestamp
    const updatePresence = () => {
      set(userPresenceRef, {
        uid: userId,
        displayName,
        email,
        color,
        online: true,
        lastSeen: Date.now(),
      });
    };

    // Set user online immediately
    updatePresence();

    // Configure disconnect handler
    onDisconnect(userPresenceRef).remove();

    // Start heartbeat - update presence every HEARTBEAT_INTERVAL
    const heartbeatInterval = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Subscribe to all presence — filter out stale users and self
    onValue(allPresenceRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setOnlineUsers([]);
        return;
      }

      const now = Date.now();
      const users = Object.values(data as Record<string, PresenceUser>).filter(
        (u) => u.online && u.uid !== userId && (now - u.lastSeen) < PRESENCE_TIMEOUT,
      );
      setOnlineUsers(users);
    });

    return () => {
      // Clear heartbeat interval
      clearInterval(heartbeatInterval);

      // Unsubscribe from presence updates
      off(allPresenceRef);

      // Remove user presence entry entirely
      remove(userPresenceRef);
    };
  }, [boardId, userId, displayName, email, color]);

  return { onlineUsers };
}
