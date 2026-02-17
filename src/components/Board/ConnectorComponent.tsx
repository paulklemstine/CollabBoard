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

export function getEdgePoint(
  obj: AnyBoardObject,
  target: { x: number; y: number }
): { x: number; y: number } {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  // Circle: edge is center + radius in direction of target
  if (obj.type === 'shape' && obj.shapeType === 'circle') {
    const r = Math.min(obj.width, obj.height) / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return {
      x: cx + (dx / dist) * r,
      y: cy + (dy / dist) * r,
    };
  }

  // Rectangle intersection for all other types
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  let scale: number;
  if (absDx * hh > absDy * hw) {
    scale = hw / absDx;
  } else {
    scale = hh / absDy;
  }

  return {
    x: cx + dx * scale,
    y: cy + dy * scale,
  };
}

export function ConnectorComponent({ connector, objects }: ConnectorComponentProps) {
  const fromObj = objects.find((o) => o.id === connector.fromId);
  const toObj = objects.find((o) => o.id === connector.toId);

  if (!fromObj || !toObj) return null;

  const fromCenter = getCenter(fromObj);
  const toCenter = getCenter(toObj);
  const from = getEdgePoint(fromObj, toCenter);
  const to = getEdgePoint(toObj, fromCenter);

  if (connector.style === 'curved') {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy || 1);
    const offset = Math.min(dist * 0.2, 80);
    const cpX = midX - dy * offset / dist;
    const cpY = midY + dx * offset / dist;

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
