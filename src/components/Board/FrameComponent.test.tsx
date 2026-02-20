import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { FrameComponent } from './FrameComponent';
import type { Frame } from '../../types/board';

vi.mock('../../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockFrame: Frame = {
  id: 'frame-1',
  type: 'frame',
  x: 50,
  y: 50,
  width: 400,
  height: 300,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  title: 'My Frame',
};

describe('FrameComponent', () => {
  it('renders without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <FrameComponent
            frame={mockFrame}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
            onTitleChange={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders with empty title', async () => {
    const { Stage, Layer } = await import('react-konva');
    const emptyFrame = { ...mockFrame, title: '' };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <FrameComponent
            frame={emptyFrame}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
            onTitleChange={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders with hoverState=accept without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <FrameComponent
            frame={mockFrame}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
            onTitleChange={vi.fn()}
            hoverState="accept"
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders with hoverState=reject without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <FrameComponent
            frame={mockFrame}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
            onTitleChange={vi.fn()}
            hoverState="reject"
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });
});
