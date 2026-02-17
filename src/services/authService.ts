import {
  signInWithPopup,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase';

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signInAsGuest() {
  const result = await signInAnonymously(auth);
  const guestNumber = Math.floor(Math.random() * 10000);
  await updateProfile(result.user, {
    displayName: `Guest ${guestNumber}`,
  });
  return result;
}

export async function signUpWithEmail(name: string, email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name });
  return result;
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}
