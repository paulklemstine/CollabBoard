import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ColorPicker, COLORS } from './ColorPicker';

describe('ColorPicker', () => {
  it('renders all color swatches', () => {
    render(<ColorPicker selectedColor={COLORS[0]} onSelectColor={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(COLORS.length);
  });

  it('calls onSelectColor when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<ColorPicker selectedColor={COLORS[0]} onSelectColor={onSelect} />);

    const buttons = screen.getAllByRole('button');
    await user.click(buttons[2]);

    expect(onSelect).toHaveBeenCalledWith(COLORS[2]);
  });

  it('highlights the selected color with box-shadow glow', () => {
    render(<ColorPicker selectedColor={COLORS[1]} onSelectColor={vi.fn()} />);

    const buttons = screen.getAllByRole('button');
    const style = buttons[1].style;
    // Selected color gets a multi-ring box-shadow with the color's glow
    expect(style.boxShadow).toContain(COLORS[1]);
  });
});
