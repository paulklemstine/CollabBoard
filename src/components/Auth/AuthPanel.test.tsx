import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthPanel } from './AuthPanel';

const mockSignInWithGoogle = vi.fn();
const mockSignInAsGuest = vi.fn();
const mockSignOutUser = vi.fn();

vi.mock('../../services/authService', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInAsGuest: (...args: unknown[]) => mockSignInAsGuest(...args),
  signOutUser: (...args: unknown[]) => mockSignOutUser(...args),
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
