import { useState, useCallback } from 'react';
import { sendAICommand } from '../services/aiService';
import type { AIMessage } from '../types/board';

export function useAI(boardId: string) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const sendCommand = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;

      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setProgress(null);
      setError(null);

      try {
        const result = await sendAICommand(boardId, trimmed, (p) => setProgress(p));

        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
          objectsCreated: result.objectsCreated,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setError(message);
      } finally {
        setIsLoading(false);
        setProgress(null);
      }
    },
    [boardId, isLoading],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return { messages, isLoading, error, progress, sendCommand, clearMessages, dismissError };
}
