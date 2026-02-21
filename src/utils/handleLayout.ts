/**
 * Computes handle size, font size, and corner radius for transform handles.
 * Handles sit fully inside the component and scale down when the component
 * is too small, preventing overlap between adjacent corner handles.
 */

export const MAX_HANDLE_SIZE = 40;
export const MIN_HANDLE_SIZE = 20;

export interface HandleLayout {
  /** Effective handle width/height in px */
  size: number;
  /** Scaled emoji font size */
  fontSize: number;
  /** Scaled corner radius */
  cornerRadius: number;
}

export function getHandleLayout(componentWidth: number, componentHeight: number): HandleLayout {
  const hs = Math.max(
    MIN_HANDLE_SIZE,
    Math.min(MAX_HANDLE_SIZE, Math.floor(componentWidth / 2), Math.floor(componentHeight / 2)),
  );
  const ratio = hs / MAX_HANDLE_SIZE;
  return {
    size: hs,
    fontSize: Math.max(12, Math.round(24 * ratio)),
    cornerRadius: Math.max(4, Math.round(8 * ratio)),
  };
}
