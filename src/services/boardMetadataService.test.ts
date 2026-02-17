import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import {
  createBoard,
  deleteBoard,
  deleteBoardObjects,
  subscribeToUserBoards,
  subscribeToAllBoards,
} from './boardMetadataService';
import type { BoardMetadata } from '../types/board';

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ id: 'mock-collection' })),
  doc: vi.fn(() => ({ id: 'mock-doc' })),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  query: vi.fn(() => ({ id: 'mock-query' })),
  where: vi.fn(),
  orderBy: vi.fn(),
  getDocs: vi.fn(() => ({ docs: [] })),
  getFirestore: vi.fn(),
}));

vi.mock('./firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockBoard: BoardMetadata = {
  id: 'board-1',
  name: 'Test Board',
  createdBy: 'user-1',
  createdAt: 1000,
  updatedAt: 1000,
};

describe('boardMetadataService', () => {
  it('createBoard writes a doc at boards/{boardId}', async () => {
    await createBoard(mockBoard);

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1');
    expect(setDoc).toHaveBeenCalledWith(expect.anything(), mockBoard);
  });

  it('deleteBoard removes the doc at boards/{boardId}', async () => {
    await deleteBoard('board-1');

    expect(doc).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1');
    expect(deleteDoc).toHaveBeenCalled();
  });

  it('deleteBoardObjects deletes all docs in boards/{boardId}/objects', async () => {
    const mockRef1 = { id: 'obj-1' };
    const mockRef2 = { id: 'obj-2' };
    vi.mocked(getDocs).mockResolvedValue({
      docs: [{ ref: mockRef1 }, { ref: mockRef2 }],
    } as never);

    await deleteBoardObjects('board-1');

    expect(collection).toHaveBeenCalledWith(expect.anything(), 'boards', 'board-1', 'objects');
    expect(deleteDoc).toHaveBeenCalledWith(mockRef1);
    expect(deleteDoc).toHaveBeenCalledWith(mockRef2);
  });

  it('deleteBoardObjects handles empty collection', async () => {
    vi.mocked(getDocs).mockResolvedValue({ docs: [] } as never);

    await deleteBoardObjects('board-1');

    expect(deleteDoc).not.toHaveBeenCalled();
  });

  it('subscribeToUserBoards queries boards by createdBy and orders by updatedAt', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(vi.fn() as never);

    subscribeToUserBoards('user-1', callback);

    expect(where).toHaveBeenCalledWith('createdBy', '==', 'user-1');
    expect(orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    expect(query).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('subscribeToUserBoards passes parsed boards to callback', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_ref, cb) => {
      (cb as (snap: { docs: { data: () => BoardMetadata }[] }) => void)({
        docs: [{ data: () => mockBoard }],
      });
      return vi.fn() as never;
    });

    subscribeToUserBoards('user-1', callback);

    expect(callback).toHaveBeenCalledWith([mockBoard]);
  });

  it('subscribeToUserBoards returns unsubscribe function', () => {
    const unsubscribe = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(unsubscribe as never);

    const result = subscribeToUserBoards('user-1', vi.fn());

    expect(result).toBe(unsubscribe);
  });

  it('subscribeToAllBoards queries all boards ordered by updatedAt', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockReturnValue(vi.fn() as never);

    subscribeToAllBoards(callback);

    expect(where).not.toHaveBeenCalled();
    expect(orderBy).toHaveBeenCalledWith('updatedAt', 'desc');
    expect(query).toHaveBeenCalled();
    expect(onSnapshot).toHaveBeenCalled();
  });

  it('subscribeToAllBoards passes parsed boards to callback', () => {
    const callback = vi.fn();
    vi.mocked(onSnapshot).mockImplementation((_ref, cb) => {
      (cb as (snap: { docs: { data: () => BoardMetadata }[] }) => void)({
        docs: [{ data: () => mockBoard }],
      });
      return vi.fn() as never;
    });

    subscribeToAllBoards(callback);

    expect(callback).toHaveBeenCalledWith([mockBoard]);
  });
});
