import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateBoardForm } from './CreateBoardForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateBoardForm', () => {
  it('renders input and submit button', () => {
    render(<CreateBoardForm onCreateBoard={vi.fn()} />);

    expect(screen.getByPlaceholderText('Board name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create board/i })).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<CreateBoardForm onCreateBoard={vi.fn()} />);

    expect(screen.getByRole('button', { name: /create board/i })).toBeDisabled();
  });

  it('submit button is enabled when input has text', async () => {
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Board name'), 'My Board');

    expect(screen.getByRole('button', { name: /create board/i })).toBeEnabled();
  });

  it('calls onCreateBoard with trimmed name on submit', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText('Board name'), '  My Board  ');
    await user.click(screen.getByRole('button', { name: /create board/i }));

    expect(onCreateBoard).toHaveBeenCalledWith('My Board');
  });

  it('clears input after successful creation', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText('Board name'), 'My Board');
    await user.click(screen.getByRole('button', { name: /create board/i }));

    expect(screen.getByPlaceholderText('Board name')).toHaveValue('');
  });

  it('does not submit when name is only whitespace', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText('Board name'), '   ');

    expect(screen.getByRole('button', { name: /create board/i })).toBeDisabled();
  });
});
