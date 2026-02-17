import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ref, onValue, set, off, onDisconnect } from 'firebase/database';
import { useCursors, CURSOR_TIMEOUT } from './useCursors';

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ key: 'mock-ref' })),
  onValue: vi.fn(),
  set: vi.fn(),
  off: vi.fn(),
  onDisconnect: vi.fn(() => ({
    remove: vi.fn(),
  })),
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

  it('configures onDisconnect to remove cursor', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    renderHook(() => useCursors('board-1', 'user-1'));

    expect(onDisconnect).toHaveBeenCalled();
  });

  it('removes own cursor on unmount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    const { unmount } = renderHook(() => useCursors('board-1', 'user-1'));

    unmount();

    // Should call set with null to remove cursor
    expect(set).toHaveBeenCalledWith(expect.anything(), null);
  });

  it('filters out stale cursors older than CURSOR_TIMEOUT', () => {
    const now = Date.now();
    const cursorData = {
      'user-1': {
        x: 10,
        y: 20,
        name: 'Me',
        color: '#ff0',
        userId: 'user-1',
        timestamp: now,
      },
      'user-2': {
        x: 30,
        y: 40,
        name: 'Active',
        color: '#0ff',
        userId: 'user-2',
        timestamp: now - 1000, // 1 second ago (fresh)
      },
      'user-3': {
        x: 50,
        y: 60,
        name: 'Stale',
        color: '#f0f',
        userId: 'user-3',
        timestamp: now - CURSOR_TIMEOUT - 1000, // Older than timeout
      },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof cursorData }) => void)({
        val: () => cursorData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() => useCursors('board-1', 'user-1'));

    // Should only include user-2 (active), not user-3 (stale) or user-1 (self)
    expect(result.current.cursors).toHaveLength(1);
    expect(result.current.cursors[0].userId).toBe('user-2');
  });

  it('includes cursors within CURSOR_TIMEOUT', () => {
    const now = Date.now();
    const cursorData = {
      'user-1': {
        x: 10,
        y: 20,
        name: 'Me',
        color: '#ff0',
        userId: 'user-1',
        timestamp: now,
      },
      'user-2': {
        x: 30,
        y: 40,
        name: 'User 2',
        color: '#0ff',
        userId: 'user-2',
        timestamp: now - CURSOR_TIMEOUT + 500, // Within timeout
      },
      'user-3': {
        x: 50,
        y: 60,
        name: 'User 3',
        color: '#f0f',
        userId: 'user-3',
        timestamp: now, // Fresh
      },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof cursorData }) => void)({
        val: () => cursorData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() => useCursors('board-1', 'user-1'));

    // Should include both user-2 and user-3 (not user-1 as it's self)
    expect(result.current.cursors).toHaveLength(2);
    expect(result.current.cursors.map((c) => c.userId)).toEqual(
      expect.arrayContaining(['user-2', 'user-3'])
    );
  });
});
