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

    expect(screen.getByPlaceholderText(/name your flow/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /launch flow/i })).toBeInTheDocument();
  });

  it('submit button is disabled when input is empty', () => {
    render(<CreateBoardForm onCreateBoard={vi.fn()} />);

    expect(screen.getByRole('button', { name: /launch flow/i })).toBeDisabled();
  });

  it('submit button is enabled when input has text', async () => {
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/name your flow/i), 'My Board');

    expect(screen.getByRole('button', { name: /launch flow/i })).toBeEnabled();
  });

  it('calls onCreateBoard with trimmed name on submit', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText(/name your flow/i), '  My Board  ');
    await user.click(screen.getByRole('button', { name: /launch flow/i }));

    expect(onCreateBoard).toHaveBeenCalledWith('My Board');
  });

  it('clears input after successful creation', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText(/name your flow/i), 'My Board');
    await user.click(screen.getByRole('button', { name: /launch flow/i }));

    expect(screen.getByPlaceholderText(/name your flow/i)).toHaveValue('');
  });

  it('does not submit when name is only whitespace', async () => {
    const onCreateBoard = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CreateBoardForm onCreateBoard={onCreateBoard} />);

    await user.type(screen.getByPlaceholderText(/name your flow/i), '   ');

    expect(screen.getByRole('button', { name: /launch flow/i })).toBeDisabled();
  });
});
