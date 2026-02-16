import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { StickyNote, Shape, Frame } from '../types/board';

export type AnyBoardObject = StickyNote | Shape | Frame;

function objectsCollection(boardId: string) {
  return collection(db, 'boards', boardId, 'objects');
}

export async function addObject(boardId: string, obj: AnyBoardObject): Promise<void> {
  const docRef = doc(objectsCollection(boardId), obj.id);
  await setDoc(docRef, obj);
}

export async function updateObject(
  boardId: string,
  objectId: string,
  updates: Partial<AnyBoardObject>
): Promise<void> {
  const docRef = doc(objectsCollection(boardId), objectId);
  await updateDoc(docRef, { ...updates, updatedAt: Date.now() });
}

export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  const docRef = doc(objectsCollection(boardId), objectId);
  await deleteDoc(docRef);
}

export function subscribeToBoard(
  boardId: string,
  callback: (objects: AnyBoardObject[]) => void
): Unsubscribe {
  return onSnapshot(objectsCollection(boardId), (snapshot) => {
    const objects = snapshot.docs.map((d) => d.data() as AnyBoardObject);
    callback(objects);
  });
}
