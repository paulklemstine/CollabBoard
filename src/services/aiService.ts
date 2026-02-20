import { collection, addDoc, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';

export interface AICommandOutput {
  response: string;
  objectsCreated: string[];
}

// Callable function reference (reused across calls)
const processAICallable = httpsCallable<
  { boardId: string; requestId: string; prompt: string; selectedIds?: string[] },
  AICommandOutput
>(functions, 'processAIRequestCallable', { timeout: 300_000 });

export async function sendAICommand(
  boardId: string,
  prompt: string,
  onProgress?: (progress: string) => void,
  selectedIds?: string[],
): Promise<AICommandOutput> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use AI commands.');
  }

  // 1. Create Firestore doc for progress tracking (also serves as fallback trigger)
  const requestsRef = collection(db, `boards/${boardId}/aiRequests`);
  const docRef = await addDoc(requestsRef, {
    prompt,
    userId: user.uid,
    status: 'pending',
    createdAt: Date.now(),
    ...(selectedIds && selectedIds.length > 0 ? { selectedIds } : {}),
  });

  // 2. Set up progress listener on the Firestore doc
  let unsubscribe: (() => void) | null = null;
  if (onProgress) {
    unsubscribe = onSnapshot(
      doc(db, `boards/${boardId}/aiRequests/${docRef.id}`),
      (snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'processing' && data.progress) {
          onProgress(data.progress);
        }
      },
    );
  }

  // 3. Call the function directly (bypasses Firestore trigger latency)
  try {
    // Mark as callable-owned so the trigger skips it
    await updateDoc(doc(db, `boards/${boardId}/aiRequests/${docRef.id}`), { status: 'callable' });

    const result = await processAICallable({
      boardId,
      requestId: docRef.id,
      prompt,
      selectedIds,
    });

    return result.data;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'AI request failed';
    throw new Error(message);
  } finally {
    unsubscribe?.();
  }
}
