import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouter } from './useRouter';

beforeEach(() => {
  // Reset to root path
  window.history.replaceState(null, '', '/');
  window.location.hash = '';
});

describe('useRouter', () => {
  it('defaults to dashboard when path is /', () => {
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'dashboard' });
  });

  it('parses board route from path', () => {
    window.history.replaceState(null, '', '/abc123');
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'board', boardId: 'abc123' });
  });

  it('supports legacy hash URLs and redirects to clean path', () => {
    window.location.hash = '#/board/old-uuid-id';
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'board', boardId: 'old-uuid-id' });
    expect(window.location.pathname).toBe('/old-uuid-id');
  });

  it('navigateTo board sets path', () => {
    const { result } = renderHook(() => useRouter());

    act(() => {
      result.current.navigateTo({ page: 'board', boardId: 'my-board' });
    });

    expect(window.location.pathname).toBe('/my-board');
    expect(result.current.route).toEqual({ page: 'board', boardId: 'my-board' });
  });

  it('navigateTo dashboard sets path to /', () => {
    window.history.replaceState(null, '', '/some-board');
    const { result } = renderHook(() => useRouter());

    act(() => {
      result.current.navigateTo({ page: 'dashboard' });
    });

    expect(window.location.pathname).toBe('/');
    expect(result.current.route).toEqual({ page: 'dashboard' });
  });

  it('responds to popstate events', () => {
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'dashboard' });

    act(() => {
      window.history.pushState(null, '', '/new-board');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current.route).toEqual({ page: 'board', boardId: 'new-board' });
  });

  it('cleans up popstate listener on unmount', () => {
    const { unmount } = renderHook(() => useRouter());

    unmount();

    act(() => {
      window.history.pushState(null, '', '/after-unmount');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Should not throw after unmount
  });
});
