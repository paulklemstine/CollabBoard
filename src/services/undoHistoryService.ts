import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { UndoEntry } from '../hooks/useUndoRedo';

interface UndoHistoryDoc {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
  updatedAt: number;
}

const MAX_DOC_BYTES = 800_000; // 800KB safety margin under Firestore's 1MB limit

function undoHistoryDocRef(boardId: string, userId: string) {
  return doc(db, 'boards', boardId, 'undoHistory', userId);
}

/**
 * Drop oldest entries from the stacks until the serialized size
 * fits under MAX_DOC_BYTES.
 */
function trimToFit(undoStack: UndoEntry[], redoStack: UndoEntry[]): {
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];
} {
  let trimmedUndo = [...undoStack];
  let trimmedRedo = [...redoStack];

  // Quick check — most cases will be well under the limit
  const json = JSON.stringify({ undoStack: trimmedUndo, redoStack: trimmedRedo });
  if (json.length <= MAX_DOC_BYTES) {
    return { undoStack: trimmedUndo, redoStack: trimmedRedo };
  }

  // Drop oldest undo entries first (front of array)
  while (trimmedUndo.length > 0) {
    trimmedUndo = trimmedUndo.slice(1);
    if (JSON.stringify({ undoStack: trimmedUndo, redoStack: trimmedRedo }).length <= MAX_DOC_BYTES) {
      return { undoStack: trimmedUndo, redoStack: trimmedRedo };
    }
  }

  // If still too large, drop oldest redo entries
  while (trimmedRedo.length > 0) {
    trimmedRedo = trimmedRedo.slice(1);
    if (JSON.stringify({ undoStack: trimmedUndo, redoStack: trimmedRedo }).length <= MAX_DOC_BYTES) {
      return { undoStack: trimmedUndo, redoStack: trimmedRedo };
    }
  }

  return { undoStack: [], redoStack: [] };
}

export async function loadUndoState(
  boardId: string,
  userId: string
): Promise<{ undoStack: UndoEntry[]; redoStack: UndoEntry[] } | null> {
  try {
    const snap = await getDoc(undoHistoryDocRef(boardId, userId));
    if (!snap.exists()) return null;
    const data = snap.data() as UndoHistoryDoc;
    return {
      undoStack: data.undoStack ?? [],
      redoStack: data.redoStack ?? [],
    };
  } catch {
    return null;
  }
}

export function saveUndoState(
  boardId: string,
  userId: string,
  undoStack: UndoEntry[],
  redoStack: UndoEntry[]
): void {
  const trimmed = trimToFit(undoStack, redoStack);
  // Fire-and-forget — in-memory state is the source of truth
  setDoc(undoHistoryDocRef(boardId, userId), {
    undoStack: trimmed.undoStack,
    redoStack: trimmed.redoStack,
    updatedAt: Date.now(),
  } satisfies UndoHistoryDoc).catch(() => {});
}
