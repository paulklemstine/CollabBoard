import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { rtdb, storage } from './services/firebase';
import { signOutUser } from './services/authService';
import { subscribeToBoardMetadata, updateBoardMetadata } from './services/boardMetadataService';
import { addVisitedBoard } from './services/userBoardsService';
import { setPreviewBlob } from './services/previewCache';
import { useAuth } from './hooks/useAuth';
import { useRouter } from './hooks/useRouter';
import { useCursors } from './hooks/useCursors';
import { usePresence, pickColor } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useMultiSelect } from './hooks/useMultiSelect';
import { AuthPanel } from './components/Auth/AuthPanel';
import { BoardDashboard } from './components/Dashboard/BoardDashboard';
import { Board, type StageTransform } from './components/Board/Board';
import { StickyNoteComponent } from './components/Board/StickyNote';
import { ShapeComponent } from './components/Board/ShapeComponent';
import { FrameComponent } from './components/Board/FrameComponent';
import { ConnectorComponent } from './components/Board/ConnectorComponent';
import { StickerComponent } from './components/Board/StickerComponent';
import { WebcamDock } from './components/Webcam/WebcamDock';
import { TextComponent } from './components/Board/TextComponent';
import { PreviewConnector } from './components/Board/PreviewConnector';
import { SelectionOverlay } from './components/Board/SelectionOverlay';
import { AILabelOverlay } from './components/Board/AILabelOverlay';
import { CursorsOverlay } from './components/Cursors/CursorsOverlay';
import { PresencePanel } from './components/Presence/PresencePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { AIChat } from './components/AIChat/AIChat';
import { Minimap } from './components/Minimap/Minimap';
import { useChat } from './hooks/useChat';
import { useWebcam } from './hooks/useWebcam';
import { usePresenceToasts } from './hooks/usePresenceToasts';
import { PresenceToastContainer } from './components/Effects/PresenceToast';
import { ConfettiBurst } from './components/Effects/ConfettiBurst';
import type { StickyNote, Shape, Frame, Sticker, Connector, TextObject, BoardMetadata } from './types/board';
import { calculateGroupObjectTransform } from './utils/groupTransform';
import { batchAddObjects, type AnyBoardObject } from './services/boardService';
import { duplicateObjects } from './utils/duplicate';
import { ResetPage } from './components/ResetPage';
import { HelpPanel } from './components/Help/HelpPanel';
import { TutorialOverlay } from './components/Help/TutorialOverlay';
import { useTutorial } from './hooks/useTutorial';

function App() {
  const { user, loading, refreshUser } = useAuth();
  const { route, navigateTo } = useRouter();

  const handleSignOut = useCallback(async (boardId?: string) => {
    if (boardId) {
      const presenceRef = ref(rtdb, `boards/${boardId}/presence/${user?.uid}`);
      const cursorRef = ref(rtdb, `boards/${boardId}/cursors/${user?.uid}`);
      await Promise.all([set(presenceRef, null), remove(cursorRef)]);
    }
    await signOutUser();
    navigateTo({ page: 'dashboard' });
  }, [user?.uid, navigateTo]);

  // Secret factory reset route — no auth required
  if (route.page === 'resetPMK') {
    return <ResetPage />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-animate">
        <div className="flex flex-col items-center gap-4 animate-bounce-in">
          <div
            className="w-14 h-14 rounded-full border-4 border-white/30 border-t-white animate-spin-loader"
          />
          <span className="text-white/90 font-semibold text-sm tracking-wide">
            Warming up...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-animate">
        <AuthPanel user={null} onAuthChange={refreshUser} />
      </div>
    );
  }

  if (route.page === 'board') {
    return (
      <BoardView
        user={user}
        boardId={route.boardId}
        onNavigateBack={() => navigateTo({ page: 'dashboard' })}
        onSignOut={() => handleSignOut(route.boardId)}
      />
    );
  }

  return (
    <BoardDashboard
      user={user}
      onSelectBoard={(boardId) => navigateTo({ page: 'board', boardId })}
      onSignOut={() => handleSignOut()}
    />
  );
}

function BoardView({
  user,
  boardId,
  onNavigateBack,
  onSignOut: _onSignOut,
}: {
  user: { uid: string; displayName: string | null; email: string | null };
  boardId: string;
  onNavigateBack: () => void;
  onSignOut: () => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
}) {
  const [boardMetadata, setBoardMetadata] = useState<BoardMetadata | null>(null);
  const [copied, setCopied] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);

  // Track visit so private boards persist in user's "My Boards"
  useEffect(() => {
    addVisitedBoard(user.uid, boardId).catch(() => {});
  }, [user.uid, boardId]);

  // Subscribe to board metadata for display + deletion detection
  const onNavigateBackRef = useRef(onNavigateBack);
  onNavigateBackRef.current = onNavigateBack;

  useEffect(() => {
    let isFirst = true;
    const unsubscribe = subscribeToBoardMetadata(boardId, (board) => {
      setBoardMetadata(board);
      if (isFirst) {
        isFirst = false;
        if (!board) {
          onNavigateBackRef.current();
        }
        return;
      }
      if (!board) {
        onNavigateBackRef.current();
      }
    });
    return unsubscribe;
  }, [boardId]);

  const userColor = pickColor(user.uid);
  const { cursors, updateCursor } = useCursors(
    boardId,
    user.uid,
    user.displayName ?? 'Anonymous',
    userColor,
  );
  const { onlineUsers } = usePresence(
    boardId,
    user.uid,
    user.displayName ?? 'Anonymous',
    user.email ?? '',
  );
  const { toasts: presenceToasts } = usePresenceToasts(onlineUsers);
  const latestObjectsRef = useRef<AnyBoardObject[]>([]);
  const { pushUndo, undo, redo, canUndo, canRedo, isUndoRedoingRef } = useUndoRedo(boardId, user.uid, latestObjectsRef);
  const {
    objects,
    addStickyNote,
    addShape,
    addFrame,
    addSticker,
    addGifSticker,
    addText,
    moveObject: _moveObject,
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
    hoveredFrame,
    draggingObjectId,
    newObjectIds,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    handleFrameDragMove,
    handleFrameDragEnd,
    dissolveFrame,
    moveLineEndpoint,
    updateObjectProperties,
    finalizeResize,
    finalizeRotate,
    finalizeLineEndpoint,
    batchRemoveObjects,
  } = useBoard(boardId, user.uid, pushUndo, isUndoRedoingRef);

  // Keep a ref to objects so undo and AI callbacks always see latest state
  latestObjectsRef.current = objects;

  // When AI creates objects, push an undo entry once they appear in state
  const handleAIObjectsCreated = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setShowConfetti(true);
    const idSet = new Set(ids);
    let attempts = 0;
    const poll = () => {
      const found = latestObjectsRef.current.filter(o => idSet.has(o.id));
      if (found.length === ids.length || attempts >= 20) {
        if (found.length > 0) {
          pushUndo({
            changes: found.map(obj => ({
              objectId: obj.id,
              before: null,
              after: structuredClone(obj),
            })),
          });
        }
        return;
      }
      attempts++;
      setTimeout(poll, 250);
    };
    // Small delay to allow Firestore listener to deliver the objects
    setTimeout(poll, 500);
  }, [pushUndo]);

  const handleContainerRef = useCallback((el: HTMLDivElement | null) => {
    stageContainerRef.current = el;
  }, []);

  const [aiOpen, setAiOpen] = useState(false);
  const toggleAI = useCallback(() => setAiOpen((prev) => !prev), []);
  const [connectorStyle, setConnectorStyle] = useState<import('./types/board').ConnectorStyle>({
    lineType: 'solid',
    startArrow: false,
    endArrow: true,
    strokeWidth: 3,
    color: '#818cf8',
  });
  const [curveStyle, setCurveStyle] = useState<'straight' | 'curved'>('straight');

  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat(
    boardId,
    user.uid,
    user.displayName ?? 'Anonymous',
    userColor,
  );

  const {
    localStream,
    remoteStreams,
    isStreaming: isWebcamStreaming,
    activePeers,
    startStreaming,
    stopStreaming,
  } = useWebcam(boardId, user.uid);

  const {
    selectedIds,
    marquee,
    groupDragOffset,
    selectionBox,
    selectionHidden,
    transformPreview,
    clearSelection,
    isSelected: isObjectSelected,
    groupHoveredFrame,
    handleStageMouseDown,
    handleStageMouseMove,
    handleStageMouseUp,
    handleGroupDragMove,
    handleGroupDragEnd,
    handleGroupResizeMove,
    handleGroupResize,
    handleGroupRotateMove,
    handleGroupRotate,
    selectObject,
    selectMultiple,
  } = useMultiSelect(objects, boardId, pushUndo, user.uid);

  // Compute the single selected object (null when 0 or 2+ selected)
  const selectedObject = useMemo<AnyBoardObject | null>(() => {
    if (selectedIds.size !== 1) return null;
    const id = selectedIds.values().next().value;
    return objects.find((o) => o.id === id) ?? null;
  }, [selectedIds, objects]);

  const handleUpdateSelectedObject = useCallback(
    (updates: Partial<AnyBoardObject>) => {
      if (selectedObject) {
        updateObjectProperties(selectedObject.id, updates);
      }
    },
    [selectedObject, updateObjectProperties]
  );

  // Sync connector/curve style state when a connector is selected
  useEffect(() => {
    if (selectedObject?.type === 'connector') {
      const conn = selectedObject as Connector;
      setConnectorStyle({
        lineType: conn.lineType ?? 'solid',
        startArrow: conn.startArrow ?? false,
        endArrow: conn.endArrow ?? true,
        strokeWidth: conn.strokeWidth ?? 3,
        color: conn.color ?? '#818cf8',
      });
      setCurveStyle(conn.style ?? 'straight');
    }
  }, [selectedObject]);

  // Wrap setConnectorStyle to also write to selected connector
  const handleConnectorStyleChange = useCallback(
    (style: import('./types/board').ConnectorStyle) => {
      setConnectorStyle(style);
      if (selectedObject?.type === 'connector') {
        updateObjectProperties(selectedObject.id, {
          lineType: style.lineType,
          startArrow: style.startArrow,
          endArrow: style.endArrow,
          strokeWidth: style.strokeWidth,
          color: style.color,
        } as Partial<Connector>);
      }
    },
    [selectedObject, updateObjectProperties]
  );

  // Wrap setCurveStyle to also write to selected connector
  const handleCurveStyleChange = useCallback(
    (style: 'straight' | 'curved') => {
      setCurveStyle(style);
      if (selectedObject?.type === 'connector') {
        updateObjectProperties(selectedObject.id, { style } as Partial<Connector>);
      }
    },
    [selectedObject, updateObjectProperties]
  );

  const handleDeleteSelected = useCallback(() => {
    batchRemoveObjects([...selectedIds]);
    clearSelection();
  }, [selectedIds, batchRemoveObjects, clearSelection]);

  // Clipboard for copy/paste (in-memory, not system clipboard)
  const clipboardRef = useRef<AnyBoardObject[]>([]);

  const handleDuplicateSelected = useCallback(
    async (offset: { dx: number; dy: number }) => {
      if (selectedIds.size === 0) return;
      const selected = objects.filter((o) => selectedIds.has(o.id));
      if (selected.length === 0) return;
      const { clones, idRemap } = duplicateObjects(selected, objects, user.uid, offset);
      if (clones.length === 0) return;
      await batchAddObjects(boardId, clones);
      pushUndo({ changes: clones.map(c => ({ objectId: c.id, before: null, after: structuredClone(c) })) });
      const newIds = new Set<string>();
      for (const [, newId] of idRemap) {
        if (clones.some((c) => c.id === newId)) newIds.add(newId);
      }
      selectMultiple(newIds);
    },
    [selectedIds, objects, user.uid, boardId, selectMultiple, pushUndo]
  );

  const handleCopy = useCallback(() => {
    if (selectedIds.size === 0) return;
    clipboardRef.current = structuredClone(objects.filter((o) => selectedIds.has(o.id)));
  }, [selectedIds, objects]);

  const handlePaste = useCallback(async () => {
    if (clipboardRef.current.length === 0) return;
    const { clones, idRemap } = duplicateObjects(clipboardRef.current, objects, user.uid, { dx: 40, dy: 40 });
    if (clones.length === 0) return;
    await batchAddObjects(boardId, clones);
    pushUndo({ changes: clones.map(c => ({ objectId: c.id, before: null, after: structuredClone(c) })) });
    const newIds = new Set<string>();
    for (const [, newId] of idRemap) {
      if (clones.some((c) => c.id === newId)) newIds.add(newId);
    }
    selectMultiple(newIds);
    // Update clipboard to clones so repeated paste cascades diagonally
    clipboardRef.current = structuredClone(clones);
  }, [objects, user.uid, boardId, selectMultiple, pushUndo]);

  const handleDuplicateObject = useCallback(
    async (id: string) => {
      const obj = objects.find((o) => o.id === id);
      if (!obj) return;
      const { clones } = duplicateObjects([obj], objects, user.uid, { dx: 20, dy: 20 });
      if (clones.length === 0) return;
      await batchAddObjects(boardId, clones);
      pushUndo({ changes: clones.map(c => ({ objectId: c.id, before: null, after: structuredClone(c) })) });
      selectMultiple(new Set(clones.map((c) => c.id)));
    },
    [objects, user.uid, boardId, selectMultiple, pushUndo]
  );

  // Keyboard shortcuts: Escape, Delete, Ctrl+C/V/D/Z, L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable;

      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        if (isInput) return;
        e.preventDefault();
        handleDeleteSelected();
      }
      // Ctrl/Cmd+Z — undo (without shift)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        undo();
      }
      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y — redo
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y'))
      ) {
        if (isInput) return;
        e.preventDefault();
        redo();
      }
      // Ctrl/Cmd+D — duplicate selected
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (isInput) return;
        e.preventDefault();
        if (selectedIds.size > 0) handleDuplicateSelected({ dx: 20, dy: 20 });
      }
      // Ctrl/Cmd+C — copy selected
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !e.shiftKey) {
        if (isInput) return;
        if (selectedIds.size > 0) handleCopy();
      }
      // Ctrl/Cmd+V — paste from clipboard
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !e.shiftKey) {
        if (isInput) return;
        handlePaste();
      }
      if (e.key === 'l' || e.key === 'L') {
        if (isInput) return;
        setShowAILabels((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size, clearSelection, handleDeleteSelected, handleDuplicateSelected, handleCopy, handlePaste, undo, redo]);

  const [stageTransform, setStageTransform] = useState<StageTransform>({ x: 0, y: 0, scale: 1 });

  // Help & Tutorial
  const [helpOpen, setHelpOpen] = useState(false);
  const tutorial = useTutorial(boardId, user.uid, stageTransform, {
    selectObject,
    selectMultiple,
    clearSelection,
  });

  const MAX_WEBCAMS_PER_BOARD = 5;
  const handleToggleWebcam = useCallback(async () => {
    if (isWebcamStreaming) {
      stopStreaming();
    } else {
      if (activePeers.length >= MAX_WEBCAMS_PER_BOARD) return;
      await startStreaming(user.displayName ?? 'Anonymous');
    }
  }, [isWebcamStreaming, stopStreaming, startStreaming, activePeers.length, user.displayName]);

  const [showAILabels, setShowAILabels] = useState(false);
  const [zoomControls, setZoomControls] = useState<{
    scale: number;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    setTransform: (transform: StageTransform) => void;
  } | null>(null);

  // Capture board preview: zoom-to-fit, screenshot to blob (fast, DOM-dependent)
  const capturePreviewBlob = useCallback(async (): Promise<Blob | null> => {
    const el = stageContainerRef.current;
    if (!el || !zoomControls) { console.warn('[preview] no container or zoomControls'); return null; }
    try {
      const sourceCanvas = el.querySelector('canvas');
      if (!sourceCanvas) { console.warn('[preview] no canvas found'); return null; }

      // Compute bounding box of all visible objects
      const visible = objects.filter(o => o.type !== 'connector');
      if (visible.length === 0) { console.warn('[preview] no visible objects'); return null; }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const obj of visible) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
        maxX = Math.max(maxX, obj.x + obj.width);
        maxY = Math.max(maxY, obj.y + obj.height);
      }
      const bboxW = maxX - minX || 1;
      const bboxH = maxY - minY || 1;
      const padFactor = 1.2; // 10% padding each side
      const fitScaleX = sourceCanvas.width / (bboxW * padFactor);
      const fitScaleY = sourceCanvas.height / (bboxH * padFactor);
      const fitScale = Math.min(fitScaleX, fitScaleY);
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;

      // Temporarily zoom-to-fit all objects
      const savedTransform = { ...stageTransform };
      zoomControls.setTransform({
        x: sourceCanvas.width / 2 - centerX * fitScale,
        y: sourceCanvas.height / 2 - centerY * fitScale,
        scale: fitScale,
      });

      // Wait for stage redraw + GIF overlay position sync
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

      // Capture to offscreen canvas
      const WIDTH = 600;
      const HEIGHT = 600;
      const offscreen = document.createElement('canvas');
      offscreen.width = WIDTH;
      offscreen.height = HEIGHT;
      const ctx = offscreen.getContext('2d');
      if (!ctx) { zoomControls.setTransform(savedTransform); return null; }

      ctx.fillStyle = '#f8f7f6';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.drawImage(sourceCanvas, 0, 0, WIDTH, HEIGHT);

      // Composite GIF overlay <img> elements (marked crossOrigin=anonymous)
      const sx = WIDTH / sourceCanvas.width;
      const sy = HEIGHT / sourceCanvas.height;
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        const match = img.style.transform.match(/matrix\(([^)]+)\)/);
        if (!match) continue;
        const [a, b, c, d, e, f] = match[1].split(',').map(Number);
        const w = parseFloat(img.style.width) || img.naturalWidth;
        const h = parseFloat(img.style.height) || img.naturalHeight;
        ctx.save();
        ctx.setTransform(a * sx, b * sy, c * sx, d * sy, e * sx, f * sy);
        try { ctx.drawImage(img, 0, 0, w, h); } catch { /* skip cross-origin */ }
        ctx.restore();
      }

      zoomControls.setTransform(savedTransform);

      return await new Promise<Blob | null>(resolve =>
        offscreen.toBlob(resolve, 'image/jpeg', 0.7)
      );
    } catch (err) {
      console.error('[preview] capture failed:', err);
      return null;
    }
  }, [objects, stageTransform, zoomControls]);

  // Upload preview blob to Storage (slow, runs in background after navigation)
  const uploadPreview = useCallback((blob: Blob) => {
    console.log('[preview] uploading', blob.size, 'bytes');
    const sRef = storageRef(storage, `boards/${boardId}/preview.jpg`);
    uploadBytes(sRef, blob, { contentType: 'image/jpeg' })
      .then((snapshot) => getDownloadURL(snapshot.ref))
      .then((url) => {
        console.log('[preview] uploaded, updating metadata with URL');
        return updateBoardMetadata(boardId, { thumbnailUrl: url });
      })
      .then(() => console.log('[preview] metadata updated'))
      .catch((err) => console.error('[preview] upload failed:', err));
  }, [boardId]);

  // Capture preview on board exit — fade overlay hides zoom-to-fit flicker
  const [isCapturing, setIsCapturing] = useState(false);
  const handleNavigateBack = useCallback(async () => {
    setIsCapturing(true);
    // Wait for fade overlay to become opaque
    await new Promise(r => setTimeout(r, 200));
    const blob = await capturePreviewBlob();
    console.log('[preview] blob result:', blob ? `${blob.size} bytes` : 'null');
    if (blob) {
      setPreviewBlob(boardId, blob);
      uploadPreview(blob);
    }
    onNavigateBack();
  }, [capturePreviewBlob, uploadPreview, onNavigateBack, boardId]);

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      updateCursor(x, y, stageTransform);
      updateCursorPosition(x, y);
    },
    [updateCursor, updateCursorPosition, stageTransform]
  );

  const handleFollowUser = useCallback(
    (userId: string) => {
      const cursor = cursors.find((c) => c.userId === userId);
      if (cursor && zoomControls && cursor.viewportX != null && cursor.viewportY != null && cursor.viewportScale != null) {
        zoomControls.setTransform({
          x: cursor.viewportX,
          y: cursor.viewportY,
          scale: cursor.viewportScale,
        });
      }
    },
    [cursors, zoomControls]
  );

  const handleMinimapPanTo = useCallback(
    (worldX: number, worldY: number) => {
      if (!zoomControls) return;
      zoomControls.setTransform({
        x: -worldX * stageTransform.scale + window.innerWidth / 2,
        y: -worldY * stageTransform.scale + window.innerHeight / 2,
        scale: stageTransform.scale,
      });
    },
    [zoomControls, stageTransform.scale]
  );

  // Note: cursor position during drag is handled by Board's onMouseMove,
  // which correctly uses the pointer position (not the object position).

  const stickyNotes = objects.filter((o): o is StickyNote => o.type === 'sticky')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const shapes = objects.filter((o): o is Shape => o.type === 'shape')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const frames = objects.filter((o): o is Frame => o.type === 'frame')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const connectors = objects.filter((o): o is Connector => o.type === 'connector')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const stickers = objects.filter((o): o is Sticker => o.type === 'sticker')
    .sort((a, b) => a.updatedAt - b.updatedAt);
  const textObjects = objects.filter((o): o is TextObject => o.type === 'text')
    .sort((a, b) => a.updatedAt - b.updatedAt);

  // Build a map of frames for child transform lookups
  const frameMap = new Map<string, Frame>();
  for (const frame of frames) {
    frameMap.set(frame.id, frame);
  }

  /** Compute drag tint for an object: 'accept' (green), 'reject' (red), or 'none' */
  function getDragTint(objectId: string): 'accept' | 'reject' | 'none' {
    // Single-item drag
    if (hoveredFrame && draggingObjectId === objectId) {
      return hoveredFrame.fits ? 'accept' : 'reject';
    }
    // Multi-select group drag
    if (groupHoveredFrame && isObjectSelected(objectId) && selectedIds.size > 0) {
      return groupHoveredFrame.fits ? 'accept' : 'reject';
    }
    return 'none';
  }

  /** Compute the combined offset for a child: drag offset + rotation orbit around parent frame center */
  function getChildOffset(child: { x: number; y: number; width: number; height: number; parentId?: string }): { x: number; y: number } | undefined {
    const parentFrame = child.parentId ? frameMap.get(child.parentId) : null;
    if (!parentFrame) return frameDragOffset && child.parentId === frameDragOffset.frameId ? { x: frameDragOffset.dx, y: frameDragOffset.dy } : undefined;

    let offsetX = 0;
    let offsetY = 0;

    // Drag offset during live frame drag
    if (frameDragOffset && child.parentId === frameDragOffset.frameId) {
      offsetX += frameDragOffset.dx;
      offsetY += frameDragOffset.dy;
    }

    // Rotation orbit: rotate child center around parent frame center
    const frameRotation = parentFrame.rotation || 0;
    if (frameRotation !== 0) {
      const fcx = parentFrame.x + parentFrame.width / 2;
      const fcy = parentFrame.y + parentFrame.height / 2;
      const ccx = child.x + child.width / 2;
      const ccy = child.y + child.height / 2;
      const dx = ccx - fcx;
      const dy = ccy - fcy;
      const rad = frameRotation * (Math.PI / 180);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      offsetX += (dx * cos - dy * sin) - dx;
      offsetY += (dx * sin + dy * cos) - dy;
    }

    if (offsetX === 0 && offsetY === 0) return undefined;
    return { x: offsetX, y: offsetY };
  }

  function getParentRotation(parentId?: string): number | undefined {
    if (!parentId) return undefined;
    const f = frameMap.get(parentId);
    return f ? (f.rotation || 0) : undefined;
  }

  // Compute visual objects with live offsets applied for connector rendering.
  // This ensures connectors track objects in real-time during group drag/resize/rotate
  // and frame drag, instead of snapping on mouseup.
  const visualObjects = useMemo((): AnyBoardObject[] => {
    const needsAdjustment =
      (groupDragOffset && selectedIds.size > 0) ||
      (transformPreview && selectedIds.size > 0) ||
      frameDragOffset;

    if (!needsAdjustment) return objects;

    return objects.map((obj) => {
      if (obj.type === 'connector') return obj;

      // Group drag/transform for selected objects
      if (selectedIds.size > 1 && selectedIds.has(obj.id)) {
        let x = obj.x;
        let y = obj.y;
        let width = obj.width;
        let height = obj.height;
        let rotation = obj.rotation;

        // Apply group drag offset
        if (groupDragOffset) {
          x += groupDragOffset.dx;
          y += groupDragOffset.dy;
        }

        // Apply group transform preview (resize/rotate)
        if (transformPreview && selectionBox) {
          const transform = calculateGroupObjectTransform(obj, selectionBox, transformPreview);
          x += transform.orbitOffset.x;
          y += transform.orbitOffset.y;
          width *= transform.scaleX;
          height *= transform.scaleY;
          rotation += transform.rotationDelta;
        }

        return { ...obj, x, y, width, height, rotation };
      }

      // Frame drag offset for the dragged frame itself AND its children
      if (frameDragOffset && (obj.id === frameDragOffset.frameId || obj.parentId === frameDragOffset.frameId)) {
        return {
          ...obj,
          x: obj.x + frameDragOffset.dx,
          y: obj.y + frameDragOffset.dy,
        };
      }

      return obj;
    });
  }, [objects, selectedIds, groupDragOffset, transformPreview, selectionBox, frameDragOffset]);

  const objectClick = connectMode
    ? (id: string) => handleObjectClickForConnect(id, {
        style: curveStyle,
        lineType: connectorStyle.lineType,
        startArrow: connectorStyle.startArrow,
        endArrow: connectorStyle.endArrow,
        strokeWidth: connectorStyle.strokeWidth,
        color: connectorStyle.color,
      })
    : selectObject;
  const objectHoverEnter = connectMode ? (id: string) => handleObjectHover(id) : undefined;
  const objectHoverLeave = connectMode ? () => handleObjectHover(null) : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden board-dots" style={{ backgroundPosition: `${stageTransform.x * 0.1}px ${stageTransform.y * 0.1}px` }}>
      {/* Fade overlay to hide zoom-to-fit flicker during preview capture */}
      {isCapturing && (
        <div
          className="absolute inset-0 z-[9999] pointer-events-none"
          style={{
            background: 'white',
            animation: 'fadeIn 200ms ease-out forwards',
          }}
        />
      )}
      <div className="absolute inset-0 z-0">
        <Board
          boardId={boardId}
          onMouseMove={handleMouseMove}
          onTransformChange={setStageTransform}
          onStageMouseDown={connectMode ? undefined : handleStageMouseDown}
          onStageMouseMove={connectMode ? undefined : handleStageMouseMove}
          onStageMouseUp={connectMode ? undefined : handleStageMouseUp}
          onZoomControlsChange={setZoomControls}
          onContainerRef={handleContainerRef}
        >
          {/* Render order: Connectors → Frames → Shapes → Sticky Notes (connectors always behind) */}
          {connectors.map((connector) => (
            <ConnectorComponent
              key={connector.id}
              connector={connector}
              objects={visualObjects}
              onDelete={removeObject}
            />
          ))}
          {/* Preview connector while connecting */}
          {connectMode && connectingFrom && cursorPosition && (() => {
            const fromObject = visualObjects.find((o) => o.id === connectingFrom);
            const toObject = hoveredObjectId ? visualObjects.find((o) => o.id === hoveredObjectId) || null : null;
            return fromObject ? (
              <PreviewConnector
                fromObject={fromObject}
                toObject={toObject}
                toX={cursorPosition.x}
                toY={cursorPosition.y}
                objects={visualObjects}
              />
            ) : null;
          })()}
          {frames.map((frame) => {
            const children = objects.filter((o) => o.parentId === frame.id);
            const minChildBounds = children.length > 0 ? {
              width: Math.max(...children.map((c) => c.x + c.width - frame.x)) + 10,
              height: Math.max(...children.map((c) => c.y + c.height - frame.y)) + 10,
            } : undefined;
            return (
            <FrameComponent
              key={frame.id}
              frame={frame}
              onDragMove={handleFrameDragMove}
              onDragEnd={handleFrameDragEnd}
              onDelete={removeObject}
              onDuplicate={handleDuplicateObject}
              onDissolve={dissolveFrame}
              onTitleChange={updateTitle}
              onClick={objectClick}
              hoverState={
                hoveredFrame?.id === frame.id ? (hoveredFrame.fits ? 'accept' : 'reject') :
                groupHoveredFrame?.id === frame.id ? (groupHoveredFrame.fits ? 'accept' : 'reject') :
                'none'
              }
              onResize={resizeObject}
              onRotate={rotateObject}
              onResizeEnd={finalizeResize}
              onRotateEnd={finalizeRotate}
              dragOffset={getChildOffset(frame)}
              parentRotation={getParentRotation(frame.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === frame.id || hoveredObjectId === frame.id)}
              isNew={newObjectIds.has(frame.id)}
              isSelected={isObjectSelected(frame.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(frame.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(frame.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(frame.id) ? selectionBox : null}
              dragTint={getDragTint(frame.id)}
              minChildBounds={minChildBounds}
            />
            );
          })}
          {shapes.map((shape) => (
            <ShapeComponent
              key={shape.id}
              shape={shape}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onDuplicate={handleDuplicateObject}
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              onResizeEnd={finalizeResize}
              onRotateEnd={finalizeRotate}
              onLineEndpointMove={moveLineEndpoint}
              onLineEndpointEnd={finalizeLineEndpoint}
              dragOffset={getChildOffset(shape)}
              parentRotation={getParentRotation(shape.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === shape.id || hoveredObjectId === shape.id)}
              isNew={newObjectIds.has(shape.id)}
              isSelected={isObjectSelected(shape.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(shape.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(shape.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(shape.id) ? selectionBox : null}
              dragTint={getDragTint(shape.id)}
            />
          ))}
          {textObjects.map((textObj) => (
            <TextComponent
              key={textObj.id}
              textObj={textObj}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTextChange={updateText}
              onDelete={removeObject}
              onDuplicate={handleDuplicateObject}
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              onResizeEnd={finalizeResize}
              onRotateEnd={finalizeRotate}
              dragOffset={getChildOffset(textObj)}
              parentRotation={getParentRotation(textObj.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === textObj.id || hoveredObjectId === textObj.id)}
              isNew={newObjectIds.has(textObj.id)}
              isSelected={isObjectSelected(textObj.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(textObj.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(textObj.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(textObj.id) ? selectionBox : null}
              dragTint={getDragTint(textObj.id)}
            />
          ))}
          {stickyNotes.map((note) => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTextChange={updateText}
              onDelete={removeObject}
              onDuplicate={handleDuplicateObject}
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              onResizeEnd={finalizeResize}
              onRotateEnd={finalizeRotate}
              dragOffset={getChildOffset(note)}
              parentRotation={getParentRotation(note.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === note.id || hoveredObjectId === note.id)}
              isNew={newObjectIds.has(note.id)}
              isSelected={isObjectSelected(note.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(note.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(note.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(note.id) ? selectionBox : null}
              dragTint={getDragTint(note.id)}
            />
          ))}
          {stickers.map((sticker) => (
            <StickerComponent
              key={sticker.id}
              sticker={sticker}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onDuplicate={handleDuplicateObject}
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              onResizeEnd={finalizeResize}
              onRotateEnd={finalizeRotate}
              dragOffset={getChildOffset(sticker)}
              parentRotation={getParentRotation(sticker.parentId)}
              isNew={newObjectIds.has(sticker.id)}
              isSelected={isObjectSelected(sticker.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(sticker.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(sticker.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(sticker.id) ? selectionBox : null}
              dragTint={getDragTint(sticker.id)}
            />
          ))}
          {showAILabels && objects.filter((o) => o.aiLabel || o.aiGroupId).map((o) => (
            <AILabelOverlay
              key={`ai-label-${o.id}`}
              x={o.x}
              y={o.y}
              width={o.width}
              height={o.height}
              label={o.aiLabel ?? ''}
              groupId={o.aiGroupId}
            />
          ))}
          <SelectionOverlay
            marquee={marquee}
            selectedIds={selectedIds}
            selectionBox={selectionBox}
            selectionHidden={selectionHidden}
            groupDragOffset={groupDragOffset}
            transformPreview={transformPreview}
            onGroupDragMove={handleGroupDragMove}
            onGroupDragEnd={handleGroupDragEnd}
            onGroupResizeMove={handleGroupResizeMove}
            onGroupResize={handleGroupResize}
            onGroupRotateMove={handleGroupRotateMove}
            onGroupRotate={handleGroupRotate}
            onDeleteSelected={handleDeleteSelected}
            onDuplicateSelected={() => handleDuplicateSelected({ dx: 20, dy: 20 })}
          />
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} stageTransform={stageTransform} />
      <WebcamDock
        activePeers={activePeers}
        localStream={localStream}
        remoteStreams={remoteStreams}
        userId={user.uid}
        onStopStreaming={stopStreaming}
      />
      <Toolbar
        onAddStickyNote={(bgColor, textColor, borderColor) => addStickyNote(stageTransform, undefined, undefined, bgColor, textColor, borderColor)}
        onAddText={(fontSize, fontFamily, fontWeight, fontStyle, textAlign, textColor) => addText(stageTransform, fontSize, fontFamily, fontWeight, fontStyle, textAlign, textColor)}
        onAddShape={(shapeType, fillColor, strokeColor, borderColor) => addShape(stageTransform, shapeType, fillColor, undefined, undefined, strokeColor, borderColor)}
        onAddFrame={() => addFrame(stageTransform)}
        onAddBorderlessFrame={() => addFrame(stageTransform, undefined, undefined, true)}
        onAddSticker={(emoji) => addSticker(stageTransform, emoji)}
        onAddGifSticker={addGifSticker ? (gifUrl) => addGifSticker(stageTransform, gifUrl) : undefined}
        onToggleWebcam={handleToggleWebcam}
        isWebcamStreaming={isWebcamStreaming}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={toggleConnectMode}
        onToggleAI={toggleAI}
        aiOpen={aiOpen}
        chatMessages={chatMessages}
        chatCurrentUserId={user.uid}
        onChatSend={sendChatMessage}
        connectorStyle={connectorStyle}
        onConnectorStyleChange={handleConnectorStyleChange}
        curveStyle={curveStyle}
        onCurveStyleChange={handleCurveStyleChange}
        selectedObject={selectedObject}
        onUpdateSelectedObject={handleUpdateSelectedObject}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        forceOpenDrawer={tutorial.isActive ? tutorial.openDrawer : null}
        forceOpenDrawerTab={tutorial.isActive ? tutorial.openDrawerTab : undefined}
      />
      <AIChat boardId={boardId} isOpen={aiOpen} onClose={() => setAiOpen(false)} onObjectsCreated={handleAIObjectsCreated} selectedIds={[...selectedIds]} getViewportCenter={() => ({
        x: (-stageTransform.x + window.innerWidth / 2) / stageTransform.scale,
        y: (-stageTransform.y + window.innerHeight / 2) / stageTransform.scale,
        width: window.innerWidth / stageTransform.scale,
        height: window.innerHeight / stageTransform.scale,
      })} />
      {/* Confetti burst on AI completion — positioned near bottom-right */}
      <div className="fixed bottom-24 right-10 z-[9998]">
        <ConfettiBurst trigger={showConfetti} onComplete={() => setShowConfetti(false)} />
      </div>
      {/* Top left: Back/Share buttons and minimap */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-3 w-[220px]">
        <div className="glass-playful rounded-xl shadow-lg py-1.5 px-1.5 w-full flex items-center gap-1">
          <button
            onClick={handleNavigateBack}
            className="px-1.5 py-1 text-gray-700 hover:text-violet-600 transition-colors duration-200 flex items-center rounded-lg hover:bg-violet-50/60 shrink-0"
            title="Back to your boards"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-300" />
          <span className="text-lg font-bold text-orange-500 truncate flex-1 min-w-0 text-center">
            {boardMetadata?.name ?? ''}
          </span>
          <div className="w-px h-6 bg-gray-300" />
          <button
            onClick={() => setHelpOpen((o) => !o)}
            className="px-1.5 py-1 text-violet-600 hover:text-violet-700 transition-colors duration-200 flex items-center rounded-lg hover:bg-violet-50/60 font-bold text-sm shrink-0"
            title="Help & shortcuts"
          >
            ?
          </button>
          <button
            onClick={() => {
              const url = `${window.location.origin}/${boardId}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="px-1.5 py-1 text-gray-700 hover:text-violet-600 transition-colors duration-200 flex items-center rounded-lg hover:bg-violet-50/60 shrink-0"
            title={copied ? "Link copied!" : "Share this space"}
          >
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
            )}
          </button>
        </div>
        <div className="relative w-full">
          <Minimap
            transform={stageTransform}
            objects={objects.map((obj) => ({
              x: obj.x,
              y: obj.y,
              width: obj.width,
              height: obj.height,
              type: obj.type,
              color: 'color' in obj ? (obj as any).color : undefined,
              shapeType: 'shapeType' in obj ? (obj as any).shapeType : undefined,
            }))}
            onPanTo={handleMinimapPanTo}
          />
          {zoomControls && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-white/70 backdrop-blur-sm rounded-lg px-1 py-0.5">
              <button
                onClick={zoomControls.zoomOut}
                className="w-6 h-6 flex items-center justify-center rounded text-violet-600 hover:bg-violet-50/60 transition-colors text-sm font-bold"
                title="Zoom out"
              >
                -
              </button>
              <button
                onClick={zoomControls.resetZoom}
                className="px-1 h-6 flex items-center justify-center rounded text-violet-600 hover:bg-violet-50/60 transition-colors text-[10px] font-semibold min-w-[2.5rem]"
                title="Reset zoom"
              >
                {Math.round((zoomControls.scale ?? 1) * 100)}%
              </button>
              <button
                onClick={zoomControls.zoomIn}
                className="w-6 h-6 flex items-center justify-center rounded text-violet-600 hover:bg-violet-50/60 transition-colors text-sm font-bold"
                title="Zoom in"
              >
                +
              </button>
            </div>
          )}
        </div>
        <PresencePanel users={onlineUsers} cursors={cursors} onFollowUser={handleFollowUser} currentUser={{ displayName: user.displayName, email: user.email, color: userColor }} />
      </div>
      <PresenceToastContainer toasts={presenceToasts} />

      {/* Help & Tutorial */}
      {helpOpen && (
        <HelpPanel
          onClose={() => setHelpOpen(false)}
          onStartTutorial={tutorial.startTutorial}
        />
      )}
      {tutorial.isActive && tutorial.currentStep && (
        <TutorialOverlay
          step={tutorial.currentStep}
          stepIndex={tutorial.currentStepIndex}
          totalSteps={tutorial.totalSteps}
          isAnimating={tutorial.isAnimating}
          onNext={tutorial.nextStep}
          onPrev={tutorial.prevStep}
          onSkip={tutorial.skipTutorial}
          onFinish={tutorial.finishTutorial}
          cursorPos={tutorial.cursorPos}
        />
      )}
    </div>
  );
}

export default App;
