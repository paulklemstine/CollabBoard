import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
    boards: [],
    loading: false,
    addBoard: mockAddBoard,
    removeBoard: mockRemoveBoard,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BoardDashboard', () => {
  it('renders welcome message with user name', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText(/welcome, test user/i)).toBeInTheDocument();
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
    vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
      boards: [],
      loading: true,
      addBoard: mockAddBoard,
      removeBoard: mockRemoveBoard,
    });

    const { container } = render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(container.querySelector('.animate-spin-loader')).toBeInTheDocument();
  });

  it('shows empty state when no boards', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText(/no boards yet/i)).toBeInTheDocument();
  });

  it('renders board cards when boards exist', () => {
    const boards: BoardMetadata[] = [
      { id: 'b1', name: 'Board One', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 1000, updatedAt: 1000 },
      { id: 'b2', name: 'Board Two', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 2000, updatedAt: 2000 },
    ];
    vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
      boards,
      loading: false,
      addBoard: mockAddBoard,
      removeBoard: mockRemoveBoard,
    });

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByText('Board One')).toBeInTheDocument();
    expect(screen.getByText('Board Two')).toBeInTheDocument();
  });

  it('calls onSelectBoard when a board card is clicked', async () => {
    const boards: BoardMetadata[] = [
      { id: 'b1', name: 'Board One', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 1000, updatedAt: 1000 },
    ];
    vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
      boards,
      loading: false,
      addBoard: mockAddBoard,
      removeBoard: mockRemoveBoard,
    });

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

    await user.type(screen.getByPlaceholderText('Board name'), 'New Board');
    await user.click(screen.getByRole('button', { name: /create board/i }));

    expect(mockAddBoard).toHaveBeenCalledWith('New Board');
    expect(onSelectBoard).toHaveBeenCalledWith('new-board-id');
  });

  it('renders create board form', () => {
    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByPlaceholderText('Board name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create board/i })).toBeInTheDocument();
  });

  it('shows delete button only for owned boards and guest-created boards', () => {
    const boards: BoardMetadata[] = [
      { id: 'b1', name: 'My Board', createdBy: 'user-1', createdByName: 'Test User', createdByGuest: false, createdAt: 1000, updatedAt: 1000 },
      { id: 'b2', name: 'Other Board', createdBy: 'user-2', createdByName: 'Other User', createdByGuest: false, createdAt: 2000, updatedAt: 2000 },
      { id: 'b3', name: 'Guest Board', createdBy: 'guest-1', createdByName: 'Guest 5678', createdByGuest: true, createdAt: 3000, updatedAt: 3000 },
    ];
    vi.mocked(useUserBoardsModule.useUserBoards).mockReturnValue({
      boards,
      loading: false,
      addBoard: mockAddBoard,
      removeBoard: mockRemoveBoard,
    });

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    expect(screen.getByLabelText(/delete my board/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/delete other board/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/delete guest board/i)).toBeInTheDocument();
  });

  it('sets up a delayed timer on mount to trigger re-render', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(
      <BoardDashboard user={mockUser} onSelectBoard={vi.fn()} onSignOut={vi.fn()} />,
    );

    // Should set up a timeout for delayed refresh
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 500);
    setTimeoutSpy.mockRestore();
  });
});
