import { useState, useEffect, useCallback } from 'react';
import { ref, onValue, push, off, query, limitToLast } from 'firebase/database';
import { rtdb } from '../services/firebase';
import type { ChatMessage } from '../types/board';

const MAX_MESSAGES = 100;

export function useChat(
  boardId: string,
  userId: string,
  displayName: string,
  color: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    const chatRef = query(
      ref(rtdb, `boards/${boardId}/chat`),
      limitToLast(MAX_MESSAGES),
    );

    onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        return;
      }
      const msgs = Object.entries(data as Record<string, Omit<ChatMessage, 'id'>>).map(
        ([id, msg]) => ({ ...msg, id }),
      );
      msgs.sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
    });

    return () => {
      off(chatRef);
    };
  }, [boardId]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const chatRef = ref(rtdb, `boards/${boardId}/chat`);
      push(chatRef, {
        userId,
        displayName,
        color,
        text: trimmed,
        timestamp: Date.now(),
      });
    },
    [boardId, userId, displayName, color],
  );

  return { messages, sendMessage };
}
