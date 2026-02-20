import { useState, useEffect } from 'react';
import { useUserBoards } from '../../hooks/useUserBoards';
import { CreateBoardForm } from './CreateBoardForm';
import { BoardCard } from './BoardCard';

interface BoardDashboardProps {
  user: { uid: string; displayName: string | null; email: string | null; isAnonymous: boolean };
  onSelectBoard: (boardId: string) => void;
  onSignOut: () => Promise<void>;
}

export function BoardDashboard({ user, onSelectBoard, onSignOut }: BoardDashboardProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const { myBoards, sharedWithMe, publicBoards, loading, addBoard, removeBoard, toggleBoardVisibility } = useUserBoards(
    user.uid,
    user.isAnonymous,
    user.displayName || user.email?.split('@')[0] || 'User',
  );

  // Delayed refresh to update display name after anonymous auth
  useEffect(() => {
    const timer = setTimeout(() => {
      setRefreshKey(prev => prev + 1);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateBoard = async (name: string) => {
    const boardId = await addBoard(name);
    onSelectBoard(boardId);
  };

  return (
    <div className="min-h-screen bg-gradient-animate">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 50%, #a78bfa 100%)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <path d="M 12 55 Q 25 35, 38 50 T 64 50 T 88 50" stroke="white" strokeWidth="7" strokeLinecap="round"/>
                <path d="M 12 70 Q 25 50, 38 65 T 64 65 T 88 65" stroke="rgba(255,255,255,0.5)" strokeWidth="5" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Flow Space
              </h1>
              <p className="text-sm text-white/70 font-medium" key={refreshKey}>
                Ready to build momentum, {user.displayName || user.email?.split('@')[0] || 'User'}?
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="btn-lift px-4 py-2 rounded-xl text-sm font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            Sign Out
          </button>
        </div>

        {/* Create Board */}
        <div className="glass-playful rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Start a new creative flow</h2>
          <CreateBoardForm onCreateBoard={handleCreateBoard} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin-loader" />
          </div>
        ) : (
          <>
            {/* My Boards */}
            <h2 className="text-lg font-bold text-white/90 mb-4">My Boards</h2>
            {myBoards.length === 0 ? (
              <div className="glass-playful rounded-2xl p-8 text-center shadow-lg mb-8">
                <p className="text-gray-500 font-medium">No boards yet</p>
                <p className="text-gray-400 text-sm mt-1">Create one above or open a shared link.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {myBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onSelect={onSelectBoard}
                    onDelete={removeBoard}
                    canDelete={board.createdBy === user.uid || board.createdByGuest}
                    isOwner={board.createdBy === user.uid}
                    onToggleVisibility={toggleBoardVisibility}
                  />
                ))}
              </div>
            )}

            {/* Shared with me */}
            {sharedWithMe.length > 0 && (
              <>
                <h2 className="text-lg font-bold text-white/90 mb-4">Shared with me</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                  {sharedWithMe.map((board) => (
                    <BoardCard
                      key={board.id}
                      board={board}
                      onSelect={onSelectBoard}
                      onDelete={removeBoard}
                      canDelete={false}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Public Boards */}
            <h2 className="text-lg font-bold text-white/90 mb-4">Public Boards</h2>
            {publicBoards.length === 0 ? (
              <div className="glass-playful rounded-2xl p-8 text-center shadow-lg">
                <p className="text-gray-500 font-medium">No public boards</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicBoards.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onSelect={onSelectBoard}
                    onDelete={removeBoard}
                    canDelete={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
