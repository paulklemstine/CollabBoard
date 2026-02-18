/**
 * Utilities for applying live group transformations to objects during multi-select drag.
 */

import type { GroupTransformPreview, SelectionBox } from '../hooks/useMultiSelect';

export interface ObjectTransform {
  scaleX: number;
  scaleY: number;
  rotationDelta: number;
  orbitOffset: { x: number; y: number };
}

/**
 * Calculate live transform for an object being transformed as part of a group.
 *
 * @param object - The object to transform (must have x, y, width, height)
 * @param selectionBox - The bounding box of the entire selection
 * @param transformPreview - The current transform preview (scale and rotation)
 * @returns Transform to apply to the object for live preview
 */
export function calculateGroupObjectTransform(
  object: { x: number; y: number; width: number; height: number },
  selectionBox: SelectionBox,
  transformPreview: GroupTransformPreview
): ObjectTransform {
  const { scaleX, scaleY, rotation: rotationDelta } = transformPreview;

  // Selection box center (pivot point for rotation and scaling)
  const centerX = selectionBox.x + selectionBox.width / 2;
  const centerY = selectionBox.y + selectionBox.height / 2;

  // Object center
  const objCenterX = object.x + object.width / 2;
  const objCenterY = object.y + object.height / 2;

  // Vector from selection center to object center
  const dx = objCenterX - centerX;
  const dy = objCenterY - centerY;

  // Apply rotation to the offset vector
  const rad = rotationDelta * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Rotated and scaled offset
  const rotatedDx = (dx * cos - dy * sin) * scaleX;
  const rotatedDy = (dx * sin + dy * cos) * scaleY;

  // Calculate orbit offset (how much the object moves due to rotation/scale around center)
  const orbitOffsetX = rotatedDx - dx;
  const orbitOffsetY = rotatedDy - dy;

  return {
    scaleX,
    scaleY,
    rotationDelta,
    orbitOffset: { x: orbitOffsetX, y: orbitOffsetY },
  };
}
