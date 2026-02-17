import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '../services/firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Force re-render after profile updates (e.g. updateProfile mutates the
  // User object but onAuthStateChanged doesn't fire again)
  const refreshUser = useCallback(() => {
    setTick(t => t + 1);
  }, []);

  return { user, loading, refreshUser };
}
