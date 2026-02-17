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

  it('renders shape buttons', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Rect')).toBeInTheDocument();
    expect(screen.getByText('Circle')).toBeInTheDocument();
    expect(screen.getByText('Line')).toBeInTheDocument();
  });

  it('calls onAddShape with correct args when rect is clicked', async () => {
    const user = userEvent.setup();
    const onAddShape = vi.fn();

    render(<Toolbar {...defaultProps} onAddShape={onAddShape} />);
    await user.click(screen.getByText('Rect'));

    expect(onAddShape).toHaveBeenCalledWith('rect', expect.any(String));
  });

  it('renders frame button', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Frame')).toBeInTheDocument();
  });

  it('calls onAddFrame when frame button is clicked', async () => {
    const user = userEvent.setup();
    const onAddFrame = vi.fn();

    render(<Toolbar {...defaultProps} onAddFrame={onAddFrame} />);
    await user.click(screen.getByText('Frame'));

    expect(onAddFrame).toHaveBeenCalledOnce();
  });

  it('renders sticker button', () => {
    render(<Toolbar {...defaultProps} />);

    expect(screen.getByText('Sticker')).toBeInTheDocument();
  });

  it('shows emoji picker when sticker button clicked', async () => {
    const user = userEvent.setup();

    render(<Toolbar {...defaultProps} />);
    await user.click(screen.getByText('Sticker'));

    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('calls onAddSticker when emoji is selected', async () => {
    const user = userEvent.setup();
    const onAddSticker = vi.fn();

    render(<Toolbar {...defaultProps} onAddSticker={onAddSticker} />);
    await user.click(screen.getByText('Sticker'));
    await user.click(screen.getByText('👍'));

    expect(onAddSticker).toHaveBeenCalledWith('👍');
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
