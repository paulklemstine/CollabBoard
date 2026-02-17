import type { StageTransform } from '../components/Board/Board';

/**
 * Convert screen coordinates to world coordinates
 *
 * Screen coordinates are pixel positions on the viewport (e.g., toolbar button position)
 * World coordinates are positions in the infinite canvas accounting for pan and zoom
 *
 * Formula: worldCoord = (screenCoord - stagePosition) / scale
 *
 * @param screenX - X coordinate in screen space (pixels from left edge of viewport)
 * @param screenY - Y coordinate in screen space (pixels from top edge of viewport)
 * @param transform - The stage transform (position and scale)
 * @returns World coordinates {x, y}
 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  transform: StageTransform
): { x: number; y: number } {
  return {
    x: (screenX - transform.x) / transform.scale,
    y: (screenY - transform.y) / transform.scale,
  };
}

/**
 * Convert world coordinates to screen coordinates
 *
 * @param worldX - X coordinate in world space
 * @param worldY - Y coordinate in world space
 * @param transform - The stage transform (position and scale)
 * @returns Screen coordinates {x, y}
 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  transform: StageTransform
): { x: number; y: number } {
  return {
    x: worldX * transform.scale + transform.x,
    y: worldY * transform.scale + transform.y,
  };
}
