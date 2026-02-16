import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ref, onValue, set, onDisconnect, off } from 'firebase/database';
import { usePresence } from './usePresence';

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ key: 'mock-ref' })),
  onValue: vi.fn(),
  set: vi.fn(),
  off: vi.fn(),
  remove: vi.fn(),
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

  it('subscribes to all presence and returns online users', () => {
    const presenceData = {
      'user-1': { uid: 'user-1', displayName: 'Me', email: '', color: '#f00', online: true, lastSeen: 1 },
      'user-2': { uid: 'user-2', displayName: 'Other', email: '', color: '#0f0', online: true, lastSeen: 1 },
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

    expect(result.current.onlineUsers).toHaveLength(2);
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

  it('unsubscribes and marks offline on unmount', () => {
    vi.mocked(onValue).mockReturnValue(vi.fn() as never);

    const { unmount } = renderHook(() =>
      usePresence('board-1', 'user-1', 'Test', '')
    );

    unmount();

    expect(off).toHaveBeenCalled();
    // set is called on mount (online=true) and unmount (online=false)
    expect(set).toHaveBeenCalledTimes(2);
  });
});
