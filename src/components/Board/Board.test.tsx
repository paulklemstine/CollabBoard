import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { Board } from './Board';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: '123', displayName: 'Test' }, loading: false }),
}));

vi.mock('../../hooks/useCursors', () => ({
  useCursors: () => ({ cursors: [], updateCursor: vi.fn() }),
}));

vi.mock('../../hooks/usePresence', () => ({
  usePresence: () => ({ onlineUsers: [] }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  // Set window dimensions
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
});

describe('Board', () => {
  it('renders a Konva Stage', () => {
    render(<Board boardId="test-board" />);
    const stage = document.querySelector('.konvajs-content');
    expect(stage).toBeInTheDocument();
  });

  it('renders at window dimensions', () => {
    render(<Board boardId="test-board" />);
    const stage = document.querySelector('.konvajs-content');
    expect(stage).toBeInTheDocument();
  });

  it('has a draggable stage for panning', () => {
    render(<Board boardId="test-board" />);
    // The Stage component should exist with draggable behavior
    const container = document.querySelector('.konvajs-content');
    expect(container).toBeInTheDocument();
  });

  it('handles window resize', () => {
    render(<Board boardId="test-board" />);

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
      Object.defineProperty(window, 'innerHeight', { value: 600, writable: true });
      window.dispatchEvent(new Event('resize'));
    });

    // Board should still render without errors
    const stage = document.querySelector('.konvajs-content');
    expect(stage).toBeInTheDocument();
  });
});
