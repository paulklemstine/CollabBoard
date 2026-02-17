import { useState, useEffect, useRef } from 'react';
import { PositionInterpolator } from '../utils/interpolation';

/**
 * Hook to smooth board object position updates from Firestore.
 *
 * This provides buttery-smooth movement when viewing objects being dragged
 * by other users, compensating for Firestore update latency and throttling.
 *
 * Usage: Wrap the x, y coordinates from Firestore with this hook.
 *
 * @example
 * // In StickyNote component:
 * const { x: smoothX, y: smoothY } = useSmoothedObjectPosition(
 *   note.id,
 *   note.x,
 *   note.y,
 *   isDragging  // Don't smooth if current user is dragging
 * );
 */
export function useSmoothedObjectPosition(
  objectId: string,
  targetX: number,
  targetY: number,
  isLocalDrag: boolean = false
): { x: number; y: number } {
  const [smoothX, setSmoothX] = useState(targetX);
  const [smoothY, setSmoothY] = useState(targetY);
  const interpolatorRef = useRef<PositionInterpolator | null>(null);
  const lastObjectIdRef = useRef(objectId);

  // Initialize or recreate interpolator when object ID changes
  useEffect(() => {
    // If object ID changed, this is a different object - recreate interpolator
    if (lastObjectIdRef.current !== objectId) {
      interpolatorRef.current?.destroy();
      interpolatorRef.current = null;
      lastObjectIdRef.current = objectId;
    }

    if (!interpolatorRef.current) {
      interpolatorRef.current = new PositionInterpolator(
        targetX,
        targetY,
        (newX, newY) => {
          setSmoothX(newX);
          setSmoothY(newY);
        },
        0.15,  // Smoother for remote objects (less jittery)
        0.5    // Higher prediction for network lag compensation
      );
    }

    return () => {
      interpolatorRef.current?.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objectId]);

  // Update target position when it changes
  useEffect(() => {
    if (!interpolatorRef.current) return;

    // If local user is dragging, snap immediately (no lag)
    if (isLocalDrag) {
      interpolatorRef.current.snapTo(targetX, targetY);
    } else {
      // Remote update - use smooth interpolation
      interpolatorRef.current.setTarget(targetX, targetY);
    }
  }, [targetX, targetY, isLocalDrag]);

  return { x: smoothX, y: smoothY };
}
