import { useEffect, useState } from 'react';
import { getBoardObjects, type AnyBoardObject } from '../../services/boardService';
import { getPreviewUrl } from '../../services/previewCache';
import { getContrastTextColor } from '../../utils/colors';
import { regularPolygonPoints, starPoints, arrowPoints, crossPoints } from '../../utils/shapePoints';
import type { Connector } from '../../types/board';

interface BoardPreviewProps {
  boardId: string;
  thumbnailUrl?: string;
}

const PREVIEW_W = 300;
const PREVIEW_H = 300;
const PAD = 16;

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

function getColor(obj: AnyBoardObject): string {
  switch (obj.type) {
    case 'sticky': return obj.color || '#fef08a';
    case 'shape': return obj.color || '#818cf8';
    case 'text': return obj.bgColor && obj.bgColor !== 'transparent' ? obj.bgColor : 'transparent';
    case 'frame': return obj.color || 'rgba(250, 245, 255, 0.12)';
    case 'sticker': return '#c084fc';
    default: return '#94a3b8';
  }
}

/** Convert shape point arrays (x,y pairs) to an SVG polygon points string, offset to (ox,oy) */
function toSvgPoints(pts: number[], ox: number, oy: number, sx: number, sy: number): string {
  const result: string[] = [];
  for (let i = 0; i < pts.length; i += 2) {
    result.push(`${ox + pts[i] * sx},${oy + pts[i + 1] * sy}`);
  }
  return result.join(' ');
}

/** Get unit-space (0-1) shape points for SVG polygon rendering */
function getShapePoints(shapeType: string): number[] | null {
  switch (shapeType) {
    case 'triangle': return regularPolygonPoints(1, 1, 3);
    case 'diamond': return regularPolygonPoints(1, 1, 4);
    case 'pentagon': return regularPolygonPoints(1, 1, 5);
    case 'hexagon': return regularPolygonPoints(1, 1, 6);
    case 'octagon': return regularPolygonPoints(1, 1, 8);
    case 'star': return starPoints(1, 1);
    case 'arrow': return arrowPoints(1, 1);
    case 'cross': return crossPoints(1, 1);
    default: return null;
  }
}

export function BoardPreview({ boardId, thumbnailUrl }: BoardPreviewProps) {
  const [objects, setObjects] = useState<AnyBoardObject[] | null>(null);
  const cachedUrl = getPreviewUrl(boardId);

  useEffect(() => {
    if (cachedUrl || thumbnailUrl) return; // Skip fetching objects when we have an image
    let cancelled = false;
    getBoardObjects(boardId).then((objs) => {
      if (!cancelled) setObjects(objs);
    });
    return () => { cancelled = true; };
  }, [boardId, cachedUrl, thumbnailUrl]);

  // Priority: cached local preview > uploaded thumbnail > SVG fallback
  const previewSrc = cachedUrl || thumbnailUrl;
  if (previewSrc) {
    return (
      <div
        className="w-full relative overflow-hidden"
        style={{ aspectRatio: '1 / 1', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)' }}
      >
        <img
          src={previewSrc}
          alt="Board preview"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }

  if (objects === null) {
    return (
      <div
        className="animate-pulse"
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
          background: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)',
        }}
      />
    );
  }

  const visible = objects.filter((o) => o.type !== 'connector');
  const connectors = objects.filter((o): o is Connector => o.type === 'connector');

  if (visible.length === 0) {
    return (
      <div
        className="flex items-center justify-center"
        style={{
          width: '100%',
          aspectRatio: '1 / 1',
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

  // Compute bounding box (frames extend above obj.y by their title bar height)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of visible) {
    let topY = obj.y;
    if (obj.type === 'frame' && !obj.borderless) {
      const titleBarH = Math.max(36, (obj.fontSize ?? 14) + 20);
      topY -= titleBarH;
    }
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, topY);
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

  // Build object lookup for connectors
  const objMap = new Map(objects.map((o) => [o.id, o]));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${PREVIEW_W} ${PREVIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: '1 / 1', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)' }}
    >
      <defs>
        {visible.map((obj) => {
          const x = offsetX + (obj.x - minX) * scale;
          const y = offsetY + (obj.y - minY) * scale;
          const w = Math.max(obj.width * scale, 3);
          const h = Math.max(obj.height * scale, 3);
          return (
            <clipPath key={`clip-${obj.id}`} id={`clip-${obj.id}`}>
              <rect x={x} y={y} width={w} height={h} />
            </clipPath>
          );
        })}
      </defs>

      {/* Connectors (drawn first, behind objects) */}
      {connectors.map((conn) => {
        const fromObj = objMap.get(conn.fromId);
        const toObj = objMap.get(conn.toId);
        if (!fromObj || !toObj) return null;
        const x1 = offsetX + (fromObj.x + fromObj.width / 2 - minX) * scale;
        const y1 = offsetY + (fromObj.y + fromObj.height / 2 - minY) * scale;
        const x2 = offsetX + (toObj.x + toObj.width / 2 - minX) * scale;
        const y2 = offsetY + (toObj.y + toObj.height / 2 - minY) * scale;
        return (
          <line
            key={conn.id}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={conn.color || '#94a3b8'}
            strokeWidth={Math.max(1, (conn.strokeWidth || 2) * scale * 0.5)}
            opacity={0.5}
            strokeDasharray={conn.lineType === 'dashed' ? '4 2' : conn.lineType === 'dotted' ? '2 2' : undefined}
          />
        );
      })}

      {/* Objects */}
      {visible.map((obj) => {
        const x = offsetX + (obj.x - minX) * scale;
        const y = offsetY + (obj.y - minY) * scale;
        const w = Math.max(obj.width * scale, 3);
        const h = Math.max(obj.height * scale, 3);
        const color = getColor(obj);
        const rotation = obj.rotation || 0;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rotateTransform = rotation ? `rotate(${rotation}, ${cx}, ${cy})` : undefined;

        // --- Frame ---
        if (obj.type === 'frame') {
          // Borderless frames are invisible grouping containers — skip in preview
          if (obj.borderless) return null;
          const titleBarH = Math.max(36, (obj.fontSize ?? 14) + 20);
          const scaledTitleBarH = titleBarH * scale;
          const titleFontSize = Math.max(3, 12 * scale);
          const frameFill = obj.color || 'rgba(250, 245, 255, 0.12)';
          const frameStroke = obj.borderColor || '#a78bfa';
          // Frame rect includes the title bar above obj.y
          const frameY = y - scaledTitleBarH;
          const frameH = h + scaledTitleBarH;
          const frameCx = x + w / 2;
          const frameCy = frameY + frameH / 2;
          const frameRotate = rotation ? `rotate(${rotation}, ${frameCx}, ${frameCy})` : undefined;
          return (
            <g key={obj.id} transform={frameRotate}>
              <rect
                x={x} y={frameY} width={w} height={frameH}
                fill={frameFill}
                stroke={frameStroke}
                strokeWidth={Math.max(1, 2.5 * scale)}
                rx={Math.max(2, 16 * scale)}
                opacity={0.85}
              />
              {obj.title && w > 20 && (
                <text
                  x={x + 4 * scale}
                  y={frameY + scaledTitleBarH / 2}
                  fontSize={titleFontSize}
                  fill={obj.textColor || '#581c87'}
                  fontFamily="Inter, sans-serif"
                  fontWeight="bold"
                  dominantBaseline="central"
                  opacity={0.8}
                >
                  {truncateText(obj.title, 30)}
                </text>
              )}
            </g>
          );
        }

        // --- Sticker ---
        if (obj.type === 'sticker') {
          if (obj.emoji && !obj.gifUrl) {
            const emojiFontSize = Math.max(4, Math.min(w, h) * 0.7);
            return (
              <g key={obj.id} transform={rotateTransform}>
                <text
                  x={x + w / 2}
                  y={y + h / 2}
                  fontSize={emojiFontSize}
                  textAnchor="middle"
                  dominantBaseline="central"
                  opacity={0.85}
                >
                  {obj.emoji}
                </text>
              </g>
            );
          }
          // GIF sticker — render actual image
          if (obj.gifUrl) {
            return (
              <g key={obj.id} transform={rotateTransform}>
                <image
                  href={obj.gifUrl}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  preserveAspectRatio="xMidYMid meet"
                  opacity={0.9}
                />
              </g>
            );
          }
          // Fallback for stickers with no emoji and no gif
          return (
            <g key={obj.id} transform={rotateTransform}>
              <circle
                cx={x + w / 2} cy={y + h / 2}
                r={Math.max(Math.min(w, h) / 2, 3)}
                fill="#c084fc"
                opacity={0.5}
              />
            </g>
          );
        }

        // --- Text Object ---
        if (obj.type === 'text') {
          const fontSize = Math.max(3, obj.fontSize * scale);
          const hasBg = obj.bgColor && obj.bgColor !== 'transparent';
          return (
            <g key={obj.id} transform={rotateTransform}>
              {hasBg && (
                <rect
                  x={x} y={y} width={w} height={h}
                  fill={obj.bgColor}
                  rx={3}
                  opacity={0.8}
                />
              )}
              {obj.text && w > 15 && (
                <text
                  x={x + 4 * scale}
                  y={y + fontSize * 1.1}
                  fontSize={fontSize}
                  fill={obj.color || '#1e293b'}
                  fontFamily={obj.fontFamily || 'Inter, sans-serif'}
                  fontWeight={obj.fontWeight || 'normal'}
                  fontStyle={obj.fontStyle || 'normal'}
                  opacity={0.9}
                  clipPath={`url(#clip-${obj.id})`}
                >
                  {truncateText(obj.text, 50)}
                </text>
              )}
            </g>
          );
        }

        // --- Shape ---
        if (obj.type === 'shape') {
          if (obj.shapeType === 'circle') {
            return (
              <g key={obj.id} transform={rotateTransform}>
                <ellipse
                  cx={x + w / 2} cy={y + h / 2}
                  rx={w / 2} ry={h / 2}
                  fill={color}
                  stroke={obj.strokeColor || undefined}
                  strokeWidth={obj.strokeColor ? Math.max(0.5, scale) : 0}
                  opacity={0.8}
                />
              </g>
            );
          }

          if (obj.shapeType === 'line') {
            return (
              <g key={obj.id} transform={rotateTransform}>
                <line
                  x1={x} y1={y + h / 2}
                  x2={x + w} y2={y + h / 2}
                  stroke={color}
                  strokeWidth={Math.max(1, 2 * scale)}
                  opacity={0.8}
                />
              </g>
            );
          }

          // Polygon shapes
          const pts = getShapePoints(obj.shapeType);
          if (pts) {
            return (
              <g key={obj.id} transform={rotateTransform}>
                <polygon
                  points={toSvgPoints(pts, x, y, w, h)}
                  fill={color}
                  stroke={obj.strokeColor || undefined}
                  strokeWidth={obj.strokeColor ? Math.max(0.5, scale) : 0}
                  opacity={0.8}
                />
              </g>
            );
          }

          // Fallback rect for unknown shapes
          return (
            <g key={obj.id} transform={rotateTransform}>
              <rect
                x={x} y={y} width={w} height={h}
                fill={color}
                stroke={obj.strokeColor || undefined}
                strokeWidth={obj.strokeColor ? Math.max(0.5, scale) : 0}
                rx={1}
                opacity={0.8}
              />
            </g>
          );
        }

        // --- Sticky Note ---
        if (obj.type === 'sticky') {
          const textFontSize = Math.max(3, 14 * scale);
          const textColor = obj.textColor || getContrastTextColor(obj.color || '#fef08a');
          return (
            <g key={obj.id} transform={rotateTransform}>
              <rect
                x={x} y={y} width={w} height={h}
                fill={color}
                rx={3}
                opacity={0.85}
              />
              {obj.text && w > 20 && (
                <text
                  x={x + 3}
                  y={y + textFontSize + 3}
                  fontSize={textFontSize}
                  fill={textColor}
                  fontFamily="Inter, sans-serif"
                  opacity={0.85}
                  clipPath={`url(#clip-${obj.id})`}
                >
                  {truncateText(obj.text, 50)}
                </text>
              )}
            </g>
          );
        }

        // Fallback (unreachable — all types handled above)
        return null;
      })}
    </svg>
  );
}
