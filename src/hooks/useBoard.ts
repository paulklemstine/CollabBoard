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
import { findContainingFrame, getChildrenOfFrame, scaleToFitFrame } from '../utils/containment';
import { screenToWorld } from '../utils/coordinates';
import type { StageTransform } from '../components/Board/Board';

const STICKY_COLORS = ['#fef9c3', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#ffe4e6', '#fed7aa', '#e0e7ff'];

export function useBoard(boardId: string, userId: string) {
  const [objects, setObjects] = useState<AnyBoardObject[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null);
  const [newObjectIds, setNewObjectIds] = useState<Set<string>>(new Set());
  const [frameDragOffset, setFrameDragOffset] = useState<{ frameId: string; dx: number; dy: number } | null>(null);
  const pendingFrameClearRef = useRef(false);
  const frameDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const connectorDragStartRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Keep a ref to objects so drag callbacks always see the latest state
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

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
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        text: '',
        color: color ?? STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
        ...(textColor ? { textColor } : {}),
        ...(borderColor && borderColor !== 'transparent' ? { borderColor } : {}),
      };
      addObject(boardId, note);
      trackNewObject(note.id);
    },
    [boardId, userId, trackNewObject]
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
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        shapeType,
        color,
        ...(strokeColor && strokeColor !== 'transparent' ? { strokeColor } : {}),
        ...(borderColor && borderColor !== 'transparent' ? { borderColor } : {}),
      };
      addObject(boardId, shape);
      trackNewObject(shape.id);
    },
    [boardId, userId, trackNewObject]
  );

  const addFrame = useCallback(
    (transform: StageTransform, x?: number, y?: number) => {
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
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        title: '',
      };
      addObject(boardId, frame);
      trackNewObject(frame.id);
    },
    [boardId, userId, trackNewObject]
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
        updatedAt: maxUpdatedAt + 1, // Ensure it's on top
        emoji,
      };
      addObject(boardId, sticker);
      trackNewObject(sticker.id);
    },
    [boardId, userId, trackNewObject]
  );

  const addText = useCallback(
    (
      transform: StageTransform,
      fontSize?: number,
      fontWeight?: 'normal' | 'bold',
      fontStyle?: 'normal' | 'italic',
      textAlign?: 'left' | 'center' | 'right',
      textColor?: string,
      x?: number,
      y?: number,
    ) => {
      const textWidth = 300;
      const textHeight = 50;
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
        updatedAt: maxUpdatedAt + 1,
        text: '',
        fontSize: fontSize ?? 24,
        fontFamily: "'Inter', sans-serif",
        fontWeight: fontWeight ?? 'normal',
        fontStyle: fontStyle ?? 'normal',
        textAlign: textAlign ?? 'left',
        color: textColor ?? '#1e293b',
      };
      addObject(boardId, textObj);
      trackNewObject(textObj.id);
    },
    [boardId, userId, trackNewObject]
  );

  const moveObject = useCallback(
    (objectId: string, x: number, y: number) => {
      updateObject(boardId, objectId, { x, y });
    },
    [boardId]
  );

  const resizeObject = useCallback(
    (objectId: string, width: number, height: number) => {
      updateObject(boardId, objectId, { width, height });
    },
    [boardId]
  );

  const rotateObject = useCallback(
    (objectId: string, rotation: number) => {
      updateObject(boardId, objectId, { rotation });
    },
    [boardId]
  );

  const moveLineEndpoint = useCallback(
    (objectId: string, x: number, y: number, width: number, rotation: number) => {
      updateObject(boardId, objectId, { x, y, width, rotation });
    },
    [boardId]
  );

  /** Called during drag of non-frame objects — updates position + detects hover over frames */
  const handleDragMove = useCallback(
    (objectId: string, x: number, y: number) => {
      updateObject(boardId, objectId, { x, y });

      const obj = objectsRef.current.find((o) => o.id === objectId);
      if (!obj) return;

      const draggedObj = { ...obj, x, y };
      const frames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame'
      );
      const containingFrame = findContainingFrame(draggedObj, frames, objectsRef.current);
      setHoveredFrameId(containingFrame?.id ?? null);
    },
    [boardId]
  );

  /** Called on drag end — persists position + sets/clears parentId based on containment */
  const handleDragEnd = useCallback(
    (objectId: string, x: number, y: number) => {
      const obj = objectsRef.current.find((o) => o.id === objectId);
      if (!obj) {
        updateObject(boardId, objectId, { x, y });
        setHoveredFrameId(null);
        return;
      }

      const draggedObj = { ...obj, x, y };
      const frames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame'
      );
      const containingFrame = findContainingFrame(draggedObj, frames, objectsRef.current);
      const newParentId = containingFrame?.id ?? '';

      // Scale down the object if it doesn't fit in the frame
      const updates: Partial<typeof obj> = { x, y, parentId: newParentId };
      if (containingFrame) {
        const scaled = scaleToFitFrame(draggedObj, containingFrame);
        if (scaled) {
          updates.x = scaled.x;
          updates.y = scaled.y;
          updates.width = scaled.width;
          updates.height = scaled.height;
        }
      }

      updateObject(boardId, objectId, updates);
      setHoveredFrameId(null);
    },
    [boardId]
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
      }

      const dx = newX - frameDragStartRef.current.x;
      const dy = newY - frameDragStartRef.current.y;

      // Prepare batch updates for frame and connectors
      const batchUpdates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = [
        { id: frameId, updates: { x: newX, y: newY } },
      ];

      // Move connectors that are attached to the frame or its children
      const children = getChildrenOfFrame(frameId, objectsRef.current);
      const frameAndChildrenIds = new Set([frameId, ...children.map(c => c.id)]);
      const connectors = objectsRef.current.filter(
        (o): o is Connector => o.type === 'connector' &&
          (frameAndChildrenIds.has(o.fromId) || frameAndChildrenIds.has(o.toId))
      );

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

      // Update frame and connectors
      batchUpdateObjects(boardId, batchUpdates);

      // Track offset locally — children apply this visually without Firestore round-trip
      setFrameDragOffset({ frameId, dx, dy });

      // Detect hover over other frames for frame-in-frame nesting
      const draggedFrame = { ...frame, x: newX, y: newY };
      const otherFrames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame' && o.id !== frameId
      );
      const containingFrame = findContainingFrame(draggedFrame, otherFrames, objectsRef.current);
      setHoveredFrameId(containingFrame?.id ?? null);
    },
    [boardId]
  );

  /** Called on frame drag end — persist final child positions, set parentId, clear offset */
  const handleFrameDragEnd = useCallback(
    async (frameId: string, newX: number, newY: number) => {
      const frame = objectsRef.current.find((o) => o.id === frameId);
      if (!frame || frame.type !== 'frame') {
        updateObject(boardId, frameId, { x: newX, y: newY });
        frameDragStartRef.current = null;
        connectorDragStartRef.current.clear();
        setHoveredFrameId(null);
        pendingFrameClearRef.current = true;
        return;
      }

      // Detect containment for frame-in-frame nesting
      const draggedFrame = { ...frame, x: newX, y: newY };
      const otherFrames = objectsRef.current.filter(
        (o): o is Frame => o.type === 'frame' && o.id !== frameId
      );
      const containingFrame = findContainingFrame(draggedFrame, otherFrames, objectsRef.current);
      const newParentId = containingFrame?.id ?? '';

      // Scale down the frame if it doesn't fit in the containing frame
      const frameUpdates: Partial<Frame> = { x: newX, y: newY, parentId: newParentId };
      let finalFrameX = newX;
      let finalFrameY = newY;

      if (containingFrame) {
        const scaled = scaleToFitFrame(draggedFrame, containingFrame);
        if (scaled) {
          frameUpdates.x = scaled.x;
          frameUpdates.y = scaled.y;
          frameUpdates.width = scaled.width;
          frameUpdates.height = scaled.height;
          finalFrameX = scaled.x;
          finalFrameY = scaled.y;
        }
      }

      // Prepare batch updates for frame and all children to avoid flickering
      const batchUpdates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = [
        { id: frameId, updates: frameUpdates },
      ];

      // Move all children with the frame (using final position after scaling)
      if (frameDragStartRef.current) {
        const dx = finalFrameX - frameDragStartRef.current.x;
        const dy = finalFrameY - frameDragStartRef.current.y;

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

      // Clear frame drag state
      frameDragStartRef.current = null;
      connectorDragStartRef.current.clear();
      setHoveredFrameId(null);

      // Set BEFORE the write so useLayoutEffect can catch the optimistic update
      pendingFrameClearRef.current = true;

      // Update all objects atomically to prevent flickering
      await batchUpdateObjects(boardId, batchUpdates);

      // Safety: if objects didn't change (no-op), clear manually
      if (pendingFrameClearRef.current) {
        pendingFrameClearRef.current = false;
        setFrameDragOffset(null);
      }
    },
    [boardId]
  );

  const updateText = useCallback(
    (objectId: string, text: string) => {
      updateObject(boardId, objectId, { text } as Partial<StickyNote>);
    },
    [boardId]
  );

  const updateTitle = useCallback(
    (objectId: string, title: string) => {
      updateObject(boardId, objectId, { title } as Partial<Frame>);
    },
    [boardId]
  );

  const removeObject = useCallback(
    (objectId: string) => {
      const obj = objects.find((o) => o.id === objectId);

      // If deleting a frame, unparent all its children first
      if (obj?.type === 'frame') {
        const children = getChildrenOfFrame(objectId, objects);
        for (const child of children) {
          updateObject(boardId, child.id, { parentId: '' });
        }
      }

      // Auto-delete connectors that reference the removed object
      const orphanedConnectors = objects.filter(
        (o): o is Connector =>
          o.type === 'connector' && (o.fromId === objectId || o.toId === objectId)
      );
      for (const connector of orphanedConnectors) {
        deleteObject(boardId, connector.id);
      }
      deleteObject(boardId, objectId);
    },
    [boardId, objects]
  );

  /** Delete a frame but leave its children in place (unparented) */
  const dissolveFrame = useCallback(
    (frameId: string) => {
      const children = getChildrenOfFrame(frameId, objects);
      const updates: Array<{ id: string; updates: Partial<AnyBoardObject> }> = children.map(
        (child) => ({ id: child.id, updates: { parentId: '' } })
      );
      if (updates.length > 0) {
        batchUpdateObjects(boardId, updates);
      }

      // Auto-delete connectors attached to the frame itself (not its children)
      const orphanedConnectors = objects.filter(
        (o): o is Connector =>
          o.type === 'connector' && (o.fromId === frameId || o.toId === frameId)
      );
      for (const connector of orphanedConnectors) {
        deleteObject(boardId, connector.id);
      }
      deleteObject(boardId, frameId);
    },
    [boardId, objects]
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
        setConnectingFrom(null);
        setConnectMode(false);
      }
    },
    [connectMode, connectingFrom, objects, boardId, userId, trackNewObject]
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
    hoveredFrameId,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    newObjectIds,
    handleFrameDragMove,
    handleFrameDragEnd,
    dissolveFrame,
    moveLineEndpoint,
  };
}
