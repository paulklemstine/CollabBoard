import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSetDoc = vi.fn();
const mockOnSnapshot = vi.fn();
const mockArrayUnion = vi.fn((val: string) => `__arrayUnion_${val}__`);
const mockDoc = vi.fn((_db: unknown, _col: string, _id: string) => `doc:userBoards/${_id}`);

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  arrayUnion: (val: string) => mockArrayUnion(val),
}));

vi.mock('./firebase', () => ({
  db: 'mock-db',
}));

import { addVisitedBoard, subscribeToVisitedBoardIds } from './userBoardsService';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('userBoardsService', () => {
  describe('addVisitedBoard', () => {
    it('writes board ID using arrayUnion with merge', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await addVisitedBoard('user-1', 'board-abc');

      expect(mockDoc).toHaveBeenCalledWith('mock-db', 'userBoards', 'user-1');
      expect(mockArrayUnion).toHaveBeenCalledWith('board-abc');
      expect(mockSetDoc).toHaveBeenCalledWith(
        'doc:userBoards/user-1',
        { visitedBoardIds: '__arrayUnion_board-abc__' },
        { merge: true },
      );
    });
  });

  describe('subscribeToVisitedBoardIds', () => {
    it('returns board IDs from snapshot data', () => {
      const callback = vi.fn();
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
        cb({
          exists: () => true,
          data: () => ({ visitedBoardIds: ['b1', 'b2'] }),
        });
        return unsubscribe;
      });

      const unsub = subscribeToVisitedBoardIds('user-1', callback);

      expect(callback).toHaveBeenCalledWith(['b1', 'b2']);
      expect(unsub).toBe(unsubscribe);
    });

    it('returns empty array when no document exists', () => {
      const callback = vi.fn();
      mockOnSnapshot.mockImplementation((_ref: unknown, cb: (snap: unknown) => void) => {
        cb({ exists: () => false });
        return vi.fn();
      });

      subscribeToVisitedBoardIds('user-1', callback);

      expect(callback).toHaveBeenCalledWith([]);
    });
  });
});
