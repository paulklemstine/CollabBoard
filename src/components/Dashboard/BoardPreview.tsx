import { useEffect, useState } from 'react';
import { getBoardObjects, type AnyBoardObject } from '../../services/boardService';

interface BoardPreviewProps {
  boardId: string;
}

const PREVIEW_W = 300;
const PREVIEW_H = 140;
const PAD = 16;

function getColor(obj: AnyBoardObject): string {
  switch (obj.type) {
    case 'sticky': return obj.color || '#fef08a';
    case 'shape': return obj.color || '#818cf8';
    case 'frame': return 'none';
    case 'sticker': return '#c084fc';
    default: return '#94a3b8';
  }
}

export function BoardPreview({ boardId }: BoardPreviewProps) {
  const [objects, setObjects] = useState<AnyBoardObject[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getBoardObjects(boardId).then((objs) => {
      if (!cancelled) setObjects(objs);
    });
    return () => { cancelled = true; };
  }, [boardId]);

  const visible = objects?.filter((o) => o.type !== 'connector') ?? [];

  if (objects === null) {
    return (
      <div
        className="animate-pulse"
        style={{
          width: '100%',
          height: PREVIEW_H,
          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        }}
      />
    );
  }

  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width: '100%',
          height: PREVIEW_H,
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
        }}
      >
        <div className="flex flex-col items-center gap-1 opacity-40">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="4 3" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span className="text-[10px] text-gray-400 font-medium">Empty</span>
        </div>
      </div>
    );
  }

  // Compute bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of visible) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }

  const bboxW = maxX - minX || 1;
  const bboxH = maxY - minY || 1;
  const scaleX = (PREVIEW_W - PAD * 2) / bboxW;
  const scaleY = (PREVIEW_H - PAD * 2) / bboxH;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = PAD + ((PREVIEW_W - PAD * 2) - bboxW * scale) / 2;
  const offsetY = PAD + ((PREVIEW_H - PAD * 2) - bboxH * scale) / 2;

  return (
    <svg
      width="100%"
      height={PREVIEW_H}
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)' }}
    >
      {visible.map((obj) => {
        const x = offsetX + (obj.x - minX) * scale;
        const y = offsetY + (obj.y - minY) * scale;
        const w = Math.max(obj.width * scale, 3);
        const h = Math.max(obj.height * scale, 3);
        const color = getColor(obj);

        if (obj.type === 'frame') {
          return (
            <rect
              key={obj.id}
              x={x} y={y} width={w} height={h}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1}
              strokeDasharray="4 2"
              rx={2}
              opacity={0.4}
            />
          );
        }

        if (obj.type === 'sticker') {
          return (
            <circle
              key={obj.id}
              cx={x + w / 2} cy={y + h / 2}
              r={Math.max(Math.min(w, h) / 2, 3)}
              fill={color}
              opacity={0.7}
            />
          );
        }

        if (obj.type === 'shape' && obj.shapeType === 'circle') {
          return (
            <ellipse
              key={obj.id}
              cx={x + w / 2} cy={y + h / 2}
              rx={w / 2} ry={h / 2}
              fill={color}
              opacity={0.8}
            />
          );
        }

        return (
          <rect
            key={obj.id}
            x={x} y={y} width={w} height={h}
            fill={color}
            rx={obj.type === 'sticky' ? 3 : 1}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}
