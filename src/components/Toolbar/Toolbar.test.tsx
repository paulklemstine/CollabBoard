import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('renders the sticky note button', () => {
    render(<Toolbar onAddStickyNote={vi.fn()} />);

    expect(screen.getByText(/Sticky Note/)).toBeInTheDocument();
  });

  it('calls onAddStickyNote when button is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<Toolbar onAddStickyNote={onAdd} />);
    await user.click(screen.getByText(/Sticky Note/));

    expect(onAdd).toHaveBeenCalledOnce();
  });
});
