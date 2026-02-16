import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useAuth } from './useAuth';

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn(),
  getAuth: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  auth: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAuth', () => {
  it('starts with loading true and user null', () => {
    vi.mocked(onAuthStateChanged).mockReturnValue(vi.fn());

    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('sets user and loading false when auth state changes', async () => {
    const mockUser = { uid: '123', displayName: 'Test' } as User;
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      (callback as (user: User | null) => void)(mockUser);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.loading).toBe(false);
    });
  });

  it('sets user to null on sign out', async () => {
    vi.mocked(onAuthStateChanged).mockImplementation((_auth, callback) => {
      (callback as (user: User | null) => void)(null);
      return vi.fn();
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toBeNull();
      expect(result.current.loading).toBe(false);
    });
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(onAuthStateChanged).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useAuth());
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
