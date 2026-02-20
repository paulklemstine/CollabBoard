import type { AnyBoardObject } from '../services/boardService';

interface DuplicateResult {
  clones: AnyBoardObject[];
  idRemap: Map<string, string>;
}

/**
 * Pure function that duplicates a set of board objects.
 * - Deep-clones via structuredClone
 * - Assigns new IDs via crypto.randomUUID()
 * - Remaps parentId if parent frame is in selection, else clears it
 * - Remaps connector fromId/toId only if both endpoints are in selection; skips connector otherwise
 * - Offsets x/y by {dx, dy}
 * - Sets updatedAt incrementally so clones render on top
 */
export function duplicateObjects(
  objects: AnyBoardObject[],
  allBoardObjects: AnyBoardObject[],
  userId: string,
  offset: { dx: number; dy: number }
): DuplicateResult {
  const selectionIds = new Set(objects.map((o) => o.id));
  const idRemap = new Map<string, string>();

  // Build old→new ID remap
  for (const obj of objects) {
    idRemap.set(obj.id, crypto.randomUUID());
  }

  // Find max updatedAt across entire board for z-ordering
  let maxUpdatedAt = 0;
  for (const obj of allBoardObjects) {
    if (obj.updatedAt > maxUpdatedAt) maxUpdatedAt = obj.updatedAt;
  }

  const clones: AnyBoardObject[] = [];
  let orderCounter = 0;

  for (const obj of objects) {
    // Skip connectors whose endpoints aren't both in selection
    if (obj.type === 'connector') {
      const conn = obj as import('../types/board').Connector;
      if (!selectionIds.has(conn.fromId) || !selectionIds.has(conn.toId)) {
        continue;
      }
    }

    const clone = structuredClone(obj) as AnyBoardObject;
    clone.id = idRemap.get(obj.id)!;
    clone.createdBy = userId;
    clone.updatedAt = maxUpdatedAt + 1 + orderCounter;
    orderCounter++;

    // Offset position (connectors don't have meaningful x/y but it won't hurt)
    clone.x += offset.dx;
    clone.y += offset.dy;

    // Remap parentId
    if (clone.parentId) {
      if (selectionIds.has(clone.parentId)) {
        clone.parentId = idRemap.get(clone.parentId);
      } else {
        clone.parentId = undefined;
      }
    }

    // Remap connector endpoints
    if (clone.type === 'connector') {
      const conn = clone as import('../types/board').Connector;
      conn.fromId = idRemap.get(conn.fromId) ?? conn.fromId;
      conn.toId = idRemap.get(conn.toId) ?? conn.toId;
    }

    clones.push(clone);
  }

  return { clones, idRemap };
}
