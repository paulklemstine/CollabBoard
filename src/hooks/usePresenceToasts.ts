import { useRef, useState, useEffect, useCallback } from 'react';
import type { PresenceUser } from '../types/board';

export interface PresenceToast {
  id: string;
  name: string;
  type: 'join' | 'leave';
  timestamp: number;
}

export function usePresenceToasts(onlineUsers: PresenceUser[]) {
  const [toasts, setToasts] = useState<PresenceToast[]>([]);
  const prevUidsRef = useRef<Set<string>>(new Set());
  const userCacheRef = useRef<Map<string, string>>(new Map());
  const initializedRef = useRef(false);

  useEffect(() => {
    const currentUids = new Set(onlineUsers.map(u => u.uid));

    // Cache display names for leave events
    for (const user of onlineUsers) {
      userCacheRef.current.set(user.uid, user.displayName);
    }

    // Skip the first render to avoid showing toasts for existing users
    if (!initializedRef.current) {
      prevUidsRef.current = currentUids;
      initializedRef.current = true;
      return;
    }

    const prevUids = prevUidsRef.current;
    const newToasts: PresenceToast[] = [];

    // Joins
    for (const uid of currentUids) {
      if (!prevUids.has(uid)) {
        const name = userCacheRef.current.get(uid) || 'someone';
        newToasts.push({
          id: `join-${uid}-${Date.now()}`,
          name,
          type: 'join',
          timestamp: Date.now(),
        });
      }
    }

    // Leaves
    for (const uid of prevUids) {
      if (!currentUids.has(uid)) {
        const name = userCacheRef.current.get(uid) || 'someone';
        newToasts.push({
          id: `leave-${uid}-${Date.now()}`,
          name,
          type: 'leave',
          timestamp: Date.now(),
        });
      }
    }

    if (newToasts.length > 0) {
      setToasts(prev => [...prev, ...newToasts]);
    }

    prevUidsRef.current = currentUids;
  }, [onlineUsers]);

  // Auto-dismiss after 3s
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      const now = Date.now();
      setToasts(prev => prev.filter(t => now - t.timestamp < 3000));
    }, 3000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, dismissToast };
}
