import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ref, onValue, set, off } from 'firebase/database';
import { useCursors } from './useCursors';

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ key: 'mock-ref' })),
  onValue: vi.fn(),
  set: vi.fn(),
  off: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  rtdb: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCursors', () => {
  it('subscribes to cursors ref on mount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    renderHook(() => useCursors('board-1', 'user-1'));

    expect(ref).toHaveBeenCalledWith(expect.anything(), 'boards/board-1/cursors');
    expect(onValue).toHaveBeenCalled();
  });

  it('filters out own cursor from returned cursors', () => {
    const cursorData = {
      'user-1': { x: 10, y: 20, name: 'Me', color: '#ff0', userId: 'user-1', timestamp: 1 },
      'user-2': { x: 30, y: 40, name: 'Other', color: '#0ff', userId: 'user-2', timestamp: 1 },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof cursorData }) => void)({
        val: () => cursorData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() => useCursors('board-1', 'user-1'));

    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0].userId).toBe('user-2');
  });

  it('provides updateCursor that writes to RTDB', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    const { result } = renderHook(() =>
      useCursors('board-1', 'user-1', 'Test User', '#ff0000')
    );

    act(() => {
      result.current.updateCursor(100, 200);
      vi.advanceTimersByTime(100); // past throttle
    });

    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        x: 100,
        y: 200,
        name: 'Test User',
        color: '#ff0000',
        userId: 'user-1',
      })
    );
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(onValue).mockReturnValue(unsubscribe as never);

    const { unmount } = renderHook(() => useCursors('board-1', 'user-1'));
    unmount();

    expect(off).toHaveBeenCalled();
  });

  it('returns empty array when no cursors exist', () => {
    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => null }) => void)({
        val: () => null,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() => useCursors('board-1', 'user-1'));

    expect(result.current.cursors).toEqual([]);
  });
});
