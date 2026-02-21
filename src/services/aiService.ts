import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from './firebase';
import type { ViewportCenter } from '../components/AIChat/AIChat';
import { detectTemplate, isClientExecutable, executeTemplateMatch } from './templateEngine';

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
