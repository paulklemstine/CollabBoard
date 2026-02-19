import { useRef, useEffect } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type { StageTransform } from '../Board/Board';

interface MinimapProps {
  transform: StageTransform;
  objects?: Array<{ x: number; y: number; width: number; height: number; type: string }>;
}

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 150;
const ZOOM_OUT_FACTOR = 30;

export function Minimap({ transform, objects = [] }: MinimapProps) {
  const stageRef = useRef<any>(null);

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

  return (
    <div
      data-testid="minimap"
      className="glass-playful rounded-2xl shadow-xl overflow-hidden"
      style={{ width: `${MINIMAP_WIDTH}px`, height: `${MINIMAP_HEIGHT}px` }}
    >
      <Stage
        ref={stageRef}
        width={MINIMAP_WIDTH}
        height={MINIMAP_HEIGHT}
        scaleX={minimapScale}
        scaleY={minimapScale}
        x={minimapOffsetX}
        y={minimapOffsetY}
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
