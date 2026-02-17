import { useState, useEffect, useRef } from 'react';
import { PositionInterpolator } from '../utils/interpolation';

export interface SmoothedPositionOptions {
  /**
   * How quickly to interpolate towards target (0-1, higher = faster)
   * Default: 0.2 (smooth but responsive)
   */
  smoothingFactor?: number;

  /**
   * How much to predict ahead based on velocity (0-1)
   * Default: 0.4 (moderate prediction)
   */
  predictionFactor?: number;

  /**
   * Whether to snap immediately to initial position (no interpolation)
   * Default: true (prevents initial animation)
   */
  snapInitial?: boolean;
}

/**
 * Hook to smooth position updates using predictive interpolation.
 *
 * Perfect for:
 * - Remote cursor positions (network lag)
 * - Dragged objects (smooth movement)
 * - Any position that updates in discrete steps
 *
 * @example
 * const [smoothX, smoothY] = useSmoothedPosition(targetX, targetY);
 *
 * @example
 * const [smoothX, smoothY] = useSmoothedPosition(targetX, targetY, {
 *   smoothingFactor: 0.3,  // More responsive
 *   predictionFactor: 0.5, // More prediction
 * });
 */
export function useSmoothedPosition(
  targetX: number,
  targetY: number,
  options: SmoothedPositionOptions = {}
): [number, number] {
  const {
    smoothingFactor = 0.2,
    predictionFactor = 0.4,
    snapInitial = true,
  } = options;

  const [smoothX, setSmoothX] = useState(targetX);
  const [smoothY, setSmoothY] = useState(targetY);
  const interpolatorRef = useRef<PositionInterpolator | null>(null);
  const isInitialRef = useRef(true);

  // Initialize interpolator on mount
  useEffect(() => {
    interpolatorRef.current = new PositionInterpolator(
      targetX,
      targetY,
      (newX, newY) => {
        setSmoothX(newX);
        setSmoothY(newY);
      },
      smoothingFactor,
      predictionFactor
    );

    return () => {
      interpolatorRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only initialize once

  // Update target when position changes
  useEffect(() => {
    if (!interpolatorRef.current) return;

    // Snap to initial position without interpolation
    if (isInitialRef.current && snapInitial) {
      interpolatorRef.current.snapTo(targetX, targetY);
      isInitialRef.current = false;
    } else {
      interpolatorRef.current.setTarget(targetX, targetY);
    }
  }, [targetX, targetY, snapInitial]);

  return [smoothX, smoothY];
}

/**
 * Hook variant that returns an object instead of tuple.
 * Useful when you need named properties.
 *
 * @example
 * const { x, y } = useSmoothedPositionObject(targetX, targetY);
 */
export function useSmoothedPositionObject(
  targetX: number,
  targetY: number,
  options: SmoothedPositionOptions = {}
): { x: number; y: number } {
  const [x, y] = useSmoothedPosition(targetX, targetY, options);
  return { x, y };
}
