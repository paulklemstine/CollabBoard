import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  createBoard,
  deleteBoard,
  deleteBoardObjects,
  subscribeToAllBoards,
  updateBoardMetadata,
} from '../services/boardMetadataService';
import { useVisitedBoards } from './useVisitedBoards';
import { generateBoardId } from '../utils/boardId';
import type { BoardMetadata } from '../types/board';

export function useUserBoards(userId: string, isGuest: boolean, displayName: string) {
  const [allBoards, setAllBoards] = useState<BoardMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const { visitedBoardIds, markVisited } = useVisitedBoards(userId);

  useEffect(() => {
    const unsubscribe = subscribeToAllBoards((newBoards) => {
      setAllBoards(newBoards);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // "My Boards" = boards I created
  const myBoards = useMemo(() => {
    return allBoards.filter((b) => b.createdBy === userId);
  }, [allBoards, userId]);

  // "Shared with me" = private boards I visited but didn't create
  const sharedWithMe = useMemo(() => {
    const visitedSet = new Set(visitedBoardIds);
    return allBoards.filter(
      (b) => b.isPublic === false && b.createdBy !== userId && visitedSet.has(b.id),
    );
  }, [allBoards, userId, visitedBoardIds]);

  // "Public Boards" = isPublic !== false, not my own
  const publicBoards = useMemo(() => {
    return allBoards.filter(
      (b) => b.isPublic !== false && b.createdBy !== userId,
    );
  }, [allBoards, userId]);

  const addBoard = useCallback(
    async (name: string): Promise<string> => {
      const id = generateBoardId();
      const now = Date.now();
      const board: BoardMetadata = {
        id,
        name,
        createdBy: userId,
        createdByName: displayName,
        createdByGuest: isGuest,
        createdAt: now,
        updatedAt: now,
        isPublic: true,
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

  const toggleBoardVisibility = useCallback(
    async (boardId: string, isPublic: boolean) => {
      await updateBoardMetadata(boardId, { isPublic });
    },
    [],
  );

  return { myBoards, sharedWithMe, publicBoards, loading, addBoard, removeBoard, toggleBoardVisibility, markVisited };
}
