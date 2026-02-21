import { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Circle, Line } from 'react-konva';
import type Konva from 'konva';
import type { StageTransform } from '../Board/Board';

interface MinimapObject {
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  color?: string;
  shapeType?: string;
}

interface MinimapProps {
  transform: StageTransform;
  objects?: MinimapObject[];
  onPanTo?: (worldX: number, worldY: number) => void;
}

const MINIMAP_WIDTH = 220;
const MINIMAP_HEIGHT = 165;
const ZOOM_OUT_FACTOR = 30;

export function Minimap({ transform, objects = [], onPanTo }: MinimapProps) {
  const stageRef = useRef<Konva.Stage | null>(null);

  // Calculate the minimap scale (30x zoomed out from current view)
  const minimapScale = transform.scale / ZOOM_OUT_FACTOR;

  // Calculate viewport rectangle in world coordinates
  const viewportWidth = window.innerWidth / transform.scale;
  const viewportHeight = window.innerHeight / transform.scale;
  const viewportX = -transform.x / transform.scale;
  const viewportY = -transform.y / transform.scale;

  // Calculate minimap offset to center the current view
  const minimapOffsetX = MINIMAP_WIDTH / 2 - (viewportX + viewportWidth / 2) * minimapScale;
  const minimapOffsetY = MINIMAP_HEIGHT / 2 - (viewportY + viewportHeight / 2) * minimapScale;

  useEffect(() => {
    const stage = stageRef.current;
    if (stage) {
      stage.batchDraw();
    }
  }, [transform, objects]);

  // Drag state: record initial pixel + current viewport center on mousedown.
  // Don't pan until the mouse actually moves (avoids jump on click).
  const dragRef = useRef<{
    startPixelX: number;
    startPixelY: number;
    startCenterX: number;
    startCenterY: number;
    scale: number;
    dragged: boolean;
  } | null>(null);

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onPanTo) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Record start state — use current viewport center (not clicked point)
      // so dragging moves relative to where the view already is
      const vcx = viewportX + viewportWidth / 2;
      const vcy = viewportY + viewportHeight / 2;
      dragRef.current = {
        startPixelX: pointer.x,
        startPixelY: pointer.y,
        startCenterX: vcx,
        startCenterY: vcy,
        scale: minimapScale,
        dragged: false,
      };
    },
    [onPanTo, minimapScale, viewportX, viewportY, viewportWidth, viewportHeight]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!dragRef.current || !onPanTo) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      dragRef.current.dragged = true;

      // Compute delta from drag start in pixel space, convert to world delta
      const { startPixelX, startPixelY, startCenterX, startCenterY, scale } = dragRef.current;
      const dx = (pointer.x - startPixelX) / scale;
      const dy = (pointer.y - startPixelY) / scale;
      onPanTo(startCenterX + dx, startCenterY + dy);
    },
    [onPanTo]
  );

  const handleMouseUp = useCallback(() => {
    if (dragRef.current && !dragRef.current.dragged && onPanTo) {
      // Single click with no drag — pan to the clicked point
      const { startPixelX, startPixelY } = dragRef.current;
      const worldX = (startPixelX - minimapOffsetX) / minimapScale;
      const worldY = (startPixelY - minimapOffsetY) / minimapScale;
      onPanTo(worldX, worldY);
    }
    dragRef.current = null;
  }, [onPanTo, minimapOffsetX, minimapOffsetY, minimapScale]);

  const handleMouseLeave = useCallback(() => {
    dragRef.current = null;
  }, []);

  return (
    <div
      data-testid="minimap"
      className="glass-playful rounded-2xl shadow-xl overflow-hidden"
      style={{ width: `${MINIMAP_WIDTH}px`, height: `${MINIMAP_HEIGHT}px` }}
      onMouseLeave={handleMouseLeave}
    >
      <Stage
        ref={stageRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        scaleX={minimapScale}
        scaleY={minimapScale}
        x={minimapOffsetX}
        y={minimapOffsetY}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        style={{ cursor: 'default' }}
      >
        <Layer>
          {/* Render simplified objects with actual colors */}
          {objects.map((obj, index) => {
            if (obj.type === 'connector') return null;

            if (obj.type === 'frame') {
              return (
                <Rect
                  key={index}
                  x={obj.x}
                  y={obj.y}
                  width={obj.width}
                  height={obj.height}
                  stroke="#94a3b8"
                  strokeWidth={2 / minimapScale}
                  dash={[8 / minimapScale, 4 / minimapScale]}
                  fill="transparent"
                  opacity={0.4}
                  cornerRadius={4}
                  listening={false}
                />
              );
            }

            if (obj.type === 'shape' && obj.shapeType === 'circle') {
              const rx = obj.width / 2;
              const ry = obj.height / 2;
              return (
                <Circle
                  key={index}
                  x={obj.x + rx}
                  y={obj.y + ry}
                  radiusX={rx}
                  radiusY={ry}
                  fill={obj.color || '#818cf8'}
                  opacity={0.75}
                  listening={false}
                />
              );
            }

            if (obj.type === 'shape' && obj.shapeType === 'triangle') {
              return (
                <Line
                  key={index}
                  points={[
                    obj.x + obj.width / 2, obj.y,
                    obj.x + obj.width, obj.y + obj.height,
                    obj.x, obj.y + obj.height,
                  ]}
                  closed
                  fill={obj.color || '#818cf8'}
                  opacity={0.75}
                  listening={false}
                />
              );
            }

            const fill = obj.type === 'sticky'
              ? (obj.color || '#fef08a')
              : obj.type === 'shape'
                ? (obj.color || '#818cf8')
                : obj.type === 'text'
                  ? (obj.color || '#06b6d4')
                  : obj.type === 'sticker'
                    ? '#c084fc'
                    : '#8b5cf6';

            return (
              <Rect
                key={index}
                x={obj.x}
                y={obj.y}
                width={obj.width}
                height={obj.height}
                fill={fill}
                opacity={0.75}
                cornerRadius={obj.type === 'sticky' ? 6 : 2}
                listening={false}
              />
            );
          })}

          {/* Viewport indicator */}
          <Rect
            x={viewportX}
            y={viewportY}
            width={viewportWidth}
            height={viewportHeight}
            stroke="#8b5cf6"
            strokeWidth={2 / minimapScale}
            fill="transparent"
            listening={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}
