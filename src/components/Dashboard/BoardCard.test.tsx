import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoardCard } from './BoardCard';
import type { BoardMetadata } from '../../types/board';

beforeEach(() => {
  vi.clearAllMocks();
});

const mockBoard: BoardMetadata = {
  id: 'board-1',
  name: 'Test Board',
  createdBy: 'user-1',
  createdByGuest: false,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

describe('BoardCard', () => {
  it('renders board name', () => {
    render(<BoardCard board={mockBoard} onSelect={vi.fn()} onDelete={vi.fn()} canDelete />);

    expect(screen.getByText('Test Board')).toBeInTheDocument();
  });

  it('renders formatted creation date', () => {
    render(<BoardCard board={mockBoard} onSelect={vi.fn()} onDelete={vi.fn()} canDelete />);

    expect(screen.getByText(/Created/)).toBeInTheDocument();
  });

  it('calls onSelect with board id when clicked', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<BoardCard board={mockBoard} onSelect={onSelect} onDelete={vi.fn()} canDelete />);

    await user.click(screen.getByText('Test Board'));

    expect(onSelect).toHaveBeenCalledWith('board-1');
  });

  it('shows delete button when canDelete is true', () => {
    render(<BoardCard board={mockBoard} onSelect={vi.fn()} onDelete={vi.fn()} canDelete />);

    expect(screen.getByLabelText(/delete test board/i)).toBeInTheDocument();
  });

  it('calls onDelete with board id when delete button clicked', async () => {
    const onDelete = vi.fn();
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<BoardCard board={mockBoard} onSelect={onSelect} onDelete={onDelete} canDelete />);

    await user.click(screen.getByLabelText(/delete test board/i));

    expect(onDelete).toHaveBeenCalledWith('board-1');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('hides delete button when canDelete is false', () => {
    render(<BoardCard board={mockBoard} onSelect={vi.fn()} onDelete={vi.fn()} canDelete={false} />);

    expect(screen.queryByLabelText(/delete test board/i)).not.toBeInTheDocument();
  });
});
