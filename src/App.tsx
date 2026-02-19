import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { rtdb } from './services/firebase';
import { signOutUser } from './services/authService';
import { subscribeToBoardMetadata } from './services/boardMetadataService';
import { addVisitedBoard } from './services/userBoardsService';
import { useAuth } from './hooks/useAuth';
import { useRouter } from './hooks/useRouter';
import { useCursors } from './hooks/useCursors';
import { usePresence, pickColor } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { useMultiSelect } from './hooks/useMultiSelect';
import { AuthPanel } from './components/Auth/AuthPanel';
import { BoardDashboard } from './components/Dashboard/BoardDashboard';
import { Board, type StageTransform } from './components/Board/Board';
import { StickyNoteComponent } from './components/Board/StickyNote';
import { ShapeComponent } from './components/Board/ShapeComponent';
import { FrameComponent } from './components/Board/FrameComponent';
import { ConnectorComponent } from './components/Board/ConnectorComponent';
import { StickerComponent } from './components/Board/StickerComponent';
import { PreviewConnector } from './components/Board/PreviewConnector';
import { SelectionOverlay } from './components/Board/SelectionOverlay';
import { CursorsOverlay } from './components/Cursors/CursorsOverlay';
import { PresencePanel } from './components/Presence/PresencePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { AIChat } from './components/AIChat/AIChat';
import { Minimap } from './components/Minimap/Minimap';
import { useChat } from './hooks/useChat';
import type { StickyNote, Shape, Frame, Sticker, Connector, BoardMetadata } from './types/board';
import { calculateGroupObjectTransform } from './utils/groupTransform';
import type { AnyBoardObject } from './services/boardService';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-animate">
        <div className="flex flex-col items-center gap-4 animate-bounce-in">
          <div
            className="w-14 h-14 rounded-full border-4 border-white/30 border-t-white animate-spin-loader"
          />
          <span className="text-white/90 font-semibold text-sm tracking-wide">
            Loading...
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
  onSignOut,
}: {
  user: { uid: string; displayName: string | null; email: string | null };
  boardId: string;
  onNavigateBack: () => void;
  onSignOut: () => Promise<void>;
}) {
  const [boardMetadata, setBoardMetadata] = useState<BoardMetadata | null>(null);
  const [copied, setCopied] = useState(false);

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
  const {
    objects,
    addStickyNote,
    addShape,
    addFrame,
    addSticker,
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
    hoveredFrameId,
    newObjectIds,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    handleFrameDragMove,
    handleFrameDragEnd,
    dissolveFrame,
    moveLineEndpoint,
  } = useBoard(boardId, user.uid);

  const [selectMode, setSelectMode] = useState(false);
  const toggleSelectMode = useCallback(() => setSelectMode((prev) => !prev), []);
  const [aiOpen, setAiOpen] = useState(false);
  const toggleAI = useCallback(() => setAiOpen((prev) => !prev), []);
  const { messages: chatMessages, sendMessage: sendChatMessage } = useChat(
    boardId,
    user.uid,
    user.displayName ?? 'Anonymous',
    userColor,
  );

  const {
    selectedIds,
    marquee,
    isMarqueeActive,
    groupDragOffset,
    selectionBox,
    selectionHidden,
    transformPreview,
    clearSelection,
    isSelected: isObjectSelected,
    groupHoveredFrameId,
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
  } = useMultiSelect(objects, boardId, selectMode);

  // Keyboard shortcuts: Escape to clear selection, Shift to toggle select mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        clearSelection();
      } else if (e.key === 'Shift') {
        setSelectMode(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setSelectMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [selectedIds.size, clearSelection]);

  const handleDeleteSelected = useCallback(() => {
    for (const id of selectedIds) {
      removeObject(id);
    }
    clearSelection();
  }, [selectedIds, removeObject, clearSelection]);

  const [stageTransform, setStageTransform] = useState<StageTransform>({ x: 0, y: 0, scale: 1 });
  const [zoomControls, setZoomControls] = useState<{
    scale: number;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    setTransform: (transform: StageTransform) => void;
  } | null>(null);

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

  // Build a map of frames for child transform lookups
  const frameMap = new Map<string, Frame>();
  for (const frame of frames) {
    frameMap.set(frame.id, frame);
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

      // Frame drag offset for children of the dragged frame
      if (frameDragOffset && obj.parentId === frameDragOffset.frameId) {
        return {
          ...obj,
          x: obj.x + frameDragOffset.dx,
          y: obj.y + frameDragOffset.dy,
        };
      }

      return obj;
    });
  }, [objects, selectedIds, groupDragOffset, transformPreview, selectionBox, frameDragOffset]);

  const objectClick = connectMode ? handleObjectClickForConnect : selectObject;
  const objectHoverEnter = connectMode ? (id: string) => handleObjectHover(id) : undefined;
  const objectHoverLeave = connectMode ? () => handleObjectHover(null) : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden board-dots">
      <div className="absolute inset-0 z-0">
        <Board
          boardId={boardId}
          onMouseMove={handleMouseMove}
          onTransformChange={setStageTransform}
          onStageMouseDown={connectMode ? undefined : handleStageMouseDown}
          onStageMouseMove={connectMode ? undefined : handleStageMouseMove}
          onStageMouseUp={connectMode ? undefined : handleStageMouseUp}
          isPanDisabled={isMarqueeActive}
          onZoomControlsChange={setZoomControls}
        >
          {/* Render order: Connectors → Frames → Shapes → Sticky Notes (connectors always behind) */}
          {connectors.map((connector) => (
            <ConnectorComponent
              key={connector.id}
              connector={connector}
              objects={visualObjects}
              onDelete={selectMode ? removeObject : undefined}
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
          {frames.map((frame) => (
            <FrameComponent
              key={frame.id}
              frame={frame}
              onDragMove={handleFrameDragMove}
              onDragEnd={handleFrameDragEnd}
              onDelete={selectMode ? removeObject : undefined}
              onDissolve={selectMode ? dissolveFrame : undefined}
              onTitleChange={updateTitle}
              onClick={objectClick}
              isHovered={hoveredFrameId === frame.id || groupHoveredFrameId === frame.id}
              onResize={selectMode ? resizeObject : undefined}
              onRotate={selectMode ? rotateObject : undefined}
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
            />
          ))}
          {shapes.map((shape) => (
            <ShapeComponent
              key={shape.id}
              shape={shape}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={selectMode ? removeObject : undefined}
              onClick={objectClick}
              onResize={selectMode ? resizeObject : undefined}
              onRotate={selectMode ? rotateObject : undefined}
              onLineEndpointMove={selectMode ? moveLineEndpoint : undefined}
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
            />
          ))}
          {stickyNotes.map((note) => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onTextChange={updateText}
              onDelete={selectMode ? removeObject : undefined}
              onClick={objectClick}
              onResize={selectMode ? resizeObject : undefined}
              onRotate={selectMode ? rotateObject : undefined}
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
            />
          ))}
          {stickers.map((sticker) => (
            <StickerComponent
              key={sticker.id}
              sticker={sticker}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={selectMode ? removeObject : undefined}
              onClick={objectClick}
              onResize={selectMode ? resizeObject : undefined}
              onRotate={selectMode ? rotateObject : undefined}
              dragOffset={getChildOffset(sticker)}
              parentRotation={getParentRotation(sticker.parentId)}
              isNew={newObjectIds.has(sticker.id)}
              isSelected={isObjectSelected(sticker.id)}
              groupDragOffset={selectedIds.size > 1 && isObjectSelected(sticker.id) ? groupDragOffset : null}
              groupTransformPreview={selectedIds.size > 1 && isObjectSelected(sticker.id) ? transformPreview : null}
              selectionBox={selectedIds.size > 1 && isObjectSelected(sticker.id) ? selectionBox : null}
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
          />
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} stageTransform={stageTransform} />
      <Toolbar
        onAddStickyNote={(color) => addStickyNote(stageTransform, undefined, undefined, color)}
        onAddShape={(shapeType, color) => addShape(stageTransform, shapeType, color)}
        onAddFrame={() => addFrame(stageTransform)}
        onAddSticker={(emoji) => addSticker(stageTransform, emoji)}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={toggleConnectMode}
        selectMode={selectMode}
        onToggleSelectMode={toggleSelectMode}
        onToggleAI={toggleAI}
        aiOpen={aiOpen}
        chatMessages={chatMessages}
        chatCurrentUserId={user.uid}
        onChatSend={sendChatMessage}
      />
      <AIChat boardId={boardId} isOpen={aiOpen} onClose={() => setAiOpen(false)} />
      {/* Top left: Back/Share buttons and minimap */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-3">
        <div className="glass-playful rounded-xl shadow-lg flex items-center">
          <button
            onClick={onNavigateBack}
            className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors duration-200 flex items-center gap-1.5"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Boards
          </button>
          <div className="w-px h-6 bg-gray-300" />
          <button
            onClick={() => {
              const url = `${window.location.origin}/${boardId}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="px-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors duration-200 flex items-center gap-1.5"
          >
            {copied ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Share
              </>
            )}
          </button>
        </div>
        {zoomControls && (
          <div className="glass-playful rounded-xl shadow-lg flex items-center justify-center gap-0.5 px-1.5 py-1">
            <button
              onClick={zoomControls.zoomOut}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50/60 transition-colors text-lg font-bold"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={zoomControls.resetZoom}
              className="px-2 h-8 flex items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50/60 transition-colors text-xs font-semibold min-w-[3rem]"
              title="Reset zoom"
            >
              {Math.round((zoomControls.scale ?? 1) * 100)}%
            </button>
            <button
              onClick={zoomControls.zoomIn}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-violet-600 hover:bg-violet-50/60 transition-colors text-lg font-bold"
              title="Zoom in"
            >
              +
            </button>
          </div>
        )}
        <Minimap
          transform={stageTransform}
          objects={objects.map((obj) => ({
            x: obj.x,
            y: obj.y,
            width: obj.width,
            height: obj.height,
            type: obj.type,
          }))}
          onPanTo={handleMinimapPanTo}
        />
      </div>
      {/* Top center: Board name */}
      {boardMetadata && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 glass-playful rounded-xl px-5 py-2.5 shadow-lg">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
            {boardMetadata.name}
          </h1>
        </div>
      )}
      {/* Top right: Sign out and Presence */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-3 items-end">
        <AuthPanel user={user as never} onSignOut={onSignOut} />
        <PresencePanel users={onlineUsers} cursors={cursors} onFollowUser={handleFollowUser} />
      </div>
    </div>
  );
}

export default App;
