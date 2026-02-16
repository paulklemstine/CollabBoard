import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CursorsOverlay } from './CursorsOverlay';
import type { CursorPosition } from '../../types/board';

describe('CursorsOverlay', () => {
  it('renders a Cursor for each remote user', () => {
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 10, y: 20, name: 'Alice', color: '#f00', timestamp: 1 },
      { userId: 'u2', x: 30, y: 40, name: 'Bob', color: '#0f0', timestamp: 1 },
    ];

    const { getByText } = render(<CursorsOverlay cursors={cursors} />);

    expect(getByText('Alice')).toBeInTheDocument();
    expect(getByText('Bob')).toBeInTheDocument();
  });

  it('renders nothing when no cursors', () => {
    const { container } = render(<CursorsOverlay cursors={[]} />);

    // The overlay div exists but has no cursor children
    expect(container.querySelectorAll('[data-testid="cursor"]')).toHaveLength(0);
  });
});
