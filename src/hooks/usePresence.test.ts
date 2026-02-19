import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ref, onValue, set, remove, onDisconnect, off } from 'firebase/database';
import { usePresence, HEARTBEAT_INTERVAL, PRESENCE_TIMEOUT } from './usePresence';

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ key: 'mock-ref' })),
  onValue: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
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

describe('usePresence', () => {
  it('sets user online in RTDB on mount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    renderHook(() =>
      usePresence('board-1', 'user-1', 'Test User', 'test@example.com')
    );

    expect(ref).toHaveBeenCalledWith(expect.anything(), 'boards/board-1/presence/user-1');
    expect(set).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        uid: 'user-1',
        displayName: 'Test User',
        online: true,
      })
    );
  });

  it('configures onDisconnect to remove presence', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    renderHook(() =>
      usePresence('board-1', 'user-1', 'Test User', 'test@example.com')
    );

    expect(onDisconnect).toHaveBeenCalled();
  });

  it('subscribes to all presence and returns other online users (excludes self)', () => {
    const now = Date.now();
    const presenceData = {
      'user-1': { uid: 'user-1', displayName: 'Me', email: '', color: '#f00', online: true, lastSeen: now },
      'user-2': { uid: 'user-2', displayName: 'Other', email: '', color: '#0f0', online: true, lastSeen: now },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof presenceData }) => void)({
        val: () => presenceData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Me', 'me@example.com')
    );

    expect(result.current.onlineUsers).toHaveLength(1);
    expect(result.current.onlineUsers[0].uid).toBe('user-2');
  });

  it('returns empty array when no presence data', () => {
    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => null }) => void)({
        val: () => null,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Test', '')
    );

    expect(result.current.onlineUsers).toEqual([]);
  });

  it('unsubscribes and removes presence on unmount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    const { unmount } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Test', '')
    );

    unmount();

    expect(off).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
  });

  it('sends heartbeat every HEARTBEAT_INTERVAL milliseconds', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    renderHook(() =>
      usePresence('board-1', 'user-1', 'Test User', 'test@example.com')
    );

    const initialCalls = vi.mocked(set).mock.calls.length;

    // Advance time by HEARTBEAT_INTERVAL
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
    });

    expect(vi.mocked(set).mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('updates lastSeen timestamp on each heartbeat', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);
    const startTime = Date.now();

    renderHook(() =>
      usePresence('board-1', 'user-1', 'Test User', 'test@example.com')
    );

    // First call (initial registration)
    const firstCall = vi.mocked(set).mock.calls[0][1] as { lastSeen: number };
    expect(firstCall.lastSeen).toBe(startTime);

    // Advance time and trigger heartbeat
    act(() => {
      vi.advanceTimersByTime(HEARTBEAT_INTERVAL);
    });

    const calls = vi.mocked(set).mock.calls;
    const latestCall = calls[calls.length - 1][1] as { lastSeen: number };
    expect(latestCall.lastSeen).toBeGreaterThanOrEqual(startTime + HEARTBEAT_INTERVAL);
  });

  it('clears heartbeat interval on unmount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    const { unmount } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Test User', 'test@example.com')
    );

    const callsBeforeUnmount = vi.mocked(set).mock.calls.length;
    unmount();

    // Advance time - should not trigger more heartbeats
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL * 3);

    // No additional set calls after unmount (cleanup uses remove, not set)
    expect(vi.mocked(set).mock.calls.length).toBe(callsBeforeUnmount);
  });

  it('filters out users with online set to false', () => {
    const now = Date.now();
    const presenceData = {
      'user-2': {
        uid: 'user-2',
        displayName: 'Active User',
        email: 'active@example.com',
        color: '#6366f1',
        online: true,
        lastSeen: now,
      },
      'user-3': {
        uid: 'user-3',
        displayName: 'Offline User',
        email: 'offline@example.com',
        color: '#ec4899',
        online: false,
        lastSeen: now,
      },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof presenceData }) => void)({
        val: () => presenceData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Active User', 'active@example.com')
    );

    expect(result.current.onlineUsers).toHaveLength(1);
    expect(result.current.onlineUsers[0].uid).toBe('user-2');
  });

  it('filters out users whose lastSeen exceeds PRESENCE_TIMEOUT', () => {
    const now = Date.now();
    const presenceData = {
      'user-2': {
        uid: 'user-2',
        displayName: 'Recent User',
        email: 'recent@example.com',
        color: '#6366f1',
        online: true,
        lastSeen: now,
      },
      'user-3': {
        uid: 'user-3',
        displayName: 'Stale User',
        email: 'stale@example.com',
        color: '#ec4899',
        online: true,
        lastSeen: now - PRESENCE_TIMEOUT - 1000,
      },
    };

    vi.mocked(onValue).mockImplementation((_ref, callback) => {
      (callback as (snap: { val: () => typeof presenceData }) => void)({
        val: () => presenceData,
      });
      return vi.fn() as never;
    });

    const { result } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Me', 'me@example.com')
    );

    expect(result.current.onlineUsers).toHaveLength(1);
    expect(result.current.onlineUsers[0].uid).toBe('user-2');
  });
});
