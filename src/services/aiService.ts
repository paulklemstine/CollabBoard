import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, auth, functions } from './firebase';
import type { ViewportCenter } from '../components/AIChat/AIChat';
import { detectTemplate, isClientExecutable, executeTemplateMatch } from './templateEngine';

const processAICallable = httpsCallable(functions, 'processAIRequestCallable', {
  timeout: 300_000,
});

export interface AICommandOutput {
  response: string;
  objectsCreated: string[];
}

export async function sendAICommand(
  boardId: string,
  prompt: string,
  onProgress?: (progress: string) => void,
  selectedIds?: string[],
  viewport?: ViewportCenter,
  signal?: AbortSignal,
): Promise<AICommandOutput> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use AI commands.');
  }

  // Fast path: client-side template engine (no Cloud Function call needed)
  const templateMatch = detectTemplate(prompt);
  if (templateMatch && isClientExecutable(templateMatch)) {
    try {
      return await executeTemplateMatch(templateMatch, boardId, user.uid, viewport);
    } catch (err) {
      console.warn('Client template failed, falling through to server:', err);
    }
  }

  // Create Firestore doc — triggers the onDocumentCreated Cloud Function
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

  // Fire callable immediately — bypasses Firestore trigger delivery latency (2-10s)
  // The Firestore listener below picks up progress updates and the final result.
  // Errors are handled by the listener (processAICore writes error status to Firestore).
  processAICallable({
    boardId,
    requestId: docRef.id,
    prompt,
    ...(selectedIds && selectedIds.length > 0 ? { selectedIds } : {}),
    ...(viewport ? { viewport } : {}),
  }).catch(() => {
    // Callable failed (e.g. cold start timeout, network error).
    // The Firestore trigger acts as a fallback — it will pick up the pending doc.
  });

  // Listen for the result via Firestore snapshot
  return new Promise<AICommandOutput>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsub();
      reject(new Error('AI request timed out after 5 minutes'));
    }, 300_000);

    const unsub = onSnapshot(requestDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!data) return;

      if (data.status === 'processing' && data.progress && onProgress) {
        onProgress(data.progress);
      }

      if (data.status === 'completed') {
        clearTimeout(timeout);
        unsub();
        resolve({
          response: data.response,
          objectsCreated: data.objectsCreated ?? [],
        });
      } else if (data.status === 'error') {
        clearTimeout(timeout);
        unsub();
        reject(new Error(data.error || 'AI request failed'));
      }
    });

    // Handle abort signal for cancellation
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        unsub();
        resolve({ response: 'Cancelled.', objectsCreated: [] });
      }, { once: true });
    }
  });
}
