import { useState } from 'react';
import { Arrow, Line, Group, Circle, Text } from 'react-konva';
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

  // Circle: edge is center + radius in direction of target
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
  const localDx = dx * cosR - dy * sinR;
  const localDy = dx * sinR + dy * cosR;
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
  const worldRad = rotation * (Math.PI / 180);
  const worldCos = Math.cos(worldRad);
  const worldSin = Math.sin(worldRad);

  return {
    x: cx + localEdgeX * worldCos - localEdgeY * worldSin,
    y: cy + localEdgeX * worldSin + localEdgeY * worldCos,
  };
}

function getDash(lineType: string | undefined, strokeWidth: number): number[] | undefined {
  switch (lineType) {
    case 'dashed': return [strokeWidth * 3, strokeWidth * 2];
    case 'dotted': return [strokeWidth, strokeWidth * 2];
    default: return undefined;
  }
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

  // Style props — fallback to legacy defaults
  const color = connector.color ?? '#818cf8';
  const sw = connector.strokeWidth ?? 3.5;
  const lineType = connector.lineType ?? (connector.style === 'curved' ? 'dashed' : 'solid');
  const startArrow = connector.startArrow ?? false;
  const endArrow = connector.endArrow !== false; // default true for legacy
  const dash = getDash(lineType, sw);
  const shadowColor = color;

  // Calculate points for delete button position
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;

  const isCurved = connector.style === 'curved';

  // Compute control point for curved connectors
  let cpX = midX;
  let cpY = midY;
  if (isCurved) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy || 1);
    const offset = Math.min(dist * 0.2, 80);
    cpX = midX - dy * offset / dist;
    cpY = midY + dx * offset / dist;
  }

  const points = isCurved
    ? [from.x, from.y, cpX, cpY, to.x, to.y]
    : [from.x, from.y, to.x, to.y];
  const deleteBtnX = isCurved ? cpX : midX;
  const deleteBtnY = isCurved ? cpY : midY;

  // Use Arrow component only when end arrow is needed (and no start arrow)
  // Use Line + manual arrowheads for start arrow or no-arrow cases
  const pointerLength = Math.max(10, sw * 4);
  const pointerWidth = Math.max(8, sw * 3.5);

  const renderDeleteButton = () => {
    if (!onDelete || !isHovered) return null;
    return (
      <Group>
        <Circle
          x={deleteBtnX}
          y={deleteBtnY}
          radius={12}
          fill={isDeleteHovered ? '#ef4444' : '#fff'}
          stroke={isDeleteHovered ? '#dc2626' : color}
          strokeWidth={2}
          shadowColor="rgba(0,0,0,0.3)"
          shadowBlur={8}
          shadowOffsetY={2}
          onClick={(e) => { e.cancelBubble = true; onDelete(connector.id); }}
          onTap={(e) => { e.cancelBubble = true; onDelete(connector.id); }}
          onMouseEnter={() => {
            setIsDeleteHovered(true);
          }}
          onMouseLeave={() => {
            setIsDeleteHovered(false);
          }}
        />
        <Text
          x={deleteBtnX}
          y={deleteBtnY}
          text="×"
          fontSize={18}
          fontStyle="bold"
          fill={isDeleteHovered ? '#fff' : color}
          offsetX={5}
          offsetY={9}
          listening={false}
        />
      </Group>
    );
  };

  // Compute arrowhead points for start/end
  const renderArrowhead = (tipX: number, tipY: number, dirX: number, dirY: number) => {
    const len = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
    const ux = dirX / len;
    const uy = dirY / len;
    const px = -uy;
    const py = ux;
    const baseX = tipX - ux * pointerLength;
    const baseY = tipY - uy * pointerLength;
    return (
      <Line
        points={[
          baseX + px * pointerWidth / 2, baseY + py * pointerWidth / 2,
          tipX, tipY,
          baseX - px * pointerWidth / 2, baseY - py * pointerWidth / 2,
        ]}
        fill={color}
        closed
        listening={false}
      />
    );
  };

  // Direction vectors for arrowheads — follow curve tangent for curved connectors
  // For a quadratic bezier, tangent at start = controlPoint - start, tangent at end = end - controlPoint
  const startDir = isCurved
    ? { x: from.x - cpX, y: from.y - cpY }
    : { x: from.x - to.x, y: from.y - to.y };
  const endDir = isCurved
    ? { x: to.x - cpX, y: to.y - cpY }
    : { x: to.x - from.x, y: to.y - from.y };

  // Invisible wide hit area so hover triggers when the mouse gets near the connector
  const hitArea = (
    <Line
      points={points}
      tension={isCurved ? 0.5 : undefined}
      stroke="transparent"
      strokeWidth={Math.max(30, sw * 8)}
      lineCap="round"
      lineJoin="round"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    />
  );

  // If only endArrow and no startArrow, use the built-in Arrow for simplicity
  if (endArrow && !startArrow) {
    return (
      <Group>
        {hitArea}
        {isHovered && (
          <Arrow
            points={points}
            tension={isCurved ? 0.5 : undefined}
            stroke="#3b82f6"
            strokeWidth={sw + 4}
            fill="#3b82f6"
            pointerLength={pointerLength + 4}
            pointerWidth={pointerWidth + 4}
            opacity={0.2}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
        <Arrow
          points={points}
          tension={isCurved ? 0.5 : undefined}
          stroke={color}
          strokeWidth={sw}
          fill={color}
          pointerLength={pointerLength}
          pointerWidth={pointerWidth}
          shadowColor={shadowColor}
          shadowBlur={isHovered ? 16 : 12}
          shadowOpacity={isHovered ? 0.5 : 0.4}
          lineCap="round"
          lineJoin="round"
          dash={dash}
          listening={false}
        />
        {renderDeleteButton()}
      </Group>
    );
  }

  // For all other cases, use Line + manual arrowheads
  return (
    <Group>
      {hitArea}
      {isHovered && (
        <Line
          points={points}
          tension={isCurved ? 0.5 : undefined}
          stroke="#3b82f6"
          strokeWidth={sw + 4}
          opacity={0.2}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
      <Line
        points={points}
        tension={isCurved ? 0.5 : undefined}
        stroke={color}
        strokeWidth={sw}
        shadowColor={shadowColor}
        shadowBlur={isHovered ? 16 : 12}
        shadowOpacity={isHovered ? 0.5 : 0.4}
        lineCap="round"
        lineJoin="round"
        dash={dash}
        listening={false}
      />
      {startArrow && renderArrowhead(from.x, from.y, startDir.x, startDir.y)}
      {endArrow && renderArrowhead(to.x, to.y, endDir.x, endDir.y)}
      {renderDeleteButton()}
    </Group>
  );
}
