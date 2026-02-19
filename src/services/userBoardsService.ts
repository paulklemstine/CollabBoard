import { doc, setDoc, onSnapshot, arrayUnion, type Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

function userBoardsDoc(userId: string) {
  return doc(db, 'userBoards', userId);
}

export async function addVisitedBoard(userId: string, boardId: string): Promise<void> {
  await setDoc(userBoardsDoc(userId), {
    visitedBoardIds: arrayUnion(boardId),
  }, { merge: true });
}

export function subscribeToVisitedBoardIds(
  userId: string,
  callback: (boardIds: string[]) => void,
): Unsubscribe {
  return onSnapshot(userBoardsDoc(userId), (snapshot) => {
    if (snapshot.exists()) {
      callback((snapshot.data().visitedBoardIds as string[]) ?? []);
    } else {
      callback([]);
    }
  });
}
