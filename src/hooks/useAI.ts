import { useState, useCallback, useRef } from 'react';
import { sendAICommand } from '../services/aiService';
import type { AIMessage } from '../types/board';
import type { ViewportCenter } from '../components/AIChat/AIChat';

/** Map raw error messages to user-friendly text. */
function friendlyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('503') || lower.includes('unavailable') || lower.includes('high demand'))
    return 'The AI service is busy right now. Please try again in a moment.';
  if (lower.includes('429') || lower.includes('rate') || lower.includes('quota'))
    return 'Too many requests — please wait a few seconds and try again.';
  if (lower.includes('timeout') || lower.includes('timed out'))
    return 'The request took too long. Try a simpler prompt or try again.';
  if (lower.includes('unauthenticated') || lower.includes('sign'))
    return 'Please sign in to use AI features.';
  if (lower.includes('permission') || lower.includes('denied'))
    return 'You don\'t have permission to do that.';
  if (lower.includes('internal'))
    return 'Something went wrong on our end. Please try again.';
  return raw;
}

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
        const raw = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
        setError(friendlyError(raw));
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
