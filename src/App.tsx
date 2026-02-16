import { useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useCursors } from './hooks/useCursors';
import { usePresence } from './hooks/usePresence';
import { useBoard } from './hooks/useBoard';
import { AuthPanel } from './components/Auth/AuthPanel';
import { Board } from './components/Board/Board';
import { StickyNoteComponent } from './components/Board/StickyNote';
import { CursorsOverlay } from './components/Cursors/CursorsOverlay';
import { PresencePanel } from './components/Presence/PresencePanel';
import { Toolbar } from './components/Toolbar/Toolbar';
import type { StickyNote } from './types/board';

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
  const { cursors, updateCursor } = useCursors(
    BOARD_ID,
    user.uid,
    user.displayName ?? 'Anonymous',
  );
  const { onlineUsers } = usePresence(
    BOARD_ID,
    user.uid,
    user.displayName ?? 'Anonymous',
    user.email ?? '',
  );
  const { objects, addStickyNote, moveObject, updateText, removeObject } = useBoard(
    BOARD_ID,
    user.uid,
  );

  const handleMouseMove = useCallback(
    (x: number, y: number) => {
      updateCursor(x, y);
    },
    [updateCursor]
  );

  const stickyNotes = objects.filter((o): o is StickyNote => o.type === 'sticky');

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Board boardId={BOARD_ID} onMouseMove={handleMouseMove}>
          {stickyNotes.map((note) => (
            <StickyNoteComponent
              key={note.id}
              note={note}
              onDragEnd={moveObject}
              onTextChange={updateText}
              onDelete={removeObject}
            />
          ))}
        </Board>
      </div>
      <CursorsOverlay cursors={cursors} />
      <PresencePanel users={onlineUsers} />
      <Toolbar onAddStickyNote={addStickyNote} />
      <div className="absolute top-4 left-4 z-50">
        <AuthPanel user={user as never} />
      </div>
    </div>
  );
}

export default App;
