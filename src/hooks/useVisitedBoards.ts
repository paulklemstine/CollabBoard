import { useState, useEffect, useCallback } from 'react';
import { subscribeToVisitedBoardIds, addVisitedBoard } from '../services/userBoardsService';

export function useVisitedBoards(userId: string) {
  const [visitedBoardIds, setVisitedBoardIds] = useState<string[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeToVisitedBoardIds(userId, setVisitedBoardIds);
    return unsubscribe;
  }, [userId]);

  const markVisited = useCallback(
    async (boardId: string) => {
      await addVisitedBoard(userId, boardId);
    },
    [userId],
  );

  return { visitedBoardIds, markVisited };
}
