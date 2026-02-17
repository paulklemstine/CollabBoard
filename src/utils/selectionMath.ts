import type { BoardObject } from '../types/board';

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute the axis-aligned bounding box of a set of board objects.
 * Returns { x, y, width, height } or null if the array is empty.
 */
export function getBoundingBox(objects: BoardObject[]): BBox | null {
  if (objects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Test whether two axis-aligned rectangles intersect.
 */
export function rectanglesIntersect(a: BBox, b: BBox): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export interface ObjectUpdate {
  id: string;
  updates: { x?: number; y?: number; width?: number; height?: number; rotation?: number };
}

/**
 * Translate every object by (dx, dy).
 */
export function transformGroupMove(
  objects: BoardObject[],
  dx: number,
  dy: number
): ObjectUpdate[] {
  return objects.map((obj) => ({
    id: obj.id,
    updates: {
      x: obj.x + dx,
      y: obj.y + dy,
    },
  }));
}

/**
 * Scale objects proportionally around an anchor point.
 * Each object's position and size are scaled relative to the anchor.
 */
export function transformGroupResize(
  objects: BoardObject[],
  _bbox: BBox,
  scaleX: number,
  scaleY: number,
  anchorX: number,
  anchorY: number
): ObjectUpdate[] {
  return objects.map((obj) => ({
    id: obj.id,
    updates: {
      x: anchorX + (obj.x - anchorX) * scaleX,
      y: anchorY + (obj.y - anchorY) * scaleY,
      width: obj.width * scaleX,
      height: obj.height * scaleY,
    },
  }));
}

/**
 * Rotate each object's position around the bounding box center and
 * add deltaAngle to each object's own rotation.
 */
export function transformGroupRotate(
  objects: BoardObject[],
  bbox: BBox,
  deltaAngle: number
): ObjectUpdate[] {
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  const rad = (deltaAngle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  return objects.map((obj) => {
    // Rotate the object's center around the group center
    const objCx = obj.x + obj.width / 2;
    const objCy = obj.y + obj.height / 2;
    const dx = objCx - cx;
    const dy = objCy - cy;
    const newCx = cx + dx * cos - dy * sin;
    const newCy = cy + dx * sin + dy * cos;

    return {
      id: obj.id,
      updates: {
        x: newCx - obj.width / 2,
        y: newCy - obj.height / 2,
        rotation: (obj.rotation || 0) + deltaAngle,
      },
    };
  });
}
