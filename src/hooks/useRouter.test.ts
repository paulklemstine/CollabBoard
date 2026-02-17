import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRouter } from './useRouter';

beforeEach(() => {
  window.location.hash = '';
});

describe('useRouter', () => {
  it('defaults to dashboard when hash is empty', () => {
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'dashboard' });
  });

  it('defaults to dashboard when hash is #/', () => {
    window.location.hash = '#/';
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'dashboard' });
  });

  it('parses board route from hash', () => {
    window.location.hash = '#/board/abc-123';
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'board', boardId: 'abc-123' });
  });

  it('navigateTo board sets hash', () => {
    const { result } = renderHook(() => useRouter());

    act(() => {
      result.current.navigateTo({ page: 'board', boardId: 'my-board' });
    });

    expect(window.location.hash).toBe('#/board/my-board');
  });

  it('navigateTo dashboard sets hash to #/', () => {
    window.location.hash = '#/board/some-board';
    const { result } = renderHook(() => useRouter());

    act(() => {
      result.current.navigateTo({ page: 'dashboard' });
    });

    expect(window.location.hash).toBe('#/');
  });

  it('responds to hashchange events', () => {
    const { result } = renderHook(() => useRouter());

    expect(result.current.route).toEqual({ page: 'dashboard' });

    act(() => {
      window.location.hash = '#/board/new-board';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    expect(result.current.route).toEqual({ page: 'board', boardId: 'new-board' });
  });

  it('cleans up hashchange listener on unmount', () => {
    const { unmount } = renderHook(() => useRouter());

    // Should not throw after unmount
    unmount();

    act(() => {
      window.location.hash = '#/board/after-unmount';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
});
