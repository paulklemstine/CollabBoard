import { useState } from 'react';
import { Arrow, Group, Circle, Text } from 'react-konva';
import type { Connector } from '../../types/board';
import type { AnyBoardObject } from '../../services/boardService';

interface ConnectorComponentProps {
  connector: Connector;
  objects: AnyBoardObject[];
  onDelete?: (id: string) => void;
}

/** Get the visual center of an object, accounting for orbit around parent frame center */
function getVisualCenter(obj: AnyBoardObject, objects: AnyBoardObject[]): { x: number; y: number } {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;

  if (obj.parentId) {
    const parentFrame = objects.find(o => o.id === obj.parentId);
    if (parentFrame && (parentFrame.rotation || 0) !== 0) {
      const fcx = parentFrame.x + parentFrame.width / 2;
      const fcy = parentFrame.y + parentFrame.height / 2;
      const dx = cx - fcx;
      const dy = cy - fcy;
      const rad = (parentFrame.rotation || 0) * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return {
        x: fcx + dx * cos - dy * sin,
        y: fcy + dx * sin + dy * cos,
      };
    }
  }

  return { x: cx, y: cy };
}

/** Get the effective rotation of an object including parent frame rotation */
function getEffectiveRotation(obj: AnyBoardObject, objects: AnyBoardObject[]): number {
  let rotation = obj.rotation || 0;
  if (obj.parentId) {
    const parentFrame = objects.find(o => o.id === obj.parentId);
    if (parentFrame) {
      rotation += parentFrame.rotation || 0;
    }
  }
  return rotation;
}

export function getEdgePoint(
  obj: AnyBoardObject,
  target: { x: number; y: number },
  rotation: number = 0,
  visualCenter?: { x: number; y: number }
): { x: number; y: number } {
  const cx = visualCenter?.x ?? (obj.x + obj.width / 2);
  const cy = visualCenter?.y ?? (obj.y + obj.height / 2);
  const dx = target.x - cx;
  const dy = target.y - cy;

  if (dx === 0 && dy === 0) {
    return { x: cx, y: cy };
  }

  // Circle: edge is center + radius in direction of target (rotation doesn't affect circles)
  if (obj.type === 'shape' && obj.shapeType === 'circle') {
    const r = Math.min(obj.width, obj.height) / 2;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return {
      x: cx + (dx / dist) * r,
      y: cy + (dy / dist) * r,
    };
  }

  // For rotated rectangles: transform direction into local space, find edge, transform back
  const rad = -rotation * (Math.PI / 180);
  const cosR = Math.cos(rad);
  const sinR = Math.sin(rad);

  // Rotate direction vector into object's local (axis-aligned) space
  const localDx = dx * cosR - dy * sinR;
  const localDy = dx * sinR + dy * cosR;

  // Rectangle intersection in local space
  const hw = obj.width / 2;
  const hh = obj.height / 2;
  const absLocalDx = Math.abs(localDx);
  const absLocalDy = Math.abs(localDy);

  let scale: number;
  if (absLocalDx * hh > absLocalDy * hw) {
    scale = hw / absLocalDx;
  } else {
    scale = hh / absLocalDy;
  }

  const localEdgeX = localDx * scale;
  const localEdgeY = localDy * scale;

  // Rotate edge point back to world space
  const worldRad = rotation * (Math.PI / 180);
  const worldCos = Math.cos(worldRad);
  const worldSin = Math.sin(worldRad);

  return {
    x: cx + localEdgeX * worldCos - localEdgeY * worldSin,
    y: cy + localEdgeX * worldSin + localEdgeY * worldCos,
  };
}

export function ConnectorComponent({ connector, objects, onDelete }: ConnectorComponentProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleteHovered, setIsDeleteHovered] = useState(false);

  const fromObj = objects.find((o) => o.id === connector.fromId);
  const toObj = objects.find((o) => o.id === connector.toId);

  if (!fromObj || !toObj) return null;

  const fromRotation = getEffectiveRotation(fromObj, objects);
  const toRotation = getEffectiveRotation(toObj, objects);
  const fromCenter = getVisualCenter(fromObj, objects);
  const toCenter = getVisualCenter(toObj, objects);
  const from = getEdgePoint(fromObj, toCenter, fromRotation, fromCenter);
  const to = getEdgePoint(toObj, fromCenter, toRotation, toCenter);

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
