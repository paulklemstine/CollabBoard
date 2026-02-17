import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserBoards } from './useUserBoards';
import * as boardMetadataService from '../services/boardMetadataService';
import type { BoardMetadata } from '../types/board';

let subscribeCb: ((boards: BoardMetadata[]) => void) | null = null;

vi.mock('../services/boardMetadataService', () => ({
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
  deleteBoardObjects: vi.fn(),
  subscribeToAllBoards: vi.fn((cb: (boards: BoardMetadata[]) => void) => {
    subscribeCb = cb;
    return vi.fn();
  }),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCb = null;
  vi.mocked(boardMetadataService.subscribeToAllBoards).mockImplementation(
    (cb: (boards: BoardMetadata[]) => void) => {
      subscribeCb = cb;
      return vi.fn();
    },
  );
});

describe('useUserBoards', () => {
  it('subscribes to all boards on mount', () => {
    renderHook(() => useUserBoards('user-1', false, 'Test User'));

    expect(boardMetadataService.subscribeToAllBoards).toHaveBeenCalledWith(
      expect.any(Function),
    );
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(boardMetadataService.subscribeToAllBoards).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useUserBoards('user-1', false, 'Test User'));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('starts with loading true and empty boards', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    expect(result.current.loading).toBe(true);
    expect(result.current.boards).toEqual([]);
  });

  it('sets loading false and updates boards when subscription fires', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    const mockBoard: BoardMetadata = {
      id: 'b1',
      name: 'Test',
      createdBy: 'user-1',
      createdByName: 'Test User',
      createdByGuest: false,
      createdAt: 1000,
      updatedAt: 1000,
    };

    act(() => {
      subscribeCb?.([mockBoard]);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.boards).toEqual([mockBoard]);
  });

  it('addBoard creates a board with createdByGuest false for regular users', async () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    let boardId: string = '';
    await act(async () => {
      boardId = await result.current.addBoard('My Board');
    });

    expect(boardId).toBeTruthy();
    expect(boardMetadataService.createBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        id: boardId,
        name: 'My Board',
        createdBy: 'user-1',
        createdByGuest: false,
      }),
    );
  });

  it('addBoard creates a board with createdByGuest true for guest users', async () => {
    const { result } = renderHook(() => useUserBoards('guest-1', true, 'Guest 1234'));

    let boardId: string = '';
    await act(async () => {
      boardId = await result.current.addBoard('Guest Board');
    });

    expect(boardMetadataService.createBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        id: boardId,
        name: 'Guest Board',
        createdBy: 'guest-1',
        createdByGuest: true,
      }),
    );
  });

  it('removeBoard deletes objects then board metadata', async () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    await act(async () => {
      await result.current.removeBoard('board-1');
    });

    expect(boardMetadataService.deleteBoardObjects).toHaveBeenCalledWith('board-1');
    expect(boardMetadataService.deleteBoard).toHaveBeenCalledWith('board-1');
  });
});
