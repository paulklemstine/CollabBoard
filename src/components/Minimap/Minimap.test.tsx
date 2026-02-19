import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Minimap } from './Minimap';

describe('Minimap', () => {
  it('renders minimap container', () => {
    render(<Minimap transform={{ x: 0, y: 0, scale: 1 }} objects={[]} />);
    const minimap = screen.getByTestId('minimap');
    expect(minimap).toBeInTheDocument();
  });

  it('applies correct dimensions', () => {
    render(<Minimap transform={{ x: 0, y: 0, scale: 1 }} objects={[]} />);
    const minimap = screen.getByTestId('minimap');
    expect(minimap).toHaveStyle({ width: '200px', height: '150px' });
  });

  it('renders stage with zoomed out scale', () => {
    const { container } = render(<Minimap transform={{ x: 0, y: 0, scale: 1 }} objects={[]} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('renders objects on the minimap', () => {
    const objects = [
      { x: 0, y: 0, width: 100, height: 100, type: 'sticky' },
      { x: 200, y: 200, width: 150, height: 150, type: 'frame' },
    ];
    const { container } = render(<Minimap transform={{ x: 0, y: 0, scale: 1 }} objects={objects} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });
});
