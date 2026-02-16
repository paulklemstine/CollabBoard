import { useState } from 'react';
import type { User } from 'firebase/auth';
import { signInWithGoogle, signInAsGuest, signOutUser } from '../../services/authService';

interface AuthPanelProps {
  user: User | null;
}

export function AuthPanel({ user }: AuthPanelProps) {
  const [error, setError] = useState<string | null>(null);

  const handleSignInWithGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(message);
    }
  };

  const handleSignInAsGuest = async () => {
    setError(null);
    try {
      await signInAsGuest();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign in as guest';
      setError(message);
    }
  };

  if (user) {
    return (
      <div className="flex items-center gap-4 p-4">
        <span>{user.displayName}</span>
        <button
          onClick={() => signOutUser()}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2 className="text-xl font-bold">Welcome to CollabBoard</h2>
      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded text-sm max-w-md text-center">
          {error}
        </div>
      )}
      <button
        onClick={handleSignInWithGoogle}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Sign in with Google
      </button>
      <button
        onClick={handleSignInAsGuest}
        className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
      >
        Continue as Guest
      </button>
    </div>
  );
}
