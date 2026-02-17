import { Arrow } from 'react-konva';
import type { AnyBoardObject } from '../../services/boardService';
import { getEdgePoint } from './ConnectorComponent';

interface PreviewConnectorProps {
  fromObject: AnyBoardObject;
  toObject: AnyBoardObject | null;
  toX: number;
  toY: number;
}

export function PreviewConnector({ fromObject, toObject, toX, toY }: PreviewConnectorProps) {
  const fromCenter = {
    x: fromObject.x + fromObject.width / 2,
    y: fromObject.y + fromObject.height / 2,
  };

  let startPoint: { x: number; y: number };
  let endPoint: { x: number; y: number };

  if (toObject) {
    // Draw to the edge of the hovered component
    const toCenter = {
      x: toObject.x + toObject.width / 2,
      y: toObject.y + toObject.height / 2,
    };
    startPoint = getEdgePoint(fromObject, toCenter);
    endPoint = getEdgePoint(toObject, fromCenter);
  } else {
    // Draw to cursor
    startPoint = getEdgePoint(fromObject, { x: toX, y: toY });
    endPoint = { x: toX, y: toY };
  }

  return (
    <Arrow
      points={[startPoint.x, startPoint.y, endPoint.x, endPoint.y]}
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
