import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoard } from './useBoard';
import * as boardService from '../services/boardService';
import type { StickyNote } from '../types/board';

vi.mock('../services/boardService', () => ({
  addObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  subscribeToBoard: vi.fn(() => vi.fn()),
}));

vi.mock('../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useBoard', () => {
  it('subscribes to board on mount', () => {
    renderHook(() => useBoard('board-1', 'user-1'));

    expect(boardService.subscribeToBoard).toHaveBeenCalledWith(
      'board-1',
      expect.any(Function)
    );
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.mocked(boardService.subscribeToBoard).mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useBoard('board-1', 'user-1'));
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it('updates objects when subscription fires', () => {
    const mockNote: StickyNote = {
      id: 'n1',
      type: 'sticky',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      createdBy: 'user-1',
      updatedAt: 1000,
      text: 'test',
      color: '#fef08a',
    };

    vi.mocked(boardService.subscribeToBoard).mockImplementation((_boardId, callback) => {
      callback([mockNote]);
      return vi.fn();
    });

    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    expect(result.current.objects).toHaveLength(1);
    expect(result.current.objects[0].id).toBe('n1');
  });

  it('addStickyNote calls addObject with a sticky note', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.addStickyNote(100, 150);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'sticky',
        x: 100,
        y: 150,
        createdBy: 'user-1',
      })
    );
  });

  it('moveObject calls updateObject with new position', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.moveObject('obj-1', 50, 75);
    });

    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 'obj-1', { x: 50, y: 75 });
  });

  it('updateText calls updateObject with new text', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.updateText('obj-1', 'new text');
    });

    expect(boardService.updateObject).toHaveBeenCalledWith(
      'board-1',
      'obj-1',
      expect.objectContaining({ text: 'new text' })
    );
  });

  it('removeObject calls deleteObject', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.removeObject('obj-1');
    });

    expect(boardService.deleteObject).toHaveBeenCalledWith('board-1', 'obj-1');
  });
});
