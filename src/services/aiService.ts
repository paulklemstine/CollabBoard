import { collection, addDoc, onSnapshot, doc } from 'firebase/firestore';
import { db, auth } from './firebase';

interface AICommandOutput {
  response: string;
  objectsCreated: string[];
}

export async function sendAICommand(
  boardId: string,
  prompt: string,
): Promise<AICommandOutput> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to use AI commands.');
  }

  // Write request to Firestore — triggers the Cloud Function
  const requestsRef = collection(db, `boards/${boardId}/aiRequests`);
  const docRef = await addDoc(requestsRef, {
    prompt,
    userId: user.uid,
    status: 'pending',
    createdAt: Date.now(),
  });

  // Listen for the function to update the document with the response
  return new Promise<AICommandOutput>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('AI request timed out after 5 minutes'));
    }, 300000);

    const unsubscribe = onSnapshot(
      doc(db, `boards/${boardId}/aiRequests/${docRef.id}`),
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'completed') {
          clearTimeout(timeout);
          unsubscribe();
          resolve({
            response: data.response,
            objectsCreated: data.objectsCreated ?? [],
          });
        } else if (data.status === 'error') {
          clearTimeout(timeout);
          unsubscribe();
          reject(new Error(data.error || 'AI request failed'));
        }
      },
      (error) => {
        clearTimeout(timeout);
        unsubscribe();
        reject(error);
      },
    );
  });
}
