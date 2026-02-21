import { useState, useCallback, useRef } from 'react';
import { sendAICommand } from '../services/aiService';
import type { AIMessage } from '../types/board';
import type { ViewportCenter } from '../components/AIChat/AIChat';

export function useAI(boardId: string, onObjectsCreated?: (ids: string[]) => void, selectedIds?: string[]) {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  // Use ref to avoid stale closure — selection may change between renders
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const abortControllerRef = useRef<AbortController | null>(null);

  const sendCommand = useCallback(
    async (prompt: string, viewport?: ViewportCenter) => {
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

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const result = await sendAICommand(boardId, trimmed, (p) => setProgress(p), selectedIdsRef.current, viewport, controller.signal);

        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
          objectsCreated: result.objectsCreated,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        if (result.objectsCreated.length > 0 && onObjectsCreated) {
          onObjectsCreated(result.objectsCreated);
        }
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setError(message);
      } finally {
        abortControllerRef.current = null;
        setIsLoading(false);
        setProgress(null);
      }
    },
    [boardId, isLoading],
  );

  const cancelRequest = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return { messages, isLoading, error, progress, sendCommand, cancelRequest, clearMessages, dismissError };
}
