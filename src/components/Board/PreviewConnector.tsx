import { Arrow } from 'react-konva';
import type { AnyBoardObject } from '../../services/boardService';
import { getEdgePoint } from './ConnectorComponent';

interface PreviewConnectorProps {
  fromObject: AnyBoardObject;
  toObject: AnyBoardObject | null;
  toX: number;
  toY: number;
  objects?: AnyBoardObject[];
}

function getObjRotation(obj: AnyBoardObject, objects?: AnyBoardObject[]): number {
  let rotation = obj.rotation || 0;
  if (obj.parentId && objects) {
    const parentFrame = objects.find(o => o.id === obj.parentId);
    if (parentFrame) rotation += parentFrame.rotation || 0;
  }
  return rotation;
}

function getObjVisualCenter(obj: AnyBoardObject, objects?: AnyBoardObject[]): { x: number; y: number } {
  const cx = obj.x + obj.width / 2;
  const cy = obj.y + obj.height / 2;
  if (obj.parentId && objects) {
    const parentFrame = objects.find(o => o.id === obj.parentId);
    if (parentFrame && (parentFrame.rotation || 0) !== 0) {
      const fcx = parentFrame.x + parentFrame.width / 2;
      const fcy = parentFrame.y + parentFrame.height / 2;
      const dx = cx - fcx;
      const dy = cy - fcy;
      const rad = (parentFrame.rotation || 0) * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      return { x: fcx + dx * cos - dy * sin, y: fcy + dx * sin + dy * cos };
    }
  }
  return { x: cx, y: cy };
}

export function PreviewConnector({ fromObject, toObject, toX, toY, objects }: PreviewConnectorProps) {
  const fromCenter = getObjVisualCenter(fromObject, objects);
  const fromRotation = getObjRotation(fromObject, objects);

  let startPoint: { x: number; y: number };
  let endPoint: { x: number; y: number };

  if (toObject) {
    const toCenter = getObjVisualCenter(toObject, objects);
    const toRotation = getObjRotation(toObject, objects);
    startPoint = getEdgePoint(fromObject, toCenter, fromRotation, fromCenter);
    endPoint = getEdgePoint(toObject, fromCenter, toRotation, toCenter);
  } else {
    startPoint = getEdgePoint(fromObject, { x: toX, y: toY }, fromRotation, fromCenter);
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
