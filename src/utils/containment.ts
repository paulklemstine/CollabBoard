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
