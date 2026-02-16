import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PresencePanel } from './PresencePanel';
import type { PresenceUser } from '../../types/board';

describe('PresencePanel', () => {
  it('shows user count', () => {
    const users: PresenceUser[] = [
      { uid: '1', displayName: 'Alice', email: '', color: '#f00', online: true, lastSeen: 1 },
      { uid: '2', displayName: 'Bob', email: '', color: '#0f0', online: true, lastSeen: 1 },
    ];

    render(<PresencePanel users={users} />);

    expect(screen.getByText(/2/)).toBeInTheDocument();
  });

  it('shows colored dots and names', () => {
    const users: PresenceUser[] = [
      { uid: '1', displayName: 'Alice', email: '', color: '#ff0000', online: true, lastSeen: 1 },
    ];

    render(<PresencePanel users={users} />);

    expect(screen.getByText('Alice')).toBeInTheDocument();
    const dot = screen.getByTestId('presence-dot-1');
    expect(dot).toBeInTheDocument();
  });

  it('renders nothing when no users', () => {
    render(<PresencePanel users={[]} />);

    expect(screen.getByText(/0/)).toBeInTheDocument();
  });
});
