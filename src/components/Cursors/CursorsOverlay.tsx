import { Cursor } from './Cursor';
import type { CursorPosition } from '../../types/board';

interface CursorsOverlayProps {
  cursors: CursorPosition[];
}

export function CursorsOverlay({ cursors }: CursorsOverlayProps) {
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
      {cursors.map((cursor) => (
        <Cursor
          key={cursor.userId}
          x={cursor.x}
          y={cursor.y}
          name={cursor.name}
          color={cursor.color}
        />
      ))}
    </div>
  );
}
