import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ShapeComponent } from './ShapeComponent';
import type { Shape } from '../../types/board';

vi.mock('../../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const baseShape: Shape = {
  id: 'shape-1',
  type: 'shape',
  x: 100,
  y: 200,
  width: 120,
  height: 120,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  shapeType: 'rect',
  color: '#ef4444',
};

describe('ShapeComponent', () => {
  it('renders a rect shape without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ShapeComponent
            shape={baseShape}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders a circle shape without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');
    const circleShape = { ...baseShape, shapeType: 'circle' as const };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ShapeComponent
            shape={circleShape}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders a line shape without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');
    const lineShape = { ...baseShape, shapeType: 'line' as const, width: 200, height: 4 };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ShapeComponent
            shape={lineShape}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });
});
