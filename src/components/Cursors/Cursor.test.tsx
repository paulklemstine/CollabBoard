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
});
