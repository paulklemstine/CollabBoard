import { Cursor } from './Cursor';
import type { CursorPosition } from '../../types/board';
import type { StageTransform } from '../Board/Board';

interface CursorsOverlayProps {
  cursors: CursorPosition[];
  stageTransform: StageTransform;
}

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
      {cursors.map((cursor) => (
        <Cursor
          key={cursor.userId}
          x={cursor.x * stageTransform.scale + stageTransform.x}
          y={cursor.y * stageTransform.scale + stageTransform.y}
          name={cursor.name}
          color={cursor.color}
        />
      ))}
    </div>
  );
}
