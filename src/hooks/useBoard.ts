import { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import {
  addObject,
  updateObject,
  deleteObject,
  subscribeToBoard,
  batchUpdateObjects,
  type AnyBoardObject,
} from '../services/boardService';
import type { StickyNote, Shape, ShapeType, Frame, Sticker, Connector, TextObject } from '../types/board';
import { findContainingFrame, getChildrenOfFrame, isObjectInsideFrame } from '../utils/containment';
import { screenToWorld } from '../utils/coordinates';
import type { StageTransform } from '../components/Board/Board';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { searchGiphy } from '../services/giphyService';
import type { UndoEntry, UndoChange } from './useUndoRedo';

const STICKY_COLORS = ['#fef9c3', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#ffe4e6', '#fed7aa', '#e0e7ff'];

export function useBoard(
  boardId: string,
  userId: string,
  pushUndo?: (entry: UndoEntry) => void,
  isUndoRedoingRef?: React.MutableRefObject<boolean>,
) {
  const [objects, setObjects] = useState<AnyBoardObject[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFrame, setHoveredFrame] = useState<{ id: string; fits: boolean } | null>(null);
  const [draggingObjectId, setDraggingObjectId] = useState<string | null>(null);
  const [newObjectIds, setNewObjectIds] = useState<Set<string>>(new Set());
  const [frameDragOffset, setFrameDragOffset] = useState<{ frameId: string; dx: number; dy: number } | null>(null);
  const pendingFrameClearRef = useRef(false);
  const frameDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const connectorDragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const frameDragFirestoreRef = useRef(0);

  // Keep a ref to objects so drag callbacks always see the latest state
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  // Undo: before-snapshots captured during drag/resize/rotate sessions
  const dragSnapshotRef = useRef<Map<string, AnyBoardObject>>(new Map());

  // Stable refs for undo dependencies (avoids dep-array churn)
  const pushUndoRef = useRef(pushUndo);
  pushUndoRef.current = pushUndo;
  const isUndoRedoingRefRef = useRef(isUndoRedoingRef);
  isUndoRedoingRefRef.current = isUndoRedoingRef;

  /** Push an undo entry, guarded by isUndoRedoing flag */
  const maybePushUndo = useCallback((entry: UndoEntry) => {
    if (!pushUndoRef.current) return;
    if (isUndoRedoingRefRef.current?.current) return;
    if (entry.changes.length === 0) return;
    pushUndoRef.current(entry);
  }, []);

  /** Capture a before-snapshot for an object (no-op if already captured for this drag session) */
  const captureBeforeSnapshot = useCallback((id: string) => {
    if (dragSnapshotRef.current.has(id)) return;
    const obj = objectsRef.current.find(o => o.id === id);
    if (obj) dragSnapshotRef.current.set(id, structuredClone(obj));
  }, []);

  // Clear frame drag offset atomically when Firestore optimistic update arrives
  useLayoutEffect(() => {
    if (pendingFrameClearRef.current) {
      setFrameDragOffset(null);
      pendingFrameClearRef.current = false;
    }
  }, [objects]);

  useEffect(() => {
    const unsubscribe = subscribeToBoard(boardId, setObjects);
    return unsubscribe;
  }, [boardId]);

  // Auto-resolve GIF stickers: when a sticker has gifSearchTerm but no gifUrl,
  // search GIPHY via Cloud Function and update the sticker with the first result.
  const resolvedGifIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const stickers = objects.filter(
      (o): o is Sticker =>
        o.type === 'sticker' && !!o.gifSearchTerm && !o.gifUrl && !resolvedGifIds.current.has(o.id)
    );
    for (const sticker of stickers) {
      resolvedGifIds.current.add(sticker.id);
      searchGiphy(sticker.gifSearchTerm!, 1)
        .then((gifs) => {
          const gif = gifs[0];
          if (gif) {
            const img = gif.images?.fixed_height ?? gif.images?.original;
            const url = img?.url ?? '';
            if (url) {
              updateObject(boardId, sticker.id, { gifUrl: url } as Partial<Sticker>, userId);
            }
          }
        })
        .catch((err) => console.warn('GIF auto-resolve failed:', err));
    }
  }, [objects, boardId]);

  const trackNewObject = useCallback((id: string) => {
    setNewObjectIds(prev => new Set(prev).add(id));
    setTimeout(() => {
      setNewObjectIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 2000);
  }, []);

  const addStickyNote = useCallback(
    (transform: StageTransform, x?: number, y?: number, color?: string, textColor?: string, borderColor?: string) => {
      // Calculate screen coordinates for toolbar button position
      const screenX = window.innerWidth / 2 - 100; // Center horizontally (sticky is 200px wide)
      const screenY = window.innerHeight - 350; // 350px from bottom (200px height + 150px for toolbar space)

      // Convert to world coordinates if no coordinates provided
      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }

      // Get highest updatedAt to ensure new object appears on top
      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

      const note: StickyNote = {
        id: crypto.randomUUID(),
        type: 'sticky',
        x: worldX,
        y: worldY,
        width: 200,
        height: 200,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        text: '',
        color: color ?? STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
        ...(textColor ? { textColor } : {}),
        ...(borderColor && borderColor !== 'transparent' ? { borderColor } : {}),
      };
      addObject(boardId, note);
      trackNewObject(note.id);
      maybePushUndo({ changes: [{ objectId: note.id, before: null, after: structuredClone(note) }] });
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const addShape = useCallback(
    (transform: StageTransform, shapeType: ShapeType, color: string, x?: number, y?: number, strokeColor?: string, borderColor?: string) => {
      // Calculate dimensions based on shape type
      const shapeWidth = shapeType === 'line' ? 200 : 120;
      const shapeHeight = shapeType === 'line' ? 4 : 120;

      // Calculate screen coordinates for toolbar button position
      const screenX = window.innerWidth / 2 - shapeWidth / 2; // Center horizontally
      const screenY = window.innerHeight - shapeHeight - 170; // Above toolbar (shape height + 170px for toolbar space)

      // Convert to world coordinates if no coordinates provided
      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }

      // Get highest updatedAt to ensure new object appears on top
      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

      const shape: Shape = {
        id: crypto.randomUUID(),
        type: 'shape',
        x: worldX,
        y: worldY,
        width: shapeWidth,
        height: shapeHeight,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        shapeType,
        color,
        ...(strokeColor && strokeColor !== 'transparent' ? { strokeColor } : {}),
        ...(borderColor && borderColor !== 'transparent' ? { borderColor } : {}),
      };
      addObject(boardId, shape);
      trackNewObject(shape.id);
      maybePushUndo({ changes: [{ objectId: shape.id, before: null, after: structuredClone(shape) }] });
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const addFrame = useCallback(
    (transform: StageTransform, x?: number, y?: number, borderless?: boolean) => {
      // Calculate screen coordinates for toolbar button position
      const screenX = window.innerWidth / 2 - 200; // Center horizontally (frame is 400px wide)
      const screenY = window.innerHeight - 300 - 170; // Above toolbar (300px height + 170px for toolbar space)

      // Convert to world coordinates if no coordinates provided
      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }

      // Get highest updatedAt to ensure new object appears on top
      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

      const frame: Frame = {
        id: crypto.randomUUID(),
        type: 'frame',
        x: worldX,
        y: worldY,
        width: 400,
        height: 300,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        title: '',
        ...(borderless ? { borderless: true } : {}),
      };
      addObject(boardId, frame);
      trackNewObject(frame.id);
      maybePushUndo({ changes: [{ objectId: frame.id, before: null, after: structuredClone(frame) }] });
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const addSticker = useCallback(
    (transform: StageTransform, emoji: string, x?: number, y?: number) => {
      // Calculate screen coordinates for toolbar button position
      const screenX = window.innerWidth / 2 - 75; // Center horizontally (sticker is 150px wide)
      const screenY = window.innerHeight - 300; // 300px from bottom (150px height + 150px for toolbar space)

      // Convert to world coordinates if no coordinates provided
      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }

      // Get highest updatedAt to ensure new object appears on top
      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

      const sticker: Sticker = {
        id: crypto.randomUUID(),
        type: 'sticker',
        x: worldX,
        y: worldY,
        width: 150,
        height: 150,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        emoji,
      };
      addObject(boardId, sticker);
      trackNewObject(sticker.id);
      maybePushUndo({ changes: [{ objectId: sticker.id, before: null, after: structuredClone(sticker) }] });
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const addGifSticker = useCallback(
    (transform: StageTransform, gifUrl: string, x?: number, y?: number) => {
      const screenX = window.innerWidth / 2 - 75;
      const screenY = window.innerHeight - 300;
      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }
      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));
      const sticker: Sticker = {
        id: crypto.randomUUID(),
        type: 'sticker',
        x: worldX,
        y: worldY,
        width: 150,
        height: 150,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1,
        emoji: '',
        gifUrl,
      };
      addObject(boardId, sticker);
      trackNewObject(sticker.id);
      maybePushUndo({ changes: [{ objectId: sticker.id, before: null, after: structuredClone(sticker) }] });

      // Cache GIF in Firebase Storage in the background
      fetch(gifUrl)
        .then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch GIF: ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const sRef = storageRef(storage, `boards/${boardId}/gifs/${sticker.id}.gif`);
          return uploadBytes(sRef, blob, { contentType: 'image/gif' });
        })
        .then((snapshot) => getDownloadURL(snapshot.ref))
        .then((cachedUrl) => {
          updateObject(boardId, sticker.id, { gifUrl: cachedUrl } as Partial<Sticker>, userId);
        })
        .catch((err) => console.warn('GIF caching failed, keeping original URL:', err));
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const addText = useCallback(
    (
      transform: StageTransform,
      fontSize?: number,
      fontFamily?: string,
      fontWeight?: 'normal' | 'bold',
      fontStyle?: 'normal' | 'italic',
      textAlign?: 'left' | 'center' | 'right',
      textColor?: string,
      x?: number,
      y?: number,
    ) => {
      const textWidth = 300;
      const effectiveFontSize = fontSize ?? 24;
      // Ensure the panel is tall enough for at least one line of text
      // lineHeight 1.4 + 8px vertical padding (4 top + 4 bottom)
      const textHeight = Math.max(50, Math.ceil(effectiveFontSize * 1.4) + 8);
      const screenX = window.innerWidth / 2 - textWidth / 2;
      const screenY = window.innerHeight - textHeight - 170;

      let worldX: number;
      let worldY: number;
      if (x !== undefined && y !== undefined) {
        worldX = x;
        worldY = y;
      } else {
        const world = screenToWorld(screenX, screenY, transform);
        worldX = world.x;
        worldY = world.y;
      }

      const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

      const textObj: TextObject = {
        id: crypto.randomUUID(),
        type: 'text',
        x: worldX,
        y: worldY,
        width: textWidth,
        height: textHeight,
        rotation: 0,
        createdBy: userId,
        lastModifiedBy: userId,
        updatedAt: maxUpdatedAt + 1,
        text: '',
        fontSize: fontSize ?? 24,
        fontFamily: fontFamily ?? "'Inter', sans-serif",
        fontWeight: fontWeight ?? 'normal',
        fontStyle: fontStyle ?? 'normal',
        textAlign: textAlign ?? 'left',
        color: textColor ?? '#1e293b',
      };
      addObject(boardId, textObj);
      trackNewObject(textObj.id);
      maybePushUndo({ changes: [{ objectId: textObj.id, before: null, after: structuredClone(textObj) }] });
    },
    [boardId, userId, trackNewObject, maybePushUndo]
  );

  const moveObject = useCallback(
    (objectId: string, x: number, y: number) => {
      updateObject(boardId, objectId, { x, y }, userId);
    },
    [boardId]
  );

  const resizeObject = useCallback(
    (objectId: string, width: number, height: number) => {
      captureBeforeSnapshot(objectId);
      updateObject(boardId, objectId, { width, height }, userId);
    },
    [boardId, captureBeforeSnapshot]
  );

  const rotateObject = useCallback(
    (objectId: string, rotation: number) => {
      captureBeforeSnapshot(objectId);
      updateObject(boardId, objectId, { rotation }, userId);
    },
    [boardId, captureBeforeSnapshot]
  );

  const moveLineEndpoint = useCallback(
    (objectId: string, x: number, y: number, width: number, rotation: number) => {
      captureBeforeSnapshot(objectId);
      updateObject(boardId, objectId, { x, y, width, rotation }, userId);
    },
    [boardId, captureBeforeSnapshot]
  );

  /** Called at the end of a resize drag — commits final size + pushes undo */
  const finalizeResize = useCallback(
    (objectId: string, width: number, height: number) => {
      const before = dragSnapshotRef.current.get(objectId);
      updateObject(boardId, objectId, { width, height }, userId);
      if (before) {
        const after = structuredClone({ ...before, width, height, updatedAt: Date.now() });
        maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
      }
      dragSnapshotRef.current.delete(objectId);
    },
    [boardId, maybePushUndo]
  );

  /** Called at the end of a rotate drag — commits final rotation + pushes undo */
  const finalizeRotate = useCallback(
    (objectId: string, rotation: number) => {
      const before = dragSnapshotRef.current.get(objectId);
      updateObject(boardId, objectId, { rotation }, userId);
      if (before) {
        const after = structuredClone({ ...before, rotation, updatedAt: Date.now() });
        maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
      }
      dragSnapshotRef.current.delete(objectId);
    },
    [boardId, maybePushUndo]
  );

  /** Called at the end of a line endpoint drag — commits final position + pushes undo */
  const finalizeLineEndpoint = useCallback(
    (objectId: string, x: number, y: number, width: number, rotation: number) => {
      const before = dragSnapshotRef.current.get(objectId);
      updateObject(boardId, objectId, { x, y, width, rotation }, userId);
      if (before) {
        const after = structuredClone({ ...before, x, y, width, rotation, updatedAt: Date.now() });
        maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
      }
      dragSnapshotRef.current.delete(objectId);
    },
    [boardId, maybePushUndo]
  );

  /** Called during drag of non-frame objects — updates position + detects hover over frames */
  const handleDragMove = useCallback(
    (objectId: string, x: number, y: number) => {
      captureBeforeSnapshot(objectId);
      updateObject(boardId, objectId, { x, y }, userId);

      const obj = objectsRef.current.find((o) => o.id === objectId);
      if (!obj) return;

      const draggedObj = { ...obj, x, y };
      const frames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame'
      );
      const containingFrame = findContainingFrame(draggedObj, frames, objectsRef.current);
      setHoveredFrame(containingFrame ? { id: containingFrame.id, fits: isObjectInsideFrame(draggedObj, containingFrame) } : null);
      setDraggingObjectId(objectId);
    },
    [boardId, captureBeforeSnapshot]
  );

  /** Called on drag end — persists position + sets/clears parentId based on containment.
   *  Oversized objects are rejected (not placed inside the frame). */
  const handleDragEnd = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objectsRef.current.find((o) => o.id === objectId);
      if (!obj) {
        updateObject(boardId, objectId, { x, y }, userId);
        setHoveredFrame(null);
        setDraggingObjectId(null);
        // Push undo from snapshot even if obj not found in current state
        const before = dragSnapshotRef.current.get(objectId);
        if (before) {
          const after = structuredClone({ ...before, x, y, updatedAt: Date.now() });
          maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
          dragSnapshotRef.current.delete(objectId);
        }
        return;
      }

      const draggedObj = { ...obj, x, y };
      const frames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame'
      );
      const containingFrame = findContainingFrame(draggedObj, frames, objectsRef.current);

      // Reject oversized objects — only accept if object fits in frame
      const fits = containingFrame ? isObjectInsideFrame(draggedObj, containingFrame) : false;
      const newParentId = containingFrame && fits ? containingFrame.id : '';

      updateObject(boardId, objectId, { x, y, parentId: newParentId }, userId);

      // Push undo
      const before = dragSnapshotRef.current.get(objectId);
      if (before) {
        const after = structuredClone({ ...before, x, y, parentId: newParentId, updatedAt: Date.now() });
        maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
        dragSnapshotRef.current.delete(objectId);
      }

      setHoveredFrame(null);
      setDraggingObjectId(null);
    },
    [boardId, maybePushUndo]
  );

  /** Called during frame drag — moves frame, tracks offset for children locally, detects containment */
  const handleFrameDragMove = useCallback(
    (frameId: string, newX: number, newY: number) => {
      const frame = objectsRef.current.find((o) => o.id === frameId);
      if (!frame || frame.type !== 'frame') return;

      // Record the original position on first move
      if (!frameDragStartRef.current) {
        frameDragStartRef.current = { x: frame.x, y: frame.y };

        // Also record original connector positions
        const children = getChildrenOfFrame(frameId, objectsRef.current);
        const frameAndChildrenIds = new Set([frameId, ...children.map(c => c.id)]);
        const connectors = objectsRef.current.filter(
          (o): o is Connector => o.type === 'connector' &&
            (frameAndChildrenIds.has(o.fromId) || frameAndChildrenIds.has(o.toId))
        );

        connectorDragStartRef.current = new Map();
        for (const connector of connectors) {
          connectorDragStartRef.current.set(connector.id, { x: connector.x, y: connector.y });
        }

        // Capture undo snapshots for frame + children + connectors
        captureBeforeSnapshot(frameId);
        for (const child of children) {
          captureBeforeSnapshot(child.id);
        }
        for (const connector of connectors) {
          captureBeforeSnapshot(connector.id);
        }
      }

      const dx = newX - frameDragStartRef.current.x;
      const dy = newY - frameDragStartRef.current.y;

      // ALWAYS update visual offset — children need this every frame for smooth dragging
      setFrameDragOffset({ frameId, dx, dy });
      setDraggingObjectId(frameId);

      // Throttle Firestore writes and heavy computations (connectors, hover detection)
      const now = Date.now();
      if (now - frameDragFirestoreRef.current < 50) return;
      frameDragFirestoreRef.current = now;

      // Don't write the frame's own position during drag — the Firestore optimistic
      // update would reset the Konva node to a stale position, desyncing from children.
      // Frame position is written atomically with children on dragEnd.
      // Only write connector positions for real-time sync during drag.
      const children = getChildrenOfFrame(frameId, objectsRef.current);
      const frameAndChildrenIds = new Set([frameId, ...children.map(c => c.id)]);
      const connectors = objectsRef.current.filter(
        (o): o is Connector => o.type === 'connector' &&
          (frameAndChildrenIds.has(o.fromId) || frameAndChildrenIds.has(o.toId))
      );

      const batchUpdates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = [];
      for (const connector of connectors) {
        const originalPos = connectorDragStartRef.current.get(connector.id);
        if (originalPos) {
          batchUpdates.push({
            id: connector.id,
            updates: {
              x: originalPos.x + dx,
              y: originalPos.y + dy,
            },
          });
        }
      }

      if (batchUpdates.length > 0) {
        batchUpdateObjects(boardId, batchUpdates, userId);
      }

      // Detect hover over other frames for frame-in-frame nesting
      const draggedFrame = { ...frame, x: newX, y: newY };
      const otherFrames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame' && o.id !== frameId
      );
      const containingFrame = findContainingFrame(draggedFrame, otherFrames, objectsRef.current);
      setHoveredFrame(containingFrame ? { id: containingFrame.id, fits: isObjectInsideFrame(draggedFrame, containingFrame) } : null);
    },
    [boardId, captureBeforeSnapshot]
  );

  /** Called on frame drag end — persist final child positions, set parentId, clear offset */
  const handleFrameDragEnd = useCallback(
    async (frameId: string, newX: number, newY: number) => {
      const frame = objectsRef.current.find((o) => o.id === frameId);
      if (!frame || frame.type !== 'frame') {
        updateObject(boardId, frameId, { x: newX, y: newY }, userId);
        frameDragStartRef.current = null;
        connectorDragStartRef.current.clear();
        frameDragFirestoreRef.current = 0;
        setHoveredFrame(null);
        setDraggingObjectId(null);
        pendingFrameClearRef.current = true;
        dragSnapshotRef.current.clear();
        return;
      }

      // Detect containment for frame-in-frame nesting
      const draggedFrame = { ...frame, x: newX, y: newY };
      const otherFrames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame' && o.id !== frameId
      );
      const containingFrame = findContainingFrame(draggedFrame, otherFrames, objectsRef.current);

      // Reject oversized frames — only accept if frame fits
      const fits = containingFrame ? isObjectInsideFrame(draggedFrame, containingFrame) : false;
      const newParentId = containingFrame && fits ? containingFrame.id : '';

      const frameUpdates: Partial<Frame> = { x: newX, y: newY, parentId: newParentId };

      // Prepare batch updates for frame and all children to avoid flickering
      const batchUpdates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = [
        { id: frameId, updates: frameUpdates },
      ];

      // Move all children with the frame
      if (frameDragStartRef.current) {
        const dx = newX - frameDragStartRef.current.x;
        const dy = newY - frameDragStartRef.current.y;

        const children = getChildrenOfFrame(frameId, objectsRef.current);
        for (const child of children) {
          batchUpdates.push({
            id: child.id,
            updates: {
              x: child.x + dx,
              y: child.y + dy,
            },
          });
        }

        // Move connectors that are attached to the frame or its children
        const frameAndChildrenIds = new Set([frameId, ...children.map(c => c.id)]);
        const connectors = objectsRef.current.filter(
          (o): o is Connector => o.type === 'connector' &&
            (frameAndChildrenIds.has(o.fromId) || frameAndChildrenIds.has(o.toId))
        );

        for (const connector of connectors) {
          batchUpdates.push({
            id: connector.id,
            updates: {
              x: connector.x + dx,
              y: connector.y + dy,
            },
          });
        }
      }

      // Push compound undo entry before clearing state
      const undoChanges: UndoChange[] = [];
      const now = Date.now();
      for (const { id, updates: upd } of batchUpdates) {
        const before = dragSnapshotRef.current.get(id);
        if (before) {
          const after = structuredClone({ ...before, ...upd, updatedAt: now }) as AnyBoardObject;
          undoChanges.push({ objectId: id, before: structuredClone(before), after });
        }
      }
      if (undoChanges.length > 0) maybePushUndo({ changes: undoChanges });

      // Clear frame drag state
      frameDragStartRef.current = null;
      connectorDragStartRef.current.clear();
      frameDragFirestoreRef.current = 0;
      setHoveredFrame(null);
      setDraggingObjectId(null);
      dragSnapshotRef.current.clear();

      // Set BEFORE the write so useLayoutEffect can catch the optimistic update
      pendingFrameClearRef.current = true;

      // Update all objects atomically to prevent flickering
      await batchUpdateObjects(boardId, batchUpdates, userId);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingFrameClearRef.current) {
        pendingFrameClearRef.current = false;
        setFrameDragOffset(null);
      }
    },
    [boardId, maybePushUndo]
  );

  const updateText = useCallback(
    (objectId: string, text: string) => {
      updateObject(boardId, objectId, { text } as Partial<StickyNote>, userId);
    },
    [boardId]
  );

  const updateTitle = useCallback(
    (objectId: string, title: string) => {
      updateObject(boardId, objectId, { title } as Partial<Frame>, userId);
    },
    [boardId]
  );

  const removeObject = useCallback(
    (objectId: string) => {
      const obj = objectsRef.current.find((o) => o.id === objectId);
      const changes: UndoChange[] = [];
      const deletedIds = new Set<string>([objectId]);

      // Capture the object itself for undo
      if (obj) {
        changes.push({ objectId, before: structuredClone(obj), after: null });
      }

      // If deleting a frame, cascade-delete all its children too
      if (obj?.type === 'frame') {
        const children = getChildrenOfFrame(objectId, objectsRef.current);
        for (const child of children) {
          deletedIds.add(child.id);
          changes.push({ objectId: child.id, before: structuredClone(child), after: null });
        }
      }

      // Auto-delete connectors that reference any deleted object
      const orphanedConnectors = objectsRef.current.filter(
        (o): o is Connector =>
          o.type === 'connector' &&
          !deletedIds.has(o.id) &&
          (deletedIds.has(o.fromId) || deletedIds.has(o.toId))
      );
      for (const connector of orphanedConnectors) {
        deletedIds.add(connector.id);
        changes.push({ objectId: connector.id, before: structuredClone(connector), after: null });
      }

      // Delete all objects
      for (const id of deletedIds) {
        deleteObject(boardId, id);
      }

      if (changes.length > 0) maybePushUndo({ changes });
    },
    [boardId, maybePushUndo]
  );

  /** Delete multiple objects as a single undo entry (used by handleDeleteSelected) */
  const batchRemoveObjects = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const changes: UndoChange[] = [];
      const deletedIds = new Set<string>(ids);

      for (const objectId of ids) {
        const obj = objectsRef.current.find((o) => o.id === objectId);
        if (!obj) continue;

        // Capture for undo
        if (!changes.some(c => c.objectId === objectId)) {
          changes.push({ objectId, before: structuredClone(obj), after: null });
        }

        // If frame, cascade-delete all its children too
        if (obj.type === 'frame') {
          const children = getChildrenOfFrame(objectId, objectsRef.current);
          for (const child of children) {
            if (!deletedIds.has(child.id)) {
              deletedIds.add(child.id);
              changes.push({ objectId: child.id, before: structuredClone(child), after: null });
            }
          }
        }
      }

      // Auto-delete orphaned connectors referencing any deleted object
      const orphanedConnectors = objectsRef.current.filter(
        (o): o is Connector =>
          o.type === 'connector' &&
          !deletedIds.has(o.id) &&
          (deletedIds.has(o.fromId) || deletedIds.has(o.toId))
      );
      for (const connector of orphanedConnectors) {
        deletedIds.add(connector.id);
        changes.push({ objectId: connector.id, before: structuredClone(connector), after: null });
      }

      // Delete all objects
      for (const id of deletedIds) {
        deleteObject(boardId, id);
      }

      if (changes.length > 0) maybePushUndo({ changes });
    },
    [boardId, maybePushUndo]
  );

  /** Delete a frame but leave its children in place (unparented) */
  const dissolveFrame = useCallback(
    (frameId: string) => {
      const frame = objectsRef.current.find((o) => o.id === frameId);
      const children = getChildrenOfFrame(frameId, objectsRef.current);
      const changes: UndoChange[] = [];

      // Capture frame for undo
      if (frame) {
        changes.push({ objectId: frameId, before: structuredClone(frame), after: null });
      }

      // Unparent children
      const updates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = children.map(
        (child) => ({ id: child.id, updates: { parentId: '' } })
      );
      if (updates.length > 0) {
        batchUpdateObjects(boardId, updates, userId);
      }
      for (const child of children) {
        changes.push({
          objectId: child.id,
          before: structuredClone(child),
          after: structuredClone({ ...child, parentId: '', updatedAt: Date.now() }),
        });
      }

      // Auto-delete connectors attached to the frame itself (not its children)
      const orphanedConnectors = objectsRef.current.filter(
        (o): o is Connector =>
          o.type === 'connector' && (o.fromId === frameId || o.toId === frameId)
      );
      for (const connector of orphanedConnectors) {
        changes.push({ objectId: connector.id, before: structuredClone(connector), after: null });
        deleteObject(boardId, connector.id);
      }
      deleteObject(boardId, frameId);

      if (changes.length > 0) maybePushUndo({ changes });
    },
    [boardId, maybePushUndo]
  );

  const toggleConnectMode = useCallback(() => {
    setConnectMode((prev) => {
      if (prev) {
        setConnectingFrom(null);
        setCursorPosition(null);
      }
      return !prev;
    });
  }, []);

  const updateCursorPosition = useCallback((x: number, y: number) => {
    if (connectMode && connectingFrom) {
      setCursorPosition({ x, y });
    }
  }, [connectMode, connectingFrom]);

  const handleObjectHover = useCallback((objectId: string | null) => {
    if (connectMode && connectingFrom && objectId !== connectingFrom) {
      setHoveredObjectId(objectId);
    }
  }, [connectMode, connectingFrom]);

  const handleObjectClickForConnect = useCallback(
    (objectId: string, connectorOpts?: {
      style?: 'straight' | 'curved';
      lineType?: string;
      startArrow?: boolean;
      endArrow?: boolean;
      strokeWidth?: number;
      color?: string;
    }) => {
      if (!connectMode) return;

      // Don't allow connecting to/from connectors
      const obj = objects.find((o) => o.id === objectId);
      if (obj?.type === 'connector') return;

      if (!connectingFrom) {
        setConnectingFrom(objectId);
      } else {
        if (objectId === connectingFrom) return; // Can't connect to self

        // Get highest updatedAt to ensure new object appears on top
        const maxUpdatedAt = Math.max(0, ...objectsRef.current.map(o => o.updatedAt));

        const connector: Connector = {
          id: crypto.randomUUID(),
          type: 'connector',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          createdBy: userId,
          lastModifiedBy: userId,
          updatedAt: maxUpdatedAt + 1,
          fromId: connectingFrom,
          toId: objectId,
          style: connectorOpts?.style ?? 'straight',
          lineType: connectorOpts?.lineType as Connector['lineType'],
          startArrow: connectorOpts?.startArrow,
          endArrow: connectorOpts?.endArrow,
          strokeWidth: connectorOpts?.strokeWidth,
          color: connectorOpts?.color,
        };
        addObject(boardId, connector);
        trackNewObject(connector.id);
        maybePushUndo({ changes: [{ objectId: connector.id, before: null, after: structuredClone(connector) }] });
        setConnectingFrom(null);
        setConnectMode(false);
      }
    },
    [connectMode, connectingFrom, objects, boardId, userId, trackNewObject, maybePushUndo]
  );

  const updateObjectProperties = useCallback(
    (objectId: string, updates: Partial<AnyBoardObject>) => {
      const before = objectsRef.current.find((o) => o.id === objectId);
      updateObject(boardId, objectId, updates, userId);
      if (before) {
        const after = structuredClone({ ...before, ...updates, updatedAt: Date.now() }) as AnyBoardObject;
        maybePushUndo({ changes: [{ objectId, before: structuredClone(before), after }] });
      }
    },
    [boardId, maybePushUndo]
  );

  const cancelConnecting = useCallback(() => {
    setConnectMode(false);
    setConnectingFrom(null);
    setCursorPosition(null);
  }, []);

  return {
    objects,
    addStickyNote,
    addShape,
    addFrame,
    addSticker,
    addGifSticker,
    addText,
    moveObject,
    resizeObject,
    rotateObject,
    updateText,
    updateTitle,
    removeObject,
    connectMode,
    connectingFrom,
    cursorPosition,
    hoveredObjectId,
    toggleConnectMode,
    handleObjectClickForConnect,
    handleObjectHover,
    updateCursorPosition,
    cancelConnecting,
    hoveredFrame,
    draggingObjectId,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    newObjectIds,
    handleFrameDragMove,
    handleFrameDragEnd,
    dissolveFrame,
    moveLineEndpoint,
    updateObjectProperties,
    finalizeResize,
    finalizeRotate,
    finalizeLineEndpoint,
    batchRemoveObjects,
  };
}
