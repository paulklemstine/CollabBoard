import { useState } from 'react';
import { Arrow, Group, Circle, Text } from 'react-konva';
import type { Connector } from '../../types/board';
import type { AnyBoardObject } from '../../services/boardService';

interface ConnectorComponentProps {
  connector: Connector;
  objects: AnyBoardObject[];
  onDelete?: (id: string) => void;
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

export function ConnectorComponent({ connector, objects, onDelete }: ConnectorComponentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const fromObj = objects.find((o) => o.id === connector.fromId);
  const toObj = objects.find((o) => o.id === connector.toId);

  if (!fromObj || !toObj) return null;

  const fromCenter = getCenter(fromObj);
  const toCenter = getCenter(toObj);
  const from = getEdgePoint(fromObj, toCenter);
  const to = getEdgePoint(toObj, fromCenter);

  // Calculate midpoint for delete button
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  if (connector.style === 'curved') {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy || 1);
    const offset = Math.min(dist * 0.2, 80);
    const cpX = midX - dy * offset / dist;
    const cpY = midY + dx * offset / dist;

    return (
      <Group>
        <Arrow
          points={[from.x, from.y, cpX, cpY, to.x, to.y]}
          tension={0.5}
          stroke="#f472b6"
          strokeWidth={isHovered ? 4.5 : 3.5}
          fill="#f472b6"
          pointerLength={16}
          pointerWidth={14}
          shadowColor="#ec4899"
          shadowBlur={isHovered ? 16 : 12}
          shadowOpacity={isHovered ? 0.5 : 0.4}
          lineCap="round"
          lineJoin="round"
          dash={[12, 6]}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        />
        {onDelete && (
          <Group>
            <Circle
              x={cpX}
              y={cpY}
              radius={12}
              fill={isDeleteHovered ? '#ef4444' : '#fff'}
              stroke={isDeleteHovered ? '#dc2626' : '#f472b6'}
              strokeWidth={2}
              shadowColor="rgba(0,0,0,0.3)"
              shadowBlur={8}
              shadowOffsetY={2}
              onClick={(e) => {
                e.cancelBubble = true;
                onDelete(connector.id);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                onDelete(connector.id);
              }}
              onMouseEnter={(e) => {
                setIsDeleteHovered(true);
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                setIsDeleteHovered(false);
                const stage = e.target.getStage();
                if (stage) stage.container().style.cursor = 'default';
              }}
            />
            <Text
              x={cpX}
              y={cpY}
              text="×"
              fontSize={18}
              fontStyle="bold"
              fill={isDeleteHovered ? '#fff' : '#f472b6'}
              offsetX={5}
              offsetY={9}
              listening={false}
            />
          </Group>
        )}
      </Group>
    );
  }

  return (
    <Group>
      <Arrow
        points={[from.x, from.y, to.x, to.y]}
        stroke="#818cf8"
        strokeWidth={isHovered ? 4.5 : 3.5}
        fill="#818cf8"
        pointerLength={16}
        pointerWidth={14}
        shadowColor="#6366f1"
        shadowBlur={isHovered ? 16 : 12}
        shadowOpacity={isHovered ? 0.5 : 0.4}
        lineCap="round"
        lineJoin="round"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />
      {onDelete && (
        <Group>
          <Circle
            x={midX}
            y={midY}
            radius={12}
            fill={isDeleteHovered ? '#ef4444' : '#fff'}
            stroke={isDeleteHovered ? '#dc2626' : '#818cf8'}
            strokeWidth={2}
            shadowColor="rgba(0,0,0,0.3)"
            shadowBlur={8}
            shadowOffsetY={2}
            onClick={(e) => {
              e.cancelBubble = true;
              onDelete(connector.id);
            }}
            onTap={(e) => {
              e.cancelBubble = true;
              onDelete(connector.id);
            }}
            onMouseEnter={(e) => {
              setIsDeleteHovered(true);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
              setIsDeleteHovered(false);
              const stage = e.target.getStage();
              if (stage) stage.container().style.cursor = 'default';
            }}
          />
          <Text
            x={midX}
            y={midY}
            text="×"
            fontSize={18}
            fontStyle="bold"
            fill={isDeleteHovered ? '#fff' : '#818cf8'}
            offsetX={5}
            offsetY={9}
            listening={false}
          />
        </Group>
      )}
    </Group>
  );
}
