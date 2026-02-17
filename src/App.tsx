import { useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCursors } from './hooks/useCursors';
import { usePresence, pickColor } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { AuthPanel } from './components/Auth/AuthPanel';
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

const BOARD_ID = 'default-board';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <AuthPanel user={null} />
      </div>
    );
  }

  return <BoardView user={user} />;
}

function BoardView({ user }: { user: { uid: string; displayName: string | null; email: string | null } }) {
  const userColor = pickColor(user.uid);
  const { cursors, updateCursor } = useCursors(
    BOARD_ID,
    user.uid,
    user.displayName ?? 'Anonymous',
    userColor,
  );
  const { onlineUsers } = usePresence(
    BOARD_ID,
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
    updateText,
    updateTitle,
    removeObject,
    connectMode,
    connectingFrom,
    toggleConnectMode,
    handleObjectClickForConnect,
    hoveredFrameId,
    handleDragMove,
    handleDragEnd,
    handleFrameDragMove,
  } = useBoard(BOARD_ID, user.uid);

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      updateCursor(x, y);
    },
    [updateCursor]
  );

  const stickyNotes = objects.filter((o): o is StickyNote => o.type === 'sticky');
  const shapes = objects.filter((o): o is Shape => o.type === 'shape');
  const frames = objects.filter((o): o is Frame => o.type === 'frame');
  const stickers = objects.filter((o): o is Sticker => o.type === 'sticker');
  const connectors = objects.filter((o): o is Connector => o.type === 'connector');

  const objectClick = connectMode ? handleObjectClickForConnect : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Board boardId={BOARD_ID} onMouseMove={handleMouseMove}>
          {/* Render order: Frames → Connectors → Shapes → Sticky Notes → Stickers */}
          {frames.map((frame) => (
            <FrameComponent
              key={frame.id}
              frame={frame}
              onDragMove={handleFrameDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onTitleChange={updateTitle}
              onClick={objectClick}
              isHovered={hoveredFrameId === frame.id}
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
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onClick={objectClick}
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
            />
          ))}
          {stickers.map((sticker) => (
            <StickerComponent
              key={sticker.id}
              sticker={sticker}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDelete={removeObject}
              onClick={objectClick}
            />
          ))}
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} />
      <PresencePanel users={onlineUsers} />
      <Toolbar
        onAddStickyNote={addStickyNote}
        onAddShape={addShape}
        onAddFrame={addFrame}
        onAddSticker={addSticker}
        connectMode={connectMode}
        connectingFrom={connectingFrom}
        onToggleConnectMode={toggleConnectMode}
      />
      <div className="absolute top-4 left-4 z-50">
        <AuthPanel user={user as never} />
      </div>
    </div>
  );
}

export default App;
