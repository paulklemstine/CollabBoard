import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { CursorsOverlay } from './CursorsOverlay';
import type { CursorPosition } from '../../types/board';

const defaultTransform = { x: 0, y: 0, scale: 1 };

describe('CursorsOverlay', () => {
  it('renders a Cursor for each remote user', () => {
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 10, y: 20, name: 'Alice', color: '#f00', timestamp: 1 },
      { userId: 'u2', x: 30, y: 40, name: 'Bob', color: '#0f0', timestamp: 1 },
    ];

    const { getByText } = render(
      <CursorsOverlay cursors={cursors} stageTransform={defaultTransform} />,
    );

    expect(getByText('Alice')).toBeInTheDocument();
    expect(getByText('Bob')).toBeInTheDocument();
  });

  it('renders nothing when no cursors', () => {
    const { container } = render(
      <CursorsOverlay cursors={[]} stageTransform={defaultTransform} />,
    );

    // The overlay div exists but has no cursor children
    expect(container.querySelectorAll('[data-testid="cursor"]')).toHaveLength(0);
  });

  it('transforms world coordinates to screen coordinates', () => {
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 100, y: 200, name: 'Alice', color: '#f00', timestamp: 1 },
    ];
    const transform = { x: 50, y: -30, scale: 2 };

    const { getByTestId } = render(
      <CursorsOverlay cursors={cursors} stageTransform={transform} />,
    );

    const cursor = getByTestId('cursor');
    // screenX = 100 * 2 + 50 = 250, screenY = 200 * 2 + (-30) = 370
    expect(cursor.style.left).toBe('250px');
    expect(cursor.style.top).toBe('370px');
  });
});
