import { useCallback } from 'react';
import { ref, set, remove } from 'firebase/database';
import { rtdb } from './services/firebase';
import { signOutUser } from './services/authService';
import { useAuth } from './hooks/useAuth';
import { useRouter } from './hooks/useRouter';
import { useCursors } from './hooks/useCursors';
import { usePresence, pickColor } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { AuthPanel } from './components/Auth/AuthPanel';
import { BoardDashboard } from './components/Dashboard/BoardDashboard';
import { Board } from './components/Board/Board';
import { StickyNoteComponent } from './components/Board/StickyNote';
import { ShapeComponent } from './components/Board/ShapeComponent';
import { FrameComponent } from './components/Board/FrameComponent';
import { ConnectorComponent } from './components/Board/ConnectorComponent';
import { StickerComponent } from './components/Board/StickerComponent';
import { CursorsOverlay } from './components/Cursors/CursorsOverlay';
import { PresencePanel } from './components/Presence/PresencePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import type { StickyNote, Shape, Frame, Sticker, Connector } from './types/board';

function App() {
  const { user, loading } = useAuth();
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
        <AuthPanel user={null} />
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
    moveObject,
    resizeObject,
    updateText,
    updateTitle,
    removeObject,
    connectMode,
    connectingFrom,
    toggleConnectMode,
    handleObjectClickForConnect,
    hoveredFrameId,
    frameDragOffset,
    handleDragMove,
    handleDragEnd,
    handleFrameDragMove,
    handleFrameDragEnd,
  } = useBoard(boardId, user.uid);

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      updateCursor(x, y);
    },
    [updateCursor]
  );

  // Enhanced drag handlers that update cursor position during drag
  const handleDragMoveWithCursor = useCallback(
    (id: string, x: number, y: number) => {
      handleDragMove(id, x, y);
      updateCursor(x, y);
    },
    [handleDragMove, updateCursor]
  );

  const handleFrameDragMoveWithCursor = useCallback(
    (id: string, x: number, y: number) => {
      handleFrameDragMove(id, x, y);
      updateCursor(x, y);
    },
    [handleFrameDragMove, updateCursor]
  );

  const stickyNotes = objects.filter((o): o is StickyNote => o.type === 'sticky');
  const shapes = objects.filter((o): o is Shape => o.type === 'shape');
  const frames = objects.filter((o): o is Frame => o.type === 'frame');
  const stickers = objects.filter((o): o is Sticker => o.type === 'sticker');
  const connectors = objects.filter((o): o is Connector => o.type === 'connector');

  const objectClick = connectMode ? handleObjectClickForConnect : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden board-dots">
      <div className="absolute inset-0 z-0">
        <Board boardId={boardId} onMouseMove={handleMouseMove}>
          {/* Render order: Frames → Connectors → Shapes → Sticky Notes → Stickers */}
          {frames.map((frame) => (
            <FrameComponent
              key={frame.id}
              frame={frame}
              onDragMove={handleFrameDragMoveWithCursor}
              onDragEnd={handleFrameDragEnd}
              onDelete={removeObject}
              onTitleChange={updateTitle}
              onClick={objectClick}
              isHovered={hoveredFrameId === frame.id}
              onResize={resizeObject}
            />
          ))}
          {connectors.map((connector) => (
            <ConnectorComponent
              key={connector.id}
              connector={connector}
              objects={objects}
            />
          ))}
          {shapes.map((shape) => (
            <ShapeComponent
              key={shape.id}
              shape={shape}
              onDragMove={handleDragMoveWithCursor}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onClick={objectClick}
              onResize={resizeObject}
              dragOffset={frameDragOffset && shape.parentId === frameDragOffset.frameId ? { x: frameDragOffset.dx, y: frameDragOffset.dy } : undefined}
            />
          ))}
          {stickyNotes.map((note) => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              onDragMove={handleDragMoveWithCursor}
              onDragEnd={handleDragEnd}
              onTextChange={updateText}
              onDelete={removeObject}
              onClick={objectClick}
              onResize={resizeObject}
              dragOffset={frameDragOffset && note.parentId === frameDragOffset.frameId ? { x: frameDragOffset.dx, y: frameDragOffset.dy } : undefined}
            />
          ))}
          {stickers.map((sticker) => (
            <StickerComponent
              key={sticker.id}
              sticker={sticker}
              onDragMove={handleDragMoveWithCursor}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onClick={objectClick}
              onResize={resizeObject}
              dragOffset={frameDragOffset && sticker.parentId === frameDragOffset.frameId ? { x: frameDragOffset.dx, y: frameDragOffset.dy } : undefined}
            />
          ))}
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} />
      <PresencePanel users={onlineUsers} />
      <Toolbar
        onAddStickyNote={(color) => addStickyNote(undefined, undefined, color)}
        onAddShape={addShape}
        onAddFrame={addFrame}
        onAddSticker={addSticker}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={toggleConnectMode}
      />
      <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
        <button
          onClick={onNavigateBack}
          className="glass-playful rounded-xl px-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 transition-colors duration-200 shadow-lg flex items-center gap-1.5"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Boards
        </button>
        <AuthPanel user={user as never} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

export default App;
