import { useState, useCallback, useRef, useEffect } from 'react';
import { sendAICommand } from '../services/aiService';
import { batchDeleteObjects } from '../services/boardService';
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

  // Retry support: store last prompt + viewport
  const lastPromptRef = useRef<{ prompt: string; viewport?: ViewportCenter } | null>(null);

  // Iterative refinement: track IDs from last AI response
  const lastCreatedIdsRef = useRef<string[]>([]);

  // Clear lastCreatedIds when user explicitly selects objects
  const prevSelectedIdsRef = useRef<string[] | undefined>(selectedIds);
  useEffect(() => {
    if (selectedIds !== prevSelectedIdsRef.current && selectedIds && selectedIds.length > 0) {
      lastCreatedIdsRef.current = [];
    }
    prevSelectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const sendCommand = useCallback(
    async (prompt: string, viewport?: ViewportCenter) => {
      const trimmed = prompt.trim();
      if (!trimmed || isLoading) return;

      // Save for retry
      lastPromptRef.current = { prompt: trimmed, viewport };

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

      // Merge implicit lastCreatedIds with explicit selectedIds for iterative refinement
      const implicitIds = lastCreatedIdsRef.current;
      const explicitIds = selectedIdsRef.current ?? [];
      const mergedIds = [...new Set([...explicitIds, ...implicitIds])];
      // Reset lastCreatedIds after merging to avoid stale refs
      lastCreatedIdsRef.current = [];

      // Extract conversation history (last 10 entries = 5 pairs)
      const recentMessages = messages.slice(-10);
      const conversationHistory = recentMessages.map(m => ({ role: m.role, content: m.content }));

      try {
        const result = await sendAICommand(
          boardId,
          trimmed,
          (p) => setProgress(p),
          mergedIds.length > 0 ? mergedIds : undefined,
          viewport,
          controller.signal,
          conversationHistory.length > 0 ? conversationHistory : undefined,
          onObjectsCreated,
        );

        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.response,
          timestamp: Date.now(),
          objectsCreated: result.objectsCreated,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Track created IDs for iterative refinement
        if (result.objectsCreated.length > 0) {
          lastCreatedIdsRef.current = result.objectsCreated;
          if (onObjectsCreated) {
            onObjectsCreated(result.objectsCreated);
          }
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
    [boardId, isLoading, messages],
  );

  const retryLastCommand = useCallback(() => {
    if (lastPromptRef.current) {
      setError(null);
      sendCommand(lastPromptRef.current.prompt, lastPromptRef.current.viewport);
    }
  }, [sendCommand]);

  const undoMessage = useCallback(async (messageId: string) => {
    const msg = messages.find(m => m.id === messageId);
    if (!msg || !msg.objectsCreated || msg.objectsCreated.length === 0) return;

    try {
      await batchDeleteObjects(boardId, msg.objectsCreated);
      setMessages((prev) =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, objectsCreated: [], content: m.content + ' (Undone)' }
            : m,
        ),
      );
    } catch (err) {
      console.error('Undo failed:', err);
      setError('Failed to undo. Some objects may have been deleted already.');
    }
  }, [boardId, messages]);

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

  return {
    messages, isLoading, error, progress,
    sendCommand, cancelRequest, clearMessages, dismissError,
    retryLastCommand, undoMessage,
  };
}
