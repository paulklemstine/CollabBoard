import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PresencePanel } from './PresencePanel';
import type { PresenceUser, CursorPosition } from '../../types/board';

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

  it('calls onFollowUser with uid when clicking a user with viewport data', () => {
    const users: PresenceUser[] = [
      { uid: 'u1', displayName: 'Alice', email: '', color: '#f00', online: true, lastSeen: 1 },
    ];
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 100, y: 200, name: 'Alice', color: '#f00', timestamp: 1,
        viewportX: -50, viewportY: -30, viewportScale: 1.5 },
    ];
    const onFollowUser = vi.fn();

    render(<PresencePanel users={users} cursors={cursors} onFollowUser={onFollowUser} />);

    fireEvent.click(screen.getByTestId('presence-user-u1'));
    expect(onFollowUser).toHaveBeenCalledWith('u1');
  });

  it('does not call onFollowUser when clicking a user without viewport data', () => {
    const users: PresenceUser[] = [
      { uid: 'u1', displayName: 'Alice', email: '', color: '#f00', online: true, lastSeen: 1 },
    ];
    const onFollowUser = vi.fn();

    render(<PresencePanel users={users} cursors={[]} onFollowUser={onFollowUser} />);

    fireEvent.click(screen.getByTestId('presence-user-u1'));
    expect(onFollowUser).not.toHaveBeenCalled();
  });

  it('is not clickable for cursors without viewport data', () => {
    const users: PresenceUser[] = [
      { uid: 'u1', displayName: 'Alice', email: '', color: '#f00', online: true, lastSeen: 1 },
    ];
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 100, y: 200, name: 'Alice', color: '#f00', timestamp: 1 },
    ];
    const onFollowUser = vi.fn();

    render(<PresencePanel users={users} cursors={cursors} onFollowUser={onFollowUser} />);

    fireEvent.click(screen.getByTestId('presence-user-u1'));
    expect(onFollowUser).not.toHaveBeenCalled();
  });

  it('shows button role only for users with viewport data', () => {
    const users: PresenceUser[] = [
      { uid: 'u1', displayName: 'Alice', email: '', color: '#f00', online: true, lastSeen: 1 },
      { uid: 'u2', displayName: 'Bob', email: '', color: '#0f0', online: true, lastSeen: 1 },
    ];
    const cursors: CursorPosition[] = [
      { userId: 'u1', x: 100, y: 200, name: 'Alice', color: '#f00', timestamp: 1,
        viewportX: 0, viewportY: 0, viewportScale: 1 },
    ];
    const onFollowUser = vi.fn();

    render(<PresencePanel users={users} cursors={cursors} onFollowUser={onFollowUser} />);

    const aliceRow = screen.getByTestId('presence-user-u1');
    const bobRow = screen.getByTestId('presence-user-u2');

    expect(aliceRow.getAttribute('role')).toBe('button');
    expect(bobRow.getAttribute('role')).toBeNull();
  });
});
