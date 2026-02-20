import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL ?? '',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectDatabaseEmulator(rtdb, 'localhost', 9000);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFunctionsEmulator(functions, 'localhost', 5001);
  } catch {
    // Emulators already connected
  }
}
