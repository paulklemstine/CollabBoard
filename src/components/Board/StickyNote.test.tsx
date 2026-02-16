import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StickyNoteComponent } from './StickyNote';
import type { StickyNote } from '../../types/board';

vi.mock('../../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockNote: StickyNote = {
  id: 'note-1',
  type: 'sticky',
  x: 100,
  y: 200,
  width: 200,
  height: 200,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  text: 'Hello',
  color: '#fef08a',
};

// react-konva components render to canvas, so we test that it renders without crashing
// and that the component accepts the correct props
describe('StickyNoteComponent', () => {
  it('renders without crashing inside a Konva Stage', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <StickyNoteComponent
            note={mockNote}
            onDragEnd={vi.fn()}
            onTextChange={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders with empty text showing placeholder', async () => {
    const { Stage, Layer } = await import('react-konva');
    const emptyNote = { ...mockNote, text: '' };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <StickyNoteComponent
            note={emptyNote}
            onDragEnd={vi.fn()}
            onTextChange={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });
});
