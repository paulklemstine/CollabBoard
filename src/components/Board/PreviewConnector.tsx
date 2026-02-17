import { Arrow } from 'react-konva';
import type { AnyBoardObject } from '../../services/boardService';

interface PreviewConnectorProps {
  fromObject: AnyBoardObject;
  toX: number;
  toY: number;
}

export function PreviewConnector({ fromObject, toX, toY }: PreviewConnectorProps) {
  // Calculate center point of source object
  const fromX = fromObject.x + fromObject.width / 2;
  const fromY = fromObject.y + fromObject.height / 2;

  return (
    <Arrow
      points={[fromX, fromY, toX, toY]}
      stroke="#818cf8"
      strokeWidth={3}
      fill="#818cf8"
      pointerLength={12}
      pointerWidth={12}
      dash={[10, 5]}
      opacity={0.6}
      listening={false}
    />
  );
}
