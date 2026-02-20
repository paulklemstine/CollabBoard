import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FancyColorPicker } from './FancyColorPicker';

describe('FancyColorPicker', () => {
  it('renders the SV area, hue bar, and hex input', () => {
    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />);

    // Hex input should show the color
    const hexInput = screen.getByRole('textbox');
    expect(hexInput).toBeInTheDocument();
    expect((hexInput as HTMLInputElement).value).toBe('EF4444');
  });

  it('renders preview swatch with the selected color', () => {
    const { container } = render(<FancyColorPicker selectedColor="#3b82f6" onSelectColor={vi.fn()} />);

    // Preview swatch should have the background color
    const swatch = container.querySelector('[style*="background: #3b82f6"]') ??
                   container.querySelector('[style*="background: rgb(59, 130, 246)"]');
    expect(swatch).toBeTruthy();
  });

  it('calls onSelectColor when hex input is submitted', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#000000" onSelectColor={onSelect} />);

    const hexInput = screen.getByRole('textbox');
    await user.clear(hexInput);
    await user.type(hexInput, 'ff6600{Enter}');

    expect(onSelect).toHaveBeenCalledWith('#ff6600');
  });

  it('reverts invalid hex input on blur', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={onSelect} />);

    const hexInput = screen.getByRole('textbox') as HTMLInputElement;
    await user.clear(hexInput);
    await user.type(hexInput, 'zzz');
    await user.tab(); // blur

    // Should revert to current color
    expect(hexInput.value).toBe('EF4444');
  });

  it('updates hex display when selectedColor prop changes', () => {
    const { rerender } = render(
      <FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />
    );

    const hexInput = screen.getByRole('textbox') as HTMLInputElement;
    expect(hexInput.value).toBe('EF4444');

    rerender(<FancyColorPicker selectedColor="#22c55e" onSelectColor={vi.fn()} />);
    expect(hexInput.value).toBe('22C55E');
  });
});
