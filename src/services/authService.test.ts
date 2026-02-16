import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  updateProfile,
} from 'firebase/auth';
import { signInWithGoogle, signInAsGuest, signOutUser } from './authService';

vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn();
  return {
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    getAuth: vi.fn(),
  };
});

vi.mock('./firebase', () => ({
  auth: { currentUser: null },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authService', () => {
  describe('signInWithGoogle', () => {
    it('calls signInWithPopup with GoogleAuthProvider', async () => {
      const mockUser = { uid: '123', displayName: 'Test User' };
      vi.mocked(signInWithPopup).mockResolvedValue({
        user: mockUser,
      } as ReturnType<typeof signInWithPopup> extends Promise<infer T> ? T : never);

      const result = await signInWithGoogle();

      expect(signInWithPopup).toHaveBeenCalledTimes(1);
      expect(GoogleAuthProvider).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signInAsGuest', () => {
    it('calls signInAnonymously and assigns a display name', async () => {
      const mockUser = { uid: '456', displayName: null };
      vi.mocked(firebaseSignInAnonymously).mockResolvedValue({
        user: mockUser,
      } as ReturnType<typeof firebaseSignInAnonymously> extends Promise<infer T> ? T : never);
      vi.mocked(updateProfile).mockResolvedValue(undefined);

      const result = await signInAsGuest();

      expect(firebaseSignInAnonymously).toHaveBeenCalledTimes(1);
      expect(updateProfile).toHaveBeenCalledWith(mockUser, {
        displayName: expect.stringMatching(/^Guest \d+$/),
      });
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signOutUser', () => {
    it('calls firebase signOut', async () => {
      vi.mocked(firebaseSignOut).mockResolvedValue(undefined);

      await signOutUser();

      expect(firebaseSignOut).toHaveBeenCalledTimes(1);
    });
  });
});
