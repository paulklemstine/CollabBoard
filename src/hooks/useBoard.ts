import { useState, useEffect, useCallback, useRef } from 'react';
import {
  addObject,
  updateObject,
  deleteObject,
  subscribeToBoard,
  type AnyBoardObject,
} from '../services/boardService';
import type { StickyNote, Shape, ShapeType, Frame, Sticker, Connector } from '../types/board';
import { findContainingFrame, getChildrenOfFrame } from '../utils/containment';

const STICKY_COLORS = ['#fef9c3', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#ffe4e6', '#fed7aa', '#e0e7ff'];

export function useBoard(boardId: string, userId: string) {
  const [objects, setObjects] = useState<AnyBoardObject[]>([]);
  const [connectMode, setConnectMode] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredFrameId, setHoveredFrameId] = useState<string | null>(null);
  const [frameDragOffset, setFrameDragOffset] = useState<{ frameId: string; dx: number; dy: number } | null>(null);
  const frameDragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keep a ref to objects so drag callbacks always see the latest state
  const objectsRef = useRef(objects);
  objectsRef.current = objects;

  useEffect(() => {
    const unsubscribe = subscribeToBoard(boardId, setObjects);
    return unsubscribe;
  }, [boardId]);

  const addStickyNote = useCallback(
    (x: number = 200, y: number = 200, color?: string) => {
      const note: StickyNote = {
        id: crypto.randomUUID(),
        type: 'sticky',
        x,
        y,
        width: 200,
        height: 200,
        rotation: 0,
        createdBy: userId,
        updatedAt: Date.now(),
        text: '',
        color: color ?? STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)],
      };
      addObject(boardId, note);
    },
    [boardId, userId]
  );

  const addShape = useCallback(
    (shapeType: ShapeType, color: string, x: number = 300, y: number = 300) => {
      const shape: Shape = {
        id: crypto.randomUUID(),
        type: 'shape',
        x,
        y,
        width: shapeType === 'line' ? 200 : 120,
        height: shapeType === 'line' ? 4 : 120,
        rotation: 0,
        createdBy: userId,
        updatedAt: Date.now(),
        shapeType,
        color,
      };
      addObject(boardId, shape);
    },
    [boardId, userId]
  );

  const addFrame = useCallback(
    (x: number = 100, y: number = 100) => {
      const frame: Frame = {
        id: crypto.randomUUID(),
        type: 'frame',
        x,
        y,
        width: 400,
        height: 300,
        rotation: 0,
        createdBy: userId,
        updatedAt: Date.now(),
        title: '',
      };
      addObject(boardId, frame);
    },
    [boardId, userId]
  );

  const addSticker = useCallback(
    (emoji: string, x: number = 250, y: number = 250) => {
      const sticker: Sticker = {
        id: crypto.randomUUID(),
        type: 'sticker',
        x,
        y,
        width: 56,
        height: 56,
        rotation: 0,
        createdBy: userId,
        updatedAt: Date.now(),
        emoji,
      };
      addObject(boardId, sticker);
    },
    [boardId, userId]
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
      const containingFrame = findContainingFrame(draggedObj, frames);
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
      const containingFrame = findContainingFrame(draggedObj, frames);
      const newParentId = containingFrame?.id ?? '';

      updateObject(boardId, objectId, { x, y, parentId: newParentId });
      setHoveredFrameId(null);
    },
    [boardId]
  );

  /** Called during frame drag — moves frame, tracks offset for children locally */
  const handleFrameDragMove = useCallback(
    (frameId: string, newX: number, newY: number) => {
      const frame = objectsRef.current.find((o) => o.id === frameId);
      if (!frame) return;

      // Record the original position on first move
      if (!frameDragStartRef.current) {
        frameDragStartRef.current = { x: frame.x, y: frame.y };
      }

      const dx = newX - frameDragStartRef.current.x;
      const dy = newY - frameDragStartRef.current.y;

      // Only write the frame's own position to Firestore
      updateObject(boardId, frameId, { x: newX, y: newY });

      // Track offset locally — children apply this visually without Firestore round-trip
      setFrameDragOffset({ frameId, dx, dy });
    },
    [boardId]
  );

  /** Called on frame drag end — persist final child positions, clear offset */
  const handleFrameDragEnd = useCallback(
    (frameId: string, newX: number, newY: number) => {
      updateObject(boardId, frameId, { x: newX, y: newY });

      if (frameDragStartRef.current) {
        const dx = newX - frameDragStartRef.current.x;
        const dy = newY - frameDragStartRef.current.y;

        const children = getChildrenOfFrame(frameId, objectsRef.current);
        for (const child of children) {
          updateObject(boardId, child.id, {
            x: child.x + dx,
            y: child.y + dy,
          });
        }
      }

      frameDragStartRef.current = null;
      setFrameDragOffset(null);
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

  const handleObjectClickForConnect = useCallback(
    (objectId: string) => {
      if (!connectMode) return;

      // Don't allow connecting to/from connectors
      const obj = objects.find((o) => o.id === objectId);
      if (obj?.type === 'connector') return;

      if (!connectingFrom) {
        setConnectingFrom(objectId);
      } else {
        if (objectId === connectingFrom) return; // Can't connect to self
        const connector: Connector = {
          id: crypto.randomUUID(),
          type: 'connector',
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          rotation: 0,
          createdBy: userId,
          updatedAt: Date.now(),
          fromId: connectingFrom,
          toId: objectId,
          style: 'straight',
        };
        addObject(boardId, connector);
        setConnectingFrom(null);
        setConnectMode(false);
      }
    },
    [connectMode, connectingFrom, objects, boardId, userId]
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
    moveObject,
    resizeObject,
    updateText,
    updateTitle,
    removeObject,
    connectMode,
    connectingFrom,
    cursorPosition,
    toggleConnectMode,
    handleObjectClickForConnect,
    updateCursorPosition,
    cancelConnecting,
    hoveredFrameId,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    handleFrameDragMove,
    handleFrameDragEnd,
  };
}
