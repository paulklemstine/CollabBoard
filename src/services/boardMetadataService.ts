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
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { BoardMetadata } from '../types/board';

function boardDoc(boardId: string) {
  return doc(db, 'boards', boardId);
}

function objectsCollection(boardId: string) {
  return collection(db, 'boards', boardId, 'objects');
}

export async function createBoard(board: BoardMetadata): Promise<void> {
  await setDoc(boardDoc(board.id), board);
}

export async function deleteBoard(boardId: string): Promise<void> {
  await deleteDoc(boardDoc(boardId));
}

export async function deleteBoardObjects(boardId: string): Promise<void> {
  const snapshot = await getDocs(objectsCollection(boardId));
  const deletes = snapshot.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
}

export function subscribeToUserBoards(
  userId: string,
  callback: (boards: BoardMetadata[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'boards'),
    where('createdBy', '==', userId),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    const boards = snapshot.docs.map((d) => d.data() as BoardMetadata);
    callback(boards);
  });
}

export function subscribeToAllBoards(
  callback: (boards: BoardMetadata[]) => void,
): Unsubscribe {
  const q = query(
    collection(db, 'boards'),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(q, (snapshot) => {
    const boards = snapshot.docs.map((d) => d.data() as BoardMetadata);
    callback(boards);
  });
}
