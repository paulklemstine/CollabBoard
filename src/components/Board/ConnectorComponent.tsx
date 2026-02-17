import { Arrow } from 'react-konva';
import type { Connector } from '../../types/board';
import type { AnyBoardObject } from '../../services/boardService';

interface ConnectorComponentProps {
  connector: Connector;
  objects: AnyBoardObject[];
}

function getCenter(obj: AnyBoardObject): { x: number; y: number } {
  return {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  };
}

export function ConnectorComponent({ connector, objects }: ConnectorComponentProps) {
  const fromObj = objects.find((o) => o.id === connector.fromId);
  const toObj = objects.find((o) => o.id === connector.toId);

  if (!fromObj || !toObj) return null;

  const from = getCenter(fromObj);
  const to = getCenter(toObj);

  if (connector.style === 'curved') {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const offset = Math.min(Math.sqrt(dx * dx + dy * dy) * 0.2, 80);
    const cpX = midX - dy * offset / Math.sqrt(dx * dx + dy * dy || 1);
    const cpY = midY + dx * offset / Math.sqrt(dx * dx + dy * dy || 1);

    return (
      <Arrow
        points={[from.x, from.y, cpX, cpY, to.x, to.y]}
        tension={0.5}
        stroke="#818cf8"
        strokeWidth={2.5}
        fill="#818cf8"
        pointerLength={12}
        pointerWidth={10}
        shadowColor="#6366f1"
        shadowBlur={8}
        shadowOpacity={0.3}
        lineCap="round"
        lineJoin="round"
        listening={false}
      />
    );
  }

  return (
    <Arrow
      points={[from.x, from.y, to.x, to.y]}
      stroke="#818cf8"
      strokeWidth={2.5}
      fill="#818cf8"
      pointerLength={12}
      pointerWidth={10}
      shadowColor="#6366f1"
      shadowBlur={8}
      shadowOpacity={0.3}
      lineCap="round"
      lineJoin="round"
      listening={false}
    />
  );
}
