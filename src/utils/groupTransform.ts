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

  // Object center
  const objCenterX = object.x + object.width / 2;
  const objCenterY = object.y + object.height / 2;

  let orbitOffsetX = 0;
  let orbitOffsetY = 0;

  if (rotationDelta !== 0) {
    // Rotate around selection box center (matches transformGroupRotate)
    const centerX = selectionBox.x + selectionBox.width / 2;
    const centerY = selectionBox.y + selectionBox.height / 2;
    const dx = objCenterX - centerX;
    const dy = objCenterY - centerY;
    const rad = rotationDelta * (Math.PI / 180);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    orbitOffsetX = (dx * cos - dy * sin) - dx;
    orbitOffsetY = (dx * sin + dy * cos) - dy;
  }

  if (scaleX !== 1 || scaleY !== 1) {
    // Scale from selection box top-left (matches transformGroupResize + SelectionOverlay)
    const dx = objCenterX - selectionBox.x;
    const dy = objCenterY - selectionBox.y;
    orbitOffsetX += dx * (scaleX - 1);
    orbitOffsetY += dy * (scaleY - 1);
  }

  return {
    scaleX,
    scaleY,
    rotationDelta,
    orbitOffset: { x: orbitOffsetX, y: orbitOffsetY },
  };
}
