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
 * Finds the smallest containing frame for a dragged object.
 * Excludes the object itself (if it's a frame) from candidates.
 */
export function findContainingFrame(
  draggedObj: BoardObject,
  frames: Frame[]
): Frame | null {
  const center = getObjectCenter(draggedObj);
  let bestFrame: Frame | null = null;
  let bestArea = Infinity;

  for (const frame of frames) {
    // Don't allow a frame to contain itself
    if (frame.id === draggedObj.id) continue;

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
