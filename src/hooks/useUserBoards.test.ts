import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserBoards } from './useUserBoards';
import * as boardMetadataService from '../services/boardMetadataService';
import type { BoardMetadata } from '../types/board';

let subscribeCb: ((boards: BoardMetadata[]) => void) | null = null;
let visitedCb: ((ids: string[]) => void) | null = null;
const mockMarkVisited = vi.fn();

vi.mock('../services/boardMetadataService', () => ({
  createBoard: vi.fn(),
  deleteBoard: vi.fn(),
  deleteBoardObjects: vi.fn(),
  updateBoardMetadata: vi.fn(),
  subscribeToAllBoards: vi.fn((cb: (boards: BoardMetadata[]) => void) => {
    subscribeCb = cb;
    return vi.fn();
  }),
}));

vi.mock('./useVisitedBoards', () => ({
  useVisitedBoards: vi.fn(() => ({
    visitedBoardIds: visitedCb ? [] : [],
    markVisited: mockMarkVisited,
  })),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

import * as useVisitedBoardsModule from './useVisitedBoards';

beforeEach(() => {
  vi.clearAllMocks();
  subscribeCb = null;
  visitedCb = null;
  vi.mocked(boardMetadataService.subscribeToAllBoards).mockImplementation(
    (cb: (boards: BoardMetadata[]) => void) => {
      subscribeCb = cb;
      return vi.fn();
    },
  );
  vi.mocked(useVisitedBoardsModule.useVisitedBoards).mockReturnValue({
    visitedBoardIds: [],
    markVisited: mockMarkVisited,
  });
});

const makeBoard = (overrides: Partial<BoardMetadata> & { id: string; createdBy: string }): BoardMetadata => ({
  name: 'Board',
  createdByName: 'User',
  createdByGuest: false,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
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

  it('starts with loading true and empty board lists', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    expect(result.current.loading).toBe(true);
    expect(result.current.myBoards).toEqual([]);
    expect(result.current.sharedWithMe).toEqual([]);
    expect(result.current.publicBoards).toEqual([]);
  });

  it('separates boards into myBoards and publicBoards', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    act(() => {
      subscribeCb?.([
        makeBoard({ id: 'b1', createdBy: 'user-1', name: 'My Board' }),
        makeBoard({ id: 'b2', createdBy: 'user-2', name: 'Public Board', isPublic: true }),
      ]);
    });

    expect(result.current.myBoards).toHaveLength(1);
    expect(result.current.myBoards[0].name).toBe('My Board');
    expect(result.current.publicBoards).toHaveLength(1);
    expect(result.current.publicBoards[0].name).toBe('Public Board');
  });

  it('puts visited private boards in sharedWithMe', () => {
    vi.mocked(useVisitedBoardsModule.useVisitedBoards).mockReturnValue({
      visitedBoardIds: ['b3'],
      markVisited: mockMarkVisited,
    });

    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    act(() => {
      subscribeCb?.([
        makeBoard({ id: 'b3', createdBy: 'user-2', name: 'Visited Private', isPublic: false }),
      ]);
    });

    expect(result.current.myBoards).toHaveLength(0);
    expect(result.current.sharedWithMe).toHaveLength(1);
    expect(result.current.sharedWithMe[0].name).toBe('Visited Private');
    expect(result.current.publicBoards).toHaveLength(0);
  });

  it('excludes private boards from publicBoards', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    act(() => {
      subscribeCb?.([
        makeBoard({ id: 'b1', createdBy: 'user-2', name: 'Private', isPublic: false }),
        makeBoard({ id: 'b2', createdBy: 'user-2', name: 'Public' }),
      ]);
    });

    expect(result.current.publicBoards).toHaveLength(1);
    expect(result.current.publicBoards[0].name).toBe('Public');
  });

  it('treats boards without isPublic field as public', () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    act(() => {
      subscribeCb?.([
        makeBoard({ id: 'b1', createdBy: 'user-2', name: 'Old Board' }),
      ]);
    });

    expect(result.current.publicBoards).toHaveLength(1);
  });

  it('addBoard generates a 10-character base36 ID', async () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    let boardId: string = '';
    await act(async () => {
      boardId = await result.current.addBoard('My Board');
    });

    expect(boardId).toMatch(/^[0-9a-z]{10}$/);
  });

  it('addBoard sets isPublic to true', async () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    await act(async () => {
      await result.current.addBoard('My Board');
    });

    expect(boardMetadataService.createBoard).toHaveBeenCalledWith(
      expect.objectContaining({ isPublic: true }),
    );
  });

  it('addBoard creates a board with createdByGuest true for guest users', async () => {
    const { result } = renderHook(() => useUserBoards('guest-1', true, 'Guest 1234'));

    await act(async () => {
      await result.current.addBoard('Guest Board');
    });

    expect(boardMetadataService.createBoard).toHaveBeenCalledWith(
      expect.objectContaining({
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

  it('toggleBoardVisibility calls updateBoardMetadata', async () => {
    const { result } = renderHook(() => useUserBoards('user-1', false, 'Test User'));

    await act(async () => {
      await result.current.toggleBoardVisibility('board-1', false);
    });

    expect(boardMetadataService.updateBoardMetadata).toHaveBeenCalledWith('board-1', { isPublic: false });
  });
});
