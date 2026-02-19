import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardDashboard } from './BoardDashboard';
import * as useUserBoardsModule from '../../hooks/useUserBoards';
import type { BoardMetadata } from '../../types/board';

vi.mock('../../hooks/useUserBoards', () => ({
  useUserBoards: vi.fn(),
}));

vi.mock('../../services/firebase', () => ({
  db: {},
}));

const mockUser = {
  uid: 'user-1',
  displayName: 'Test User',
  email: 'test@example.com',
  isAnonymous: false,
};

const mockAddBoard = vi.fn().mockResolvedValue('new-board-id');
const mockRemoveBoard = vi.fn().mockResolvedValue(undefined);
const mockToggleBoardVisibility = vi.fn().mockResolvedValue(undefined);
const mockMarkVisited = vi.fn();

function mockHook(overrides: Partial<ReturnType<typeof useUserBoardsModule.useUserBoards>> = {}) {
  vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
    myBoards: [],
    sharedWithMe: [],
    publicBoards: [],
    loading: false,
    addBoard: mockAddBoard,
    removeBoard: mockRemoveBoard,
    toggleBoardVisibility: mockToggleBoardVisibility,
    markVisited: mockMarkVisited,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHook();
});

describe('BoardDashboard', () => {
  it('renders welcome message with user name', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('renders sign out button', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('calls onSignOut when sign out clicked', async () => {
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={onSignOut} />,
    );

    await user.click(screen.getByRole('button', { name: /sign out/i }));

    expect(onSignOut).toHaveBeenCalled();
  });

  it('shows loading spinner when loading', () => {
    mockHook({ loading: true });

    const { container } = render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(container.querySelector('.animate-spin-loader')).toBeInTheDocument();
  });

  it('renders My Boards section heading', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('My Boards')).toBeInTheDocument();
  });

  it('renders Public Boards section heading', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('Public Boards')).toBeInTheDocument();
  });

  it('shows empty state for My Boards when empty', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('No boards yet')).toBeInTheDocument();
  });

  it('shows empty state for Public Boards when empty', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('No public boards')).toBeInTheDocument();
  });

  it('shows user-created boards under My Boards', () => {
    const myBoards: BoardMetadata[] = [
      { id: 'b1', name: 'My Board', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 1000, updatedAt: 1000 },
    ];
    mockHook({ myBoards });

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('My Board')).toBeInTheDocument();
  });

  it('shows public boards under Public Boards', () => {
    const publicBoards: BoardMetadata[] = [
      { id: 'b2', name: 'Public Board', createdBy: 'user-2', createdByName: 'Other User', createdByGuest: false, createdAt: 2000, updatedAt: 2000, isPublic: true },
    ];
    mockHook({ publicBoards });

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('Public Board')).toBeInTheDocument();
  });

  it('hides Shared with me section when empty', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.queryByText('Shared with me')).not.toBeInTheDocument();
  });

  it('shows shared private boards under Shared with me', () => {
    const sharedWithMe: BoardMetadata[] = [
      { id: 'b3', name: 'Secret Board', createdBy: 'user-2', createdByName: 'Other User', createdByGuest: false, createdAt: 3000, updatedAt: 3000, isPublic: false },
    ];
    mockHook({ sharedWithMe });

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('Shared with me')).toBeInTheDocument();
    expect(screen.getByText('Secret Board')).toBeInTheDocument();
  });

  it('calls onSelectBoard when a board card is clicked', async () => {
    const myBoards: BoardMetadata[] = [
      { id: 'b1', name: 'Board One', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 1000, updatedAt: 1000 },
    ];
    mockHook({ myBoards });

    const onSelectBoard = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardDashboard user={mockUser} onSelectBoard={onSelectBoard} onSignOut={vi.fn()} />,
    );

    await user.click(screen.getByText('Board One'));

    expect(onSelectBoard).toHaveBeenCalledWith('b1');
  });

  it('creates board and navigates to it', async () => {
    const onSelectBoard = vi.fn();
    const user = userEvent.setup();
    render(
      <BoardDashboard user={mockUser} onSelectBoard={onSelectBoard} onSignOut={vi.fn()} />,
    );

    await user.type(screen.getByPlaceholderText(/name your flow/i), 'New Board');
    await user.click(screen.getByRole('button', { name: /launch flow/i }));

    expect(mockAddBoard).toHaveBeenCalledWith('New Board');
    expect(onSelectBoard).toHaveBeenCalledWith('new-board-id');
  });

  it('sets up a delayed timer on mount to trigger re-render', () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
  });
});
