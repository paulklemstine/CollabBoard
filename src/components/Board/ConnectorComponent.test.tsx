import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectorComponent, getEdgePoint } from './ConnectorComponent';
import type { Connector, StickyNote, Shape } from '../../types/board';

vi.mock('../../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockFrom: StickyNote = {
  id: 'note-1',
  type: 'sticky',
  x: 100,
  y: 100,
  width: 200,
  height: 200,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  text: 'From',
  color: '#fef08a',
};

const mockTo: StickyNote = {
  id: 'note-2',
  type: 'sticky',
  x: 500,
  y: 300,
  width: 200,
  height: 200,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  text: 'To',
  color: '#bbf7d0',
};

const mockConnector: Connector = {
  id: 'conn-1',
  type: 'connector',
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  fromId: 'note-1',
  toId: 'note-2',
  style: 'straight',
};

describe('ConnectorComponent', () => {
  it('renders a straight connector between two objects', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ConnectorComponent
            connector={mockConnector}
            objects={[mockFrom, mockTo]}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders a curved connector', async () => {
    const { Stage, Layer } = await import('react-konva');
    const curved = { ...mockConnector, style: 'curved' as const };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ConnectorComponent
            connector={curved}
            objects={[mockFrom, mockTo]}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders nothing if source object is missing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <ConnectorComponent
            connector={mockConnector}
            objects={[mockTo]}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });
});

describe('getEdgePoint', () => {
  it('returns right edge for target to the right of a rectangle', () => {
    // Rect at (100,100) size 200x200, center=(200,200), target at (500,200)
    const obj: StickyNote = { ...mockFrom };
    const result = getEdgePoint(obj, { x: 500, y: 200 });
    expect(result.x).toBeCloseTo(300); // right edge
    expect(result.y).toBeCloseTo(200); // vertically centered
  });

  it('returns top edge for target directly above a rectangle', () => {
    const obj: StickyNote = { ...mockFrom }; // center=(200,200)
    const result = getEdgePoint(obj, { x: 200, y: 0 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(100); // top edge
  });

  it('returns corner for 45-degree diagonal on a square', () => {
    const obj: StickyNote = { ...mockFrom }; // center=(200,200), 200x200
    const result = getEdgePoint(obj, { x: 500, y: 500 });
    expect(result.x).toBeCloseTo(300);
    expect(result.y).toBeCloseTo(300);
  });

  it('returns center when target coincides with center', () => {
    const obj: StickyNote = { ...mockFrom }; // center=(200,200)
    const result = getEdgePoint(obj, { x: 200, y: 200 });
    expect(result.x).toBeCloseTo(200);
    expect(result.y).toBeCloseTo(200);
  });

  it('returns circle edge for a circle shape', () => {
    const circle: Shape = {
      id: 'circle-1',
      type: 'shape',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      createdBy: 'user-1',
      updatedAt: 1000,
      shapeType: 'circle',
      color: '#ff0000',
    };
    // center=(100,100), radius=100, target to the right at (400,100)
    const result = getEdgePoint(circle, { x: 400, y: 100 });
    expect(result.x).toBeCloseTo(200); // center + radius
    expect(result.y).toBeCloseTo(100);
  });

  it('returns circle edge at 45 degrees', () => {
    const circle: Shape = {
      id: 'circle-2',
      type: 'shape',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      rotation: 0,
      createdBy: 'user-1',
      updatedAt: 1000,
      shapeType: 'circle',
      color: '#ff0000',
    };
    // center=(100,100), radius=100, target at 45 degrees
    const result = getEdgePoint(circle, { x: 300, y: 300 });
    const expected = 100 + 100 / Math.sqrt(2);
    expect(result.x).toBeCloseTo(expected);
    expect(result.y).toBeCloseTo(expected);
  });

  it('handles wide rectangles correctly', () => {
    const wide: StickyNote = {
      ...mockFrom,
      x: 0,
      y: 0,
      width: 400,
      height: 100,
    };
    // center=(200,50), target to the right at (500,50)
    const result = getEdgePoint(wide, { x: 500, y: 50 });
    expect(result.x).toBeCloseTo(400); // right edge
    expect(result.y).toBeCloseTo(50);
  });
});
