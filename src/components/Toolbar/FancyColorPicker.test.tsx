import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FancyColorPicker } from './FancyColorPicker';

describe('FancyColorPicker', () => {
  it('renders the color wheel canvas', () => {
    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders brightness slider', () => {
    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />);

    const slider = screen.getByRole('slider');
    expect(slider).toBeInTheDocument();
  });

  it('renders all preset colors', () => {
    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />);

    const presetButtons = screen.getAllByRole('button');
    // 16 preset colors
    expect(presetButtons).toHaveLength(16);
  });

  it('calls onSelectColor when a preset is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#000000" onSelectColor={onSelect} />);

    const presetButtons = screen.getAllByRole('button');
    await user.click(presetButtons[0]); // Click first preset (#fecaca)

    expect(onSelect).toHaveBeenCalledWith('#fecaca');
  });

  it('updates internal HSV state when preset color is selected', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#000000" onSelectColor={onSelect} />);

    const presetButtons = screen.getAllByRole('button');
    const slider = screen.getByRole('slider') as HTMLInputElement;

    // Initially, brightness should be at default (90)
    expect(slider.value).toBe('90');

    // Click a preset with high brightness (e.g., #ef4444 - bright red)
    await user.click(presetButtons[8]); // #ef4444

    // After clicking preset, the internal state should update
    // #ef4444 is rgb(239, 68, 68) which has brightness ~94%
    expect(onSelect).toHaveBeenCalledWith('#ef4444');

    // The slider value should reflect the preset's brightness
    // Allow some tolerance for HSV conversion rounding
    const brightnessValue = parseInt(slider.value);
    expect(brightnessValue).toBeGreaterThan(85);
    expect(brightnessValue).toBeLessThan(100);
  });

  it('updates current color display when preset is selected', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#000000" onSelectColor={onSelect} />);

    const presetButtons = screen.getAllByRole('button');
    await user.click(presetButtons[8]); // #ef4444

    // The color display should show the selected preset color
    const colorDisplay = screen.getByText('#ef4444');
    expect(colorDisplay).toBeInTheDocument();
  });

  it('highlights selected preset with border', () => {
    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={vi.fn()} />);

    const presetButtons = screen.getAllByRole('button');
    // Find the button with #ef4444 background
    const selectedButton = presetButtons.find(
      (btn) => (btn as HTMLButtonElement).style.backgroundColor === 'rgb(239, 68, 68)'
    );

    expect(selectedButton).toBeDefined();
    expect((selectedButton as HTMLButtonElement).style.border).toContain('#6366f1');
  });

  it('updates brightness slider when brightness is changed', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(<FancyColorPicker selectedColor="#ef4444" onSelectColor={onSelect} />);

    const slider = screen.getByRole('slider') as HTMLInputElement;

    // Change brightness to 50
    await user.clear(slider);
    await user.type(slider, '50');

    // onSelectColor should be called with a darker version of the current color
    expect(onSelect).toHaveBeenCalled();
    const calledColor = onSelect.mock.calls[onSelect.mock.calls.length - 1][0];
    expect(calledColor).toMatch(/^#[0-9a-f]{6}$/);
  });
});
