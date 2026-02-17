import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signInWithPopup,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  updateProfile,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { signInWithGoogle, signInAsGuest, signOutUser, signUpWithEmail, signInWithEmail } from './authService';

vi.mock('firebase/auth', () => {
  const GoogleAuthProvider = vi.fn();
  return {
    GoogleAuthProvider,
    signInWithPopup: vi.fn(),
    signInAnonymously: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
    getAuth: vi.fn(),
    createUserWithEmailAndPassword: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
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

  describe('signUpWithEmail', () => {
    it('calls createUserWithEmailAndPassword and sets displayName', async () => {
      const mockUser = { uid: '789', displayName: null };
      vi.mocked(createUserWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as ReturnType<typeof createUserWithEmailAndPassword> extends Promise<infer T> ? T : never);
      vi.mocked(updateProfile).mockResolvedValue(undefined);

      const result = await signUpWithEmail('Alice', 'alice@example.com', 'password123');

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'alice@example.com', 'password123'
      );
      expect(updateProfile).toHaveBeenCalledWith(mockUser, { displayName: 'Alice' });
      expect(result.user).toEqual(mockUser);
    });
  });

  describe('signInWithEmail', () => {
    it('calls signInWithEmailAndPassword with email and password', async () => {
      const mockUser = { uid: '101', displayName: 'Alice' };
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser,
      } as ReturnType<typeof signInWithEmailAndPassword> extends Promise<infer T> ? T : never);

      const result = await signInWithEmail('alice@example.com', 'password123');

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'alice@example.com', 'password123'
      );
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
