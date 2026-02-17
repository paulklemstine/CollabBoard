import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoard } from './useBoard';
import * as boardService from '../services/boardService';
import type { StickyNote, Connector } from '../types/board';

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

  it('addShape calls addObject with a shape', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.addShape('rect', '#ef4444');
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'shape',
        shapeType: 'rect',
        color: '#ef4444',
        createdBy: 'user-1',
      })
    );
  });

  it('addFrame calls addObject with a frame', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.addFrame();
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'frame',
        title: '',
        createdBy: 'user-1',
      })
    );
  });

  it('addSticker calls addObject with a sticker', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.addSticker('👍');
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'sticker',
        emoji: '👍',
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

  it('updateTitle calls updateObject with new title', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.updateTitle('frame-1', 'New Title');
    });

    expect(boardService.updateObject).toHaveBeenCalledWith(
      'board-1',
      'frame-1',
      expect.objectContaining({ title: 'New Title' })
    );
  });

  it('removeObject calls deleteObject', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.removeObject('obj-1');
    });

    expect(boardService.deleteObject).toHaveBeenCalledWith('board-1', 'obj-1');
  });

  it('removeObject auto-deletes orphaned connectors', () => {
    const mockNote: StickyNote = {
      id: 'n1',
      type: 'sticky',
      x: 0, y: 0, width: 200, height: 200,
      rotation: 0, createdBy: 'user-1', updatedAt: 1000,
      text: 'test', color: '#fef08a',
    };
    const mockConnector: Connector = {
      id: 'conn-1',
      type: 'connector',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0, createdBy: 'user-1', updatedAt: 1000,
      fromId: 'n1', toId: 'n2', style: 'straight',
    };

    vi.mocked(boardService.subscribeToBoard).mockImplementation((_boardId, callback) => {
      callback([mockNote, mockConnector]);
      return vi.fn();
    });

    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.removeObject('n1');
    });

    expect(boardService.deleteObject).toHaveBeenCalledWith('board-1', 'conn-1');
    expect(boardService.deleteObject).toHaveBeenCalledWith('board-1', 'n1');
  });

  it('toggleConnectMode toggles connect mode', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    expect(result.current.connectMode).toBe(false);

    act(() => {
      result.current.toggleConnectMode();
    });

    expect(result.current.connectMode).toBe(true);

    act(() => {
      result.current.toggleConnectMode();
    });

    expect(result.current.connectMode).toBe(false);
  });

  it('handleObjectClickForConnect sets source then creates connector', () => {
    const mockNote1: StickyNote = {
      id: 'n1', type: 'sticky', x: 0, y: 0, width: 200, height: 200,
      rotation: 0, createdBy: 'user-1', updatedAt: 1000, text: '', color: '#fef08a',
    };
    const mockNote2: StickyNote = {
      id: 'n2', type: 'sticky', x: 300, y: 300, width: 200, height: 200,
      rotation: 0, createdBy: 'user-1', updatedAt: 1000, text: '', color: '#bbf7d0',
    };

    vi.mocked(boardService.subscribeToBoard).mockImplementation((_boardId, callback) => {
      callback([mockNote1, mockNote2]);
      return vi.fn();
    });

    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    act(() => {
      result.current.toggleConnectMode();
    });

    act(() => {
      result.current.handleObjectClickForConnect('n1');
    });

    expect(result.current.connectingFrom).toBe('n1');

    act(() => {
      result.current.handleObjectClickForConnect('n2');
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'connector',
        fromId: 'n1',
        toId: 'n2',
      })
    );
    expect(result.current.connectMode).toBe(false);
  });
});
