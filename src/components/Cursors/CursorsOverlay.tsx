import { Cursor } from './Cursor';
import type { CursorPosition } from '../../types/board';
import type { StageTransform } from '../Board/Board';

interface CursorsOverlayProps {
  cursors: CursorPosition[];
  stageTransform: StageTransform;
}

const EDGE_PADDING = 32; // px from viewport edge for clamped cursors

export function CursorsOverlay({ cursors, stageTransform }: CursorsOverlayProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {cursors.map((cursor) => {
        const screenX = cursor.x * stageTransform.scale + stageTransform.x;
        const screenY = cursor.y * stageTransform.scale + stageTransform.y;

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const isOffscreen =
          screenX < -EDGE_PADDING ||
          screenX > vw + EDGE_PADDING ||
          screenY < -EDGE_PADDING ||
          screenY > vh + EDGE_PADDING;

        if (isOffscreen) {
          const clampedX = Math.max(EDGE_PADDING, Math.min(vw - EDGE_PADDING, screenX));
          const clampedY = Math.max(EDGE_PADDING, Math.min(vh - EDGE_PADDING, screenY));

          // Angle from clamped position pointing toward true cursor position
          const angle = Math.atan2(screenY - clampedY, screenX - clampedX);

          return (
            <Cursor
              key={cursor.userId}
              x={clampedX}
              y={clampedY}
              name={cursor.name}
              color={cursor.color}
              offscreen={{ angle }}
            />
          );
        }

        return (
          <Cursor
            key={cursor.userId}
            x={screenX}
            y={screenY}
            name={cursor.name}
            color={cursor.color}
          />
        );
      })}
    </div>
  );
}
