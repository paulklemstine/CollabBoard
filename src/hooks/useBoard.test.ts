import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoard } from './useBoard';
import * as boardService from '../services/boardService';
import type { AnyBoardObject } from '../services/boardService';
import type { StickyNote, Connector, Frame } from '../types/board';

let subscribeCb: ((objects: AnyBoardObject[]) => void) | null = null;

vi.mock('../services/boardService', () => ({
  addObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  subscribeToBoard: vi.fn((_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
    subscribeCb = cb;
    return vi.fn();
  }),
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
      result.current.addStickyNote({ x: 0, y: 0, scale: 1 }, 100, 150);
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
      result.current.addShape({ x: 0, y: 0, scale: 1 }, 'rect', '#ef4444');
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
      result.current.addFrame({ x: 0, y: 0, scale: 1 });
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
    const mockTransform = { x: 0, y: 0, scale: 1 };

    act(() => {
      result.current.addSticker(mockTransform, '👍');
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

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'frame-1',
    type: 'frame',
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    rotation: 0,
    createdBy: 'user-1',
    updatedAt: 0,
    title: '',
    ...overrides,
  };
}

function makeSticky(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: 'sticky-1',
    type: 'sticky',
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    rotation: 0,
    createdBy: 'user-1',
    updatedAt: 0,
    text: '',
    color: '#fef08a',
    ...overrides,
  };
}

function setObjects(objects: AnyBoardObject[]) {
  act(() => {
    subscribeCb?.(objects);
  });
}

describe('useBoard containment', () => {
  beforeEach(() => {
    // Re-establish subscribeCb capture since earlier tests may override mockImplementation
    vi.mocked(boardService.subscribeToBoard).mockImplementation(
      (_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
        subscribeCb = cb;
        return vi.fn();
      }
    );
  });

  it('handleDragEnd sets parentId when dropped inside a frame', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ id: 's1', x: 200, y: 200, width: 100, height: 100 });
    setObjects([frame, sticky]);

    // Drop sticky at (250, 250) — center is (300, 300), inside frame
    act(() => {
      result.current.handleDragEnd('s1', 250, 250);
    });

    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's1', {
      x: 250,
      y: 250,
      parentId: 'f1',
    });
  });

  it('handleDragEnd clears parentId when dropped outside all frames', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ id: 's1', x: 200, y: 200, width: 100, height: 100, parentId: 'f1' });
    setObjects([frame, sticky]);

    // Drop sticky at (600, 600) — center is (650, 650), outside frame
    act(() => {
      result.current.handleDragEnd('s1', 600, 600);
    });

    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's1', {
      x: 600,
      y: 600,
      parentId: '',
    });
  });

  it('handleDragMove sets hoveredFrame during drag', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ id: 's1', x: 0, y: 0, width: 100, height: 100 });
    setObjects([frame, sticky]);

    // Drag sticky to (250, 250) — center (300, 300), inside frame
    act(() => {
      result.current.handleDragMove('s1', 250, 250);
    });

    expect(result.current.hoveredFrame).toEqual({ id: 'f1', fits: true });
  });

  it('handleDragEnd clears hoveredFrame', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ id: 's1', x: 0, y: 0, width: 100, height: 100 });
    setObjects([frame, sticky]);

    act(() => {
      result.current.handleDragMove('s1', 250, 250);
    });
    expect(result.current.hoveredFrame).toEqual({ id: 'f1', fits: true });

    act(() => {
      result.current.handleDragEnd('s1', 250, 250);
    });
    expect(result.current.hoveredFrame).toBeNull();
  });

  it('handleFrameDragMove moves frame but defers children to drag end', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const child1 = makeSticky({ id: 's1', x: 200, y: 200, parentId: 'f1' });
    const child2 = makeSticky({ id: 's2', x: 300, y: 300, parentId: 'f1' });
    const independent = makeSticky({ id: 's3', x: 500, y: 500 });
    setObjects([frame, child1, child2, independent]);

    // Move frame by (50, 30): from (100,100) to (150,130)
    act(() => {
      result.current.handleFrameDragMove('f1', 150, 130);
    });

    // Frame itself is updated in Firestore
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 'f1', { x: 150, y: 130 });
    // Children should NOT be written during drag move (they use local offset)
    expect(boardService.updateObject).not.toHaveBeenCalledWith('board-1', 's1', expect.anything());
    expect(boardService.updateObject).not.toHaveBeenCalledWith('board-1', 's2', expect.anything());
    // frameDragOffset should be set
    expect(result.current.frameDragOffset).toEqual({ frameId: 'f1', dx: 50, dy: 30 });
  });

  it('handleFrameDragEnd persists children positions and clears offset', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const child1 = makeSticky({ id: 's1', x: 200, y: 200, parentId: 'f1' });
    const child2 = makeSticky({ id: 's2', x: 300, y: 300, parentId: 'f1' });
    const independent = makeSticky({ id: 's3', x: 500, y: 500 });
    setObjects([frame, child1, child2, independent]);

    // Start the drag to set the start ref
    act(() => {
      result.current.handleFrameDragMove('f1', 150, 130);
    });
    vi.mocked(boardService.updateObject).mockClear();

    // End the drag at (150, 130) — delta (50, 30) from original (100, 100)
    act(() => {
      result.current.handleFrameDragEnd('f1', 150, 130);
    });

    // Frame position persisted
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 'f1', { x: 150, y: 130 });
    // Child 1: (200+50, 200+30) = (250, 230)
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's1', { x: 250, y: 230 });
    // Child 2: (300+50, 300+30) = (350, 330)
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's2', { x: 350, y: 330 });
    // Independent object should NOT have been moved
    expect(boardService.updateObject).not.toHaveBeenCalledWith('board-1', 's3', expect.anything());
    // Offset should be cleared
    expect(result.current.frameDragOffset).toBeNull();
  });

  it('removeObject unparents children when deleting a frame', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const frame = makeFrame({ id: 'f1', x: 100, y: 100 });
    const child1 = makeSticky({ id: 's1', parentId: 'f1' });
    const child2 = makeSticky({ id: 's2', parentId: 'f1' });
    setObjects([frame, child1, child2]);

    act(() => {
      result.current.removeObject('f1');
    });

    // Children should be unparented
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's1', { parentId: '' });
    expect(boardService.updateObject).toHaveBeenCalledWith('board-1', 's2', { parentId: '' });
    // Frame should be deleted
    expect(boardService.deleteObject).toHaveBeenCalledWith('board-1', 'f1');
  });
});

describe('useBoard z-index (updatedAt)', () => {
  beforeEach(() => {
    // Re-establish subscribeCb capture
    vi.mocked(boardService.subscribeToBoard).mockImplementation(
      (_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
        subscribeCb = cb;
        return vi.fn();
      }
    );
  });

  it('addStickyNote creates object with higher updatedAt than existing objects', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const existingObjects: AnyBoardObject[] = [
      makeSticky({ id: 's1', updatedAt: 1000 }),
      makeSticky({ id: 's2', updatedAt: 2000 }),
      makeFrame({ id: 'f1', updatedAt: 1500 }),
    ];
    setObjects(existingObjects);

    act(() => {
      result.current.addStickyNote({ x: 0, y: 0, scale: 1 }, 100, 150);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'sticky',
        updatedAt: 2001, // maxUpdatedAt (2000) + 1
      })
    );
  });

  it('addShape creates object with higher updatedAt than existing objects', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const existingObjects: AnyBoardObject[] = [
      makeSticky({ id: 's1', updatedAt: 1000 }),
      makeSticky({ id: 's2', updatedAt: 3000 }),
    ];
    setObjects(existingObjects);

    act(() => {
      result.current.addShape({ x: 0, y: 0, scale: 1 }, 'rect', '#ef4444', 200, 200);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'shape',
        updatedAt: 3001, // maxUpdatedAt (3000) + 1
      })
    );
  });

  it('addFrame creates object with higher updatedAt than existing objects', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const existingObjects: AnyBoardObject[] = [
      makeSticky({ id: 's1', updatedAt: 5000 }),
      makeFrame({ id: 'f1', updatedAt: 4000 }),
    ];
    setObjects(existingObjects);

    act(() => {
      result.current.addFrame({ x: 0, y: 0, scale: 1 }, 300, 300);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'frame',
        updatedAt: 5001, // maxUpdatedAt (5000) + 1
      })
    );
  });

  it('addSticker creates object with higher updatedAt than existing objects', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const existingObjects: AnyBoardObject[] = [
      makeSticky({ id: 's1', updatedAt: 7000 }),
      makeSticky({ id: 's2', updatedAt: 8000 }),
    ];
    setObjects(existingObjects);

    const mockTransform = { x: 0, y: 0, scale: 1 };

    act(() => {
      result.current.addSticker(mockTransform, '👍', 400, 400);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'sticker',
        updatedAt: 8001, // maxUpdatedAt (8000) + 1
      })
    );
  });

  it('connector creation uses higher updatedAt than existing objects', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    const note1 = makeSticky({ id: 'n1', updatedAt: 9000 });
    const note2 = makeSticky({ id: 'n2', updatedAt: 10000 });
    setObjects([note1, note2]);

    act(() => {
      result.current.toggleConnectMode();
    });

    act(() => {
      result.current.handleObjectClickForConnect('n1');
    });

    act(() => {
      result.current.handleObjectClickForConnect('n2');
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        type: 'connector',
        updatedAt: 10001, // maxUpdatedAt (10000) + 1
      })
    );
  });

  it('new object has updatedAt of 1 when board is empty', () => {
    const { result } = renderHook(() => useBoard('board-1', 'user-1'));

    // No objects on the board
    setObjects([]);

    act(() => {
      result.current.addStickyNote({ x: 0, y: 0, scale: 1 }, 100, 150);
    });

    expect(boardService.addObject).toHaveBeenCalledWith(
      'board-1',
      expect.objectContaining({
        updatedAt: 1, // Math.max(0, ...[]) + 1 = 0 + 1 = 1
      })
    );
  });
});
