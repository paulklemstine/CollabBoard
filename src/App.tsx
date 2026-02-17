import { useCallback, useEffect, useRef, useState } from 'react';
import { ref, set, remove } from 'firebase/database';
import { rtdb } from './services/firebase';
import { signOutUser } from './services/authService';
import { subscribeToBoardMetadata } from './services/boardMetadataService';
import { useAuth } from './hooks/useAuth';
import { useRouter } from './hooks/useRouter';
import { useCursors } from './hooks/useCursors';
import { usePresence, pickColor } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { AuthPanel } from './components/Auth/AuthPanel';
import { BoardDashboard } from './components/Dashboard/BoardDashboard';
import { Board, type StageTransform } from './components/Board/Board';
import { StickyNoteComponent } from './components/Board/StickyNote';
import { ShapeComponent } from './components/Board/ShapeComponent';
import { FrameComponent } from './components/Board/FrameComponent';
import { ConnectorComponent } from './components/Board/ConnectorComponent';
import { PreviewConnector } from './components/Board/PreviewConnector';
import { CursorsOverlay } from './components/Cursors/CursorsOverlay';
import { PresencePanel } from './components/Presence/PresencePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import { AIChat } from './components/AIChat/AIChat';
import type { StickyNote, Shape, Frame, Connector, BoardMetadata } from './types/board';

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
  } = useBoard(boardId, user.uid);

  const [stageTransform, setStageTransform] = useState<StageTransform>({ x: 0, y: 0, scale: 1 });

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      updateCursor(x, y);
      updateCursorPosition(x, y);
    },
    [updateCursor, updateCursorPosition]
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

  const objectClick = connectMode ? handleObjectClickForConnect : undefined;
  const objectHoverEnter = connectMode ? (id: string) => handleObjectHover(id) : undefined;
  const objectHoverLeave = connectMode ? () => handleObjectHover(null) : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden board-dots">
      <div className="absolute inset-0 z-0">
        <Board boardId={boardId} onMouseMove={handleMouseMove} onTransformChange={setStageTransform}>
          {/* Render order: Connectors → Frames → Shapes → Sticky Notes (connectors always behind) */}
          {connectors.map((connector) => (
            <ConnectorComponent
              key={connector.id}
              connector={connector}
              objects={objects}
              onDelete={removeObject}
            />
          ))}
          {/* Preview connector while connecting */}
          {connectMode && connectingFrom && cursorPosition && (() => {
            const fromObject = objects.find((o) => o.id === connectingFrom);
            const toObject = hoveredObjectId ? objects.find((o) => o.id === hoveredObjectId) || null : null;
            return fromObject ? (
              <PreviewConnector
                fromObject={fromObject}
                toObject={toObject}
                toX={cursorPosition.x}
                toY={cursorPosition.y}
                objects={objects}
              />
            ) : null;
          })()}
          {frames.map((frame) => (
            <FrameComponent
              key={frame.id}
              frame={frame}
              onDragMove={handleFrameDragMove}
              onDragEnd={handleFrameDragEnd}
              onDelete={removeObject}
              onTitleChange={updateTitle}
              onClick={objectClick}
              isHovered={hoveredFrameId === frame.id}
              onResize={resizeObject}
              onRotate={rotateObject}
              dragOffset={getChildOffset(frame)}
              parentRotation={getParentRotation(frame.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === frame.id || hoveredObjectId === frame.id)}
              isNew={newObjectIds.has(frame.id)}
            />
          ))}
          {shapes.map((shape) => (
            <ShapeComponent
              key={shape.id}
              shape={shape}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              dragOffset={getChildOffset(shape)}
              parentRotation={getParentRotation(shape.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === shape.id || hoveredObjectId === shape.id)}
              isNew={newObjectIds.has(shape.id)}
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
              onClick={objectClick}
              onResize={resizeObject}
              onRotate={rotateObject}
              dragOffset={getChildOffset(note)}
              parentRotation={getParentRotation(note.parentId)}
              onConnectorHoverEnter={objectHoverEnter}
              onConnectorHoverLeave={objectHoverLeave}
              isConnectorHighlighted={connectMode && (connectingFrom === note.id || hoveredObjectId === note.id)}
              isNew={newObjectIds.has(note.id)}
            />
          ))}
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} stageTransform={stageTransform} />
      <PresencePanel users={onlineUsers} />
      <Toolbar
        onAddStickyNote={(color) => addStickyNote(stageTransform, undefined, undefined, color)}
        onAddShape={(shapeType, color) => addShape(stageTransform, shapeType, color)}
        onAddFrame={() => addFrame(stageTransform)}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={toggleConnectMode}
      />
      <AIChat boardId={boardId} />
      <div className="absolute top-4 left-4 z-50 flex items-center gap-3">
        <button
          onClick={onNavigateBack}
          className="glass-playful rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors duration-200 shadow-lg flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Boards
        </button>
        {boardMetadata && (
          <div className="glass-playful rounded-xl px-5 py-2.5 shadow-lg">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
              {boardMetadata.name}
            </h1>
          </div>
        )}
        <AuthPanel user={user as never} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

export default App;
