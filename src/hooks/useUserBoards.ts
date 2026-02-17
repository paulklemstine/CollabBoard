import { useState, useEffect, useCallback } from 'react';
import {
  createBoard,
  deleteBoard,
  deleteBoardObjects,
  subscribeToAllBoards,
} from '../services/boardMetadataService';
import type { BoardMetadata } from '../types/board';

export function useUserBoards(userId: string, isGuest: boolean, displayName: string) {
  const [boards, setBoards] = useState<BoardMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAllBoards((newBoards) => {
      setBoards(newBoards);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const addBoard = useCallback(
    async (name: string): Promise<string> => {
      const id = crypto.randomUUID();
      const now = Date.now();
      const board: BoardMetadata = {
        id,
        name,
        createdBy: userId,
        createdByName: displayName,
        createdByGuest: isGuest,
        createdAt: now,
        updatedAt: now,
      };
      await createBoard(board);
      return id;
    },
    [userId, isGuest, displayName],
  );

  const removeBoard = useCallback(async (boardId: string): Promise<void> => {
    await deleteBoardObjects(boardId);
    await deleteBoard(boardId);
  }, []);

  return { boards, loading, addBoard, removeBoard };
}
