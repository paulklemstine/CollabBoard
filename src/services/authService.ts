import {
  signInWithPopup,
  signInAnonymously,
  signOut,
  GoogleAuthProvider,
  updateProfile,
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

export async function signOutUser() {
  return signOut(auth);
}
