import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthPanel } from './AuthPanel';

const mockSignInWithGoogle = vi.fn();
const mockSignInAsGuest = vi.fn();
const mockSignOutUser = vi.fn();
const mockSignUpWithEmail = vi.fn();
const mockSignInWithEmail = vi.fn();

vi.mock('../../services/authService', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInAsGuest: (...args: unknown[]) => mockSignInAsGuest(...args),
  signOutUser: (...args: unknown[]) => mockSignOutUser(...args),
  signUpWithEmail: (...args: unknown[]) => mockSignUpWithEmail(...args),
  signInWithEmail: (...args: unknown[]) => mockSignInWithEmail(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthPanel', () => {
  describe('when not logged in', () => {
    it('renders sign-in buttons', () => {
      render(<AuthPanel user={null} />);

      expect(screen.getByRole('button', { name: /google/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /guest/i })).toBeInTheDocument();
    });

    it('renders email and password inputs', () => {
      render(<AuthPanel user={null} />);

      expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    });

    it('does not render name input in sign-in mode', () => {
      render(<AuthPanel user={null} />);

      expect(screen.queryByPlaceholderText('Name')).not.toBeInTheDocument();
    });

    it('renders Sign In button by default', () => {
      render(<AuthPanel user={null} />);

      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    });

    it('calls signInWithGoogle when Google button clicked', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      await user.click(screen.getByRole('button', { name: /google/i }));

      expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    });

    it('calls signInAsGuest when Guest button clicked', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      await user.click(screen.getByRole('button', { name: /guest/i }));

      expect(mockSignInAsGuest).toHaveBeenCalledTimes(1);
    });

    it('calls signInWithEmail when Sign In button clicked', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      expect(mockSignInWithEmail).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    it('toggles to sign-up mode and shows name input', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      // Click the "Sign Up" toggle link
      await user.click(screen.getByRole('button', { name: /^sign up$/i }));

      expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    });

    it('calls signUpWithEmail when Sign Up button clicked', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      // Switch to sign-up mode
      await user.click(screen.getByRole('button', { name: /^sign up$/i }));

      await user.type(screen.getByPlaceholderText('Name'), 'Alice');
      await user.type(screen.getByPlaceholderText('Email'), 'alice@example.com');
      await user.type(screen.getByPlaceholderText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: /^sign up$/i }));

      expect(mockSignUpWithEmail).toHaveBeenCalledWith('Alice', 'alice@example.com', 'password123');
    });

    it('displays error on sign-in failure', async () => {
      const err = new Error('Invalid credentials');
      (err as { code?: string }).code = 'auth/invalid-credential';
      mockSignInWithEmail.mockRejectedValue(err);
      const user = userEvent.setup();
      render(<AuthPanel user={null} />);

      await user.type(screen.getByPlaceholderText('Email'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('Password'), 'wrong');
      await user.click(screen.getByRole('button', { name: /^sign in$/i }));

      expect(await screen.findByText(/invalid|incorrect|sign-in/i)).toBeInTheDocument();
    });
  });

  describe('when logged in', () => {
    const mockUser = {
      uid: '123',
      displayName: 'Test User',
      email: 'test@example.com',
    };

    it('shows user display name', () => {
      render(<AuthPanel user={mockUser as never} />);

      expect(screen.getByText('Test User')).toBeInTheDocument();
    });

    it('shows sign out button', () => {
      render(<AuthPanel user={mockUser as never} />);

      expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
    });

    it('calls signOutUser when sign out clicked', async () => {
      const user = userEvent.setup();
      render(<AuthPanel user={mockUser as never} />);

      await user.click(screen.getByRole('button', { name: /sign out/i }));

      expect(mockSignOutUser).toHaveBeenCalledTimes(1);
    });
  });
});
