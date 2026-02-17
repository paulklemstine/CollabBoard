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

  // Override window.open to center the popup
  const originalOpen = window.open;
  window.open = function(url, target, features) {
    // Calculate centered position
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    // Create centered features string
    const centeredFeatures = `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`;

    // Call original with centered parameters
    return originalOpen.call(this, url, target, centeredFeatures);
  };

  try {
    const result = await signInWithPopup(auth, provider);
    return result;
  } finally {
    // Restore original window.open
    window.open = originalOpen;
  }
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
  // Reload so onAuthStateChanged picks up the updated displayName
  await result.user.reload();
  return result;
}

export async function signInWithEmail(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser() {
  return signOut(auth);
}
