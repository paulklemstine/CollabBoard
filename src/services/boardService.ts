import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { StickyNote, Shape, Frame, Sticker, Connector, TextObject } from '../types/board';

export type AnyBoardObject = StickyNote | Shape | Frame | Sticker | Connector | TextObject;

function objectsCollection(boardId: string) {
  return collection(db, 'boards', boardId, 'objects');
}

export async function addObject(boardId: string, obj: AnyBoardObject): Promise<void> {
  if (!obj.id) return;
  const docRef = doc(objectsCollection(boardId), obj.id);
  await setDoc(docRef, obj);
}

export async function updateObject(
  boardId: string,
  objectId: string,
  updates: Partial<AnyBoardObject>
): Promise<void> {
  if (!objectId) return;
  const docRef = doc(objectsCollection(boardId), objectId);
  await updateDoc(docRef, { ...updates, updatedAt: Date.now() });
}

export async function deleteObject(boardId: string, objectId: string): Promise<void> {
  if (!objectId) return;
  const docRef = doc(objectsCollection(boardId), objectId);
  await deleteDoc(docRef);
}

/**
 * Batch add multiple objects atomically using writeBatch.
 * All clones appear simultaneously — no partial state visible to other users.
 */
export async function batchAddObjects(
  boardId: string,
  objs: AnyBoardObject[]
): Promise<void> {
  if (objs.length === 0) return;

  const batch = writeBatch(db);
  for (const obj of objs) {
    if (!obj.id) continue;
    const docRef = doc(objectsCollection(boardId), obj.id);
    batch.set(docRef, obj);
  }
  await batch.commit();
}

/**
 * Batch update multiple objects atomically.
 * Useful for updating frame children positions to avoid flickering.
 */
export async function batchUpdateObjects(
  boardId: string,
  updates: Array<{ id: string; updates: Partial<AnyBoardObject> }>
): Promise<void> {
  const valid = updates.filter(({ id }) => !!id);
  if (valid.length === 0) return;

  const batch = writeBatch(db);
  const now = Date.now();

  for (const { id, updates: objUpdates } of valid) {
    const docRef = doc(objectsCollection(boardId), id);
    batch.update(docRef, { ...objUpdates, updatedAt: now });
  }

  await batch.commit();
}

/**
 * Batch delete multiple objects atomically.
 * Used by undo to remove objects created in a single action.
 */
export async function batchDeleteObjects(
  boardId: string,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;

  const batch = writeBatch(db);
  for (const id of ids) {
    if (!id) continue;
    batch.delete(doc(objectsCollection(boardId), id));
  }
  await batch.commit();
}

export async function getBoardObjects(boardId: string): Promise<AnyBoardObject[]> {
  const snapshot = await getDocs(objectsCollection(boardId));
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as AnyBoardObject);
}

export function subscribeToBoard(
  boardId: string,
  callback: (objects: AnyBoardObject[]) => void
): Unsubscribe {
  return onSnapshot(objectsCollection(boardId), (snapshot) => {
    const objects = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as AnyBoardObject);
    callback(objects);
  });
}
