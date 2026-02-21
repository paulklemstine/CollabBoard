import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';
import type { ViewportCenter } from '../components/AIChat/AIChat';

export interface AICommandOutput {
  response: string;
  objectsCreated: string[];
}

// Callable function reference (reused across calls)
const processAICallable = httpsCallable<
  { boardId: string; requestId: string; prompt: string; selectedIds?: string[]; viewport?: ViewportCenter },
  AICommandOutput
>(functions, 'processAIRequestCallable', { timeout: 300_000 });

export async function sendAICommand(
  boardId: string,
  prompt: string,
  onProgress?: (progress: string) => void,
  selectedIds?: string[],
  viewport?: ViewportCenter,
): Promise<AICommandOutput> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use AI commands.');
  }

  // 1. Create Firestore doc for progress tracking (also serves as trigger fallback)
  const requestsRef = collection(db, `boards/${boardId}/aiRequests`);
  const docRef = await addDoc(requestsRef, {
    prompt,
    userId: user.uid,
    status: 'pending',
    createdAt: Date.now(),
    ...(selectedIds && selectedIds.length > 0 ? { selectedIds } : {}),
    ...(viewport ? { viewport } : {}),
  });

  const requestDocRef = doc(db, `boards/${boardId}/aiRequests/${docRef.id}`);

  // 2. Set up progress listener on the Firestore doc
  let unsubscribe: (() => void) | null = null;
  if (onProgress) {
    unsubscribe = onSnapshot(requestDocRef, (snapshot) => {
      const data = snapshot.data();
      if (data?.status === 'processing' && data.progress) {
        onProgress(data.progress);
      }
    });
  }

  // 3. Try callable first (lower latency), fall back to Firestore trigger
  try {
    const result = await processAICallable({
      boardId,
      requestId: docRef.id,
      prompt,
      selectedIds,
      viewport,
    });

    unsubscribe?.();
    return result.data;
  } catch {
    // Callable failed (likely IAM/permissions) — trigger will pick up the pending doc
    return new Promise<AICommandOutput>((resolve, reject) => {
      const timeout = setTimeout(() => {
        triggerUnsub();
        unsubscribe?.();
        reject(new Error('AI request timed out after 5 minutes'));
      }, 300_000);

      const triggerUnsub = onSnapshot(requestDocRef, (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'processing' && data.progress && onProgress) {
          onProgress(data.progress);
        }

        if (data.status === 'completed') {
          clearTimeout(timeout);
          triggerUnsub();
          unsubscribe?.();
          resolve({
            response: data.response,
            objectsCreated: data.objectsCreated ?? [],
          });
        } else if (data.status === 'error') {
          clearTimeout(timeout);
          triggerUnsub();
          unsubscribe?.();
          reject(new Error(data.error || 'AI request failed'));
        }
      });
    });
  }
}
