import { describe, it, expect } from 'vitest';
import { getContrastTextColor } from './colors';

describe('getContrastTextColor', () => {
  it('returns black text for light backgrounds', () => {
    // Light yellow
    expect(getContrastTextColor('#fef08a')).toBe('#000000');
    // Light pink
    expect(getContrastTextColor('#fecaca')).toBe('#000000');
    // Light blue
    expect(getContrastTextColor('#bfdbfe')).toBe('#000000');
    // Light green
    expect(getContrastTextColor('#bbf7d0')).toBe('#000000');
    // White
    expect(getContrastTextColor('#ffffff')).toBe('#000000');
  });

  it('returns white text for dark backgrounds', () => {
    // Dark red
    expect(getContrastTextColor('#ef4444')).toBe('#ffffff');
    // Dark blue
    expect(getContrastTextColor('#3b82f6')).toBe('#ffffff');
    // Dark purple
    expect(getContrastTextColor('#8b5cf6')).toBe('#ffffff');
    // Black
    expect(getContrastTextColor('#000000')).toBe('#ffffff');
  });

  it('handles hex colors without # prefix', () => {
    expect(getContrastTextColor('ffffff')).toBe('#000000');
    expect(getContrastTextColor('000000')).toBe('#ffffff');
  });

  it('handles medium brightness colors correctly', () => {
    // Medium orange - should be white text (dark enough)
    expect(getContrastTextColor('#f97316')).toBe('#ffffff');
    // Medium green - should be white text (dark enough)
    expect(getContrastTextColor('#22c55e')).toBe('#ffffff');
  });

  it('uses relative luminance formula (WCAG 2.0)', () => {
    // These colors are near the threshold
    // Gray with luminance ~0.5 should get white text
    expect(getContrastTextColor('#808080')).toBe('#ffffff');
    // Lighter gray should get black text
    expect(getContrastTextColor('#b0b0b0')).toBe('#000000');
  });

  it('handles all preset colors correctly', () => {
    const presets = [
      { color: '#fecaca', expected: '#000000' }, // light red
      { color: '#fed7aa', expected: '#000000' }, // light orange
      { color: '#fef08a', expected: '#000000' }, // light yellow
      { color: '#bbf7d0', expected: '#000000' }, // light green
      { color: '#bfdbfe', expected: '#000000' }, // light blue
      { color: '#ddd6fe', expected: '#000000' }, // light purple
      { color: '#fbcfe8', expected: '#000000' }, // light pink
      { color: '#a5f3fc', expected: '#000000' }, // light cyan
      { color: '#ef4444', expected: '#ffffff' }, // red
      { color: '#f97316', expected: '#ffffff' }, // orange
      { color: '#eab308', expected: '#ffffff' }, // yellow
      { color: '#22c55e', expected: '#ffffff' }, // green
      { color: '#3b82f6', expected: '#ffffff' }, // blue
      { color: '#8b5cf6', expected: '#ffffff' }, // purple
      { color: '#ec4899', expected: '#ffffff' }, // pink
      { color: '#06b6d4', expected: '#ffffff' }, // cyan
    ];

    presets.forEach(({ color, expected }) => {
      expect(getContrastTextColor(color)).toBe(expected);
    });
  });
});
