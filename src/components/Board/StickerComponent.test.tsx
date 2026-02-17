import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { StickerComponent } from './StickerComponent';
import type { Sticker } from '../../types/board';

vi.mock('../../services/firebase', () => ({
  db: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockSticker: Sticker = {
  id: 'sticker-1',
  type: 'sticker',
  x: 150,
  y: 250,
  width: 56,
  height: 56,
  rotation: 0,
  createdBy: 'user-1',
  updatedAt: 1000,
  emoji: '👍',
};

describe('StickerComponent', () => {
  it('renders without crashing', async () => {
    const { Stage, Layer } = await import('react-konva');

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <StickerComponent
            sticker={mockSticker}
            onDragMove={vi.fn()}
            onDragEnd={vi.fn()}
            onDelete={vi.fn()}
          />
        </Layer>
      </Stage>
    );

    expect(container.querySelector('.konvajs-content')).toBeInTheDocument();
  });

  it('renders with different emoji', async () => {
    const { Stage, Layer } = await import('react-konva');
    const fireSticker = { ...mockSticker, emoji: '🔥' };

    const { container } = render(
      <Stage width={800} height={600}>
        <Layer>
          <StickerComponent
            sticker={fireSticker}
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
