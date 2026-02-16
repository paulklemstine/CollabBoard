import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { addObject, updateObject, deleteObject, subscribeToBoard } from './boardService';
import type { StickyNote } from '../types/board';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock-collection' })),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock('./firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockNote: StickyNote = {
  id: 'note-1',
  type: 'sticky',
  x: 100,
  y: 200,
  width: 200,
  height: 200,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  text: 'Hello',
  color: '#fef08a',
};

describe('boardService', () => {
  it('addObject creates a doc in the board objects collection', async () => {
    await addObject('board-1', mockNote);

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1', 'objects');
    expect(doc).toHaveBeenCalledWith(expect.anything(), 'note-1');
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), mockNote);
  });

  it('updateObject updates a doc with new fields and updatedAt', async () => {
    await updateObject('board-1', 'note-1', { x: 300 });

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'note-1');
    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ x: 300, updatedAt: expect.any(Number) })
    );
  });

  it('deleteObject removes the doc', async () => {
    await deleteObject('board-1', 'note-1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'note-1');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('subscribeToBoard listens to the objects collection', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(vi.fn() as never);

    subscribeToBoard('board-1', callback);

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1', 'objects');
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('subscribeToBoard passes parsed objects to callback', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_ref, cb) => {
      (cb as (snap: { docs: { data: () => StickyNote }[] }) => void)({
        docs: [{ data: () => mockNote }],
      });
      return vi.fn() as never;
    });

    subscribeToBoard('board-1', callback);

    expect(callback).toHaveBeenCalledWith([mockNote]);
  });
});
