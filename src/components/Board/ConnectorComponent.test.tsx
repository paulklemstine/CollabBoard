import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ConnectorComponent } from './ConnectorComponent';
import type { Connector, StickyNote } from '../../types/board';

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
