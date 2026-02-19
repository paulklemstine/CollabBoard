import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

let subscribeCb: ((ids: string[]) => void) | null = null;
const mockAddVisitedBoard = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('../services/userBoardsService', () => ({
  subscribeToVisitedBoardIds: vi.fn((_userId: string, cb: (ids: string[]) => void) => {
    subscribeCb = cb;
    return mockUnsubscribe;
  }),
  addVisitedBoard: (...args: unknown[]) => mockAddVisitedBoard(...args),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import { useVisitedBoards } from './useVisitedBoards';

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCb = null;
});

describe('useVisitedBoards', () => {
  it('subscribes to visited board IDs on mount', () => {
    renderHook(() => useVisitedBoards('user-1'));

    expect(subscribeCb).not.toBeNull();
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useVisitedBoards('user-1'));
    unmount();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('returns visited board IDs from subscription', () => {
    const { result } = renderHook(() => useVisitedBoards('user-1'));

    act(() => {
      subscribeCb?.(['b1', 'b2']);
    });

    expect(result.current.visitedBoardIds).toEqual(['b1', 'b2']);
  });

  it('markVisited calls addVisitedBoard', async () => {
    mockAddVisitedBoard.mockResolvedValue(undefined);
    const { result } = renderHook(() => useVisitedBoards('user-1'));

    await act(async () => {
      await result.current.markVisited('board-xyz');
    });

    expect(mockAddVisitedBoard).toHaveBeenCalledWith('user-1', 'board-xyz');
  });
});
