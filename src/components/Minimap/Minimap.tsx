import { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { StageTransform } from '../Board/Board';

interface MinimapProps {
  transform: StageTransform;
  objects?: Array<{ x: number; y: number; width: number; height: number; type: string }>;
  onPanTo?: (worldX: number, worldY: number) => void;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
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

  // Drag state: track initial pixel + viewport center so we compute deltas
  // instead of absolute positions (avoids feedback loop from minimap re-centering)
  const dragRef = useRef<{
    startPixelX: number;
    startPixelY: number;
    startCenterX: number;
    startCenterY: number;
    scale: number;
  } | null>(null);

  const handleClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onPanTo) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;
      const worldX = (pointer.x - minimapOffsetX) / minimapScale;
      const worldY = (pointer.y - minimapOffsetY) / minimapScale;
      onPanTo(worldX, worldY);
    },
    [onPanTo, minimapOffsetX, minimapOffsetY, minimapScale]
  );

  const handleMouseDown = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!onPanTo) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert click to world and pan there immediately
      const worldX = (pointer.x - minimapOffsetX) / minimapScale;
      const worldY = (pointer.y - minimapOffsetY) / minimapScale;
      onPanTo(worldX, worldY);

      // Record start state for delta-based dragging
      dragRef.current = {
        startPixelX: pointer.x,
        startPixelY: pointer.y,
        startCenterX: worldX,
        startCenterY: worldY,
        scale: minimapScale,
      };
    },
    [onPanTo, minimapOffsetX, minimapOffsetY, minimapScale]
  );

  const handleMouseMove = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (!dragRef.current || !onPanTo) return;
      const stage = e.target.getStage();
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Compute delta from drag start in pixel space, convert to world delta
      const { startPixelX, startPixelY, startCenterX, startCenterY, scale } = dragRef.current;
      const dx = (pointer.x - startPixelX) / scale;
      const dy = (pointer.y - startPixelY) / scale;
      onPanTo(startCenterX + dx, startCenterY + dy);
    },
    [onPanTo]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

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
        onTap={handleClick}
        style={{ cursor: onPanTo ? 'grab' : 'default' }}
      >
        <Layer>
          {/* Render simplified objects */}
          {objects.map((obj, index) => (
            <Rect
              key={index}
              x={obj.x}
              y={obj.y}
              width={obj.width}
              height={obj.height}
              fill="#667eea"
              opacity={0.6}
              cornerRadius={2}
            />
          ))}

          {/* Viewport indicator */}
          <Rect
            x={viewportX}
            y={viewportY}
            width={viewportWidth}
            height={viewportHeight}
            stroke="#f093fb"
            strokeWidth={2 / minimapScale}
            fill="transparent"
            listening={false}
          />
        </Layer>
      </Stage>
    </div>
  );
}
