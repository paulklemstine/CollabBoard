import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Toolbar } from './Toolbar';

const defaultProps = {
  onAddStickyNote: vi.fn(),
  onAddShape: vi.fn(),
  onAddFrame: vi.fn(),
  onAddSticker: vi.fn(),
  connectMode: false,
  connectingFrom: null,
  onToggleConnectMode: vi.fn(),
  selectMode: false,
  onToggleSelectMode: vi.fn(),
};

describe('Toolbar', () => {
  it('renders the sticky note button', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText(/Sticky/)).toBeInTheDocument();
  });

  it('calls onAddStickyNote when button is clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();

    render(<Toolbar {...defaultProps} onAddStickyNote={onAdd} />);
    await user.click(screen.getByText(/Sticky/));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders color drawer', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Colors')).toBeInTheDocument();
  });

  it('renders shape drawer', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Shapes')).toBeInTheDocument();
  });

  it('renders connect button', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('shows "Click source..." when connect mode is active', () => {
    render(<Toolbar {...defaultProps} connectMode={true} connectingFrom={null} />);

    expect(screen.getByText('Click source...')).toBeInTheDocument();
  });

  it('shows "Click target..." when source is selected', () => {
    render(<Toolbar {...defaultProps} connectMode={true} connectingFrom="obj-1" />);

    expect(screen.getByText('Click target...')).toBeInTheDocument();
  });
});
