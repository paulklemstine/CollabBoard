import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Cursor } from './Cursor';

describe('Cursor', () => {
  it('renders cursor with name label', () => {
    const { getByText } = render(
      <Cursor x={100} y={200} name="Alice" color="#ff0000" />
    );

    expect(getByText('Alice')).toBeInTheDocument();
  });

  it('applies user color', () => {
    const { container } = render(
      <Cursor x={100} y={200} name="Bob" color="#00ff00" />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('positions at correct coordinates', () => {
    const { container } = render(
      <Cursor x={150} y={250} name="Carol" color="#0000ff" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.left).toBe('150px');
    expect(wrapper.style.top).toBe('250px');
  });

  it('renders offscreen indicator when offscreen prop is set', () => {
    const { getByTestId } = render(
      <Cursor x={100} y={200} name="Eve" color="#ff00ff" offscreen={{ angle: Math.PI / 4 }} />
    );

    const cursor = getByTestId('cursor');
    expect(cursor.dataset.offscreen).toBe('true');
  });

  it('renders directional arrow SVG when offscreen', () => {
    const { container } = render(
      <Cursor x={100} y={200} name="Eve" color="#ff00ff" offscreen={{ angle: 0 }} />
    );

    const polygon = container.querySelector('polygon');
    expect(polygon).toBeInTheDocument();
    expect(polygon?.getAttribute('fill')).toBe('#ff00ff');
  });

  it('does not set offscreen attribute for normal cursor', () => {
    const { getByTestId } = render(
      <Cursor x={100} y={200} name="Frank" color="#00ff00" />
    );

    const cursor = getByTestId('cursor');
    expect(cursor.dataset.offscreen).toBeUndefined();
  });
});
