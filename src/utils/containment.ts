import type { BoardObject, Frame } from '../types/board';
import type { AnyBoardObject } from '../services/boardService';

export interface Point {
  x: number;
  y: number;
}

export function getObjectCenter(obj: BoardObject): Point {
  return {
    x: obj.x + obj.width / 2,
    y: obj.y + obj.height / 2,
  };
}

export function isPointInsideFrame(point: Point, frame: Frame): boolean {
  return (
    point.x >= frame.x &&
    point.x <= frame.x + frame.width &&
    point.y >= frame.y &&
    point.y <= frame.y + frame.height
  );
}

/**
 * Check if making frameId a child of potentialParentId would create a circular dependency
 * e.g., if Frame A is already a parent of Frame B, then Frame B cannot become a parent of Frame A
 */
export function wouldCreateCircularDependency(
  frameId: string,
  potentialParentId: string,
  allObjects: AnyBoardObject[]
): boolean {
  // If trying to parent to self, that's circular
  if (frameId === potentialParentId) return true;

  // Walk up the parent chain of the potential parent
  // If we find frameId anywhere in the chain, it would be circular
  let currentId: string | undefined = potentialParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      // Infinite loop detected in existing structure
      return true;
    }
    visited.add(currentId);

    const obj = allObjects.find(o => o.id === currentId);
    if (!obj) break;

    // If we find the frameId we're trying to nest, it would be circular
    if (obj.id === frameId) return true;

    currentId = obj.parentId;
  }

  return false;
}

/**
 * Finds the smallest containing frame for a dragged object.
 * Excludes the object itself (if it's a frame) from candidates.
 * For frames, also excludes frames that would create circular dependencies.
 */
export function findContainingFrame(
  draggedObj: BoardObject,
  frames: Frame[],
  allObjects?: AnyBoardObject[]
): Frame | null {
  const center = getObjectCenter(draggedObj);
  let bestFrame: Frame | null = null;
  let bestArea = Infinity;

  for (const frame of frames) {
    // Don't allow a frame to contain itself
    if (frame.id === draggedObj.id) continue;

    // If dragged object is a frame, check for circular dependencies
    if (draggedObj.type === 'frame' && allObjects) {
      if (wouldCreateCircularDependency(draggedObj.id, frame.id, allObjects)) {
        continue;
      }
    }

    if (isPointInsideFrame(center, frame)) {
      const area = frame.width * frame.height;
      if (area < bestArea) {
        bestArea = area;
        bestFrame = frame;
      }
    }
  }

  return bestFrame;
}

export function getChildrenOfFrame(
  frameId: string,
  objects: AnyBoardObject[]
): AnyBoardObject[] {
  return objects.filter((obj) => obj.parentId === frameId);
}

/**
 * Calculate the bounding box dimensions of a rotated rectangle.
 * Returns the width and height of the axis-aligned bounding box.
 */
function getRotatedBoundingBox(
  width: number,
  height: number,
  rotationDegrees: number
): { width: number; height: number } {
  // Convert degrees to radians
  const radians = (rotationDegrees * Math.PI) / 180;

  // Calculate the bounding box dimensions
  // For a rotated rectangle, the bounding box is:
  // width = |w * cos(θ)| + |h * sin(θ)|
  // height = |w * sin(θ)| + |h * cos(θ)|
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

/**
 * Calculate scaled dimensions and position if an object needs to be scaled down to fit inside a frame.
 * Returns null if the object already fits.
 * Maintains aspect ratio, leaves a small margin (10% padding), and preserves the center point.
 * Accounts for object rotation by calculating the rotated bounding box.
 */
export function scaleToFitFrame(
  obj: BoardObject,
  frame: Frame
): { x: number; y: number; width: number; height: number } | null {
  // Leave 10% padding (5% on each side)
  const padding = 0.9;
  const maxWidth = frame.width * padding;
  const maxHeight = frame.height * padding;

  // Calculate the actual bounding box considering rotation
  const boundingBox = getRotatedBoundingBox(obj.width, obj.height, obj.rotation);

  // If object already fits (considering rotation), no scaling needed
  if (boundingBox.width <= maxWidth && boundingBox.height <= maxHeight) {
    return null;
  }

  // Calculate scale factors based on the rotated bounding box
  const scaleX = maxWidth / boundingBox.width;
  const scaleY = maxHeight / boundingBox.height;

  // Use the smaller scale factor to maintain aspect ratio
  const scale = Math.min(scaleX, scaleY);

  // Apply scale to the ORIGINAL dimensions (not the bounding box)
  const newWidth = obj.width * scale;
  const newHeight = obj.height * scale;

  // Calculate original center point
  const centerX = obj.x + obj.width / 2;
  const centerY = obj.y + obj.height / 2;

  // Calculate new position to keep center point fixed
  const newX = centerX - newWidth / 2;
  const newY = centerY - newHeight / 2;

  return {
    x: newX,
    y: newY,
    width: newWidth,
    height: newHeight,
  };
}
