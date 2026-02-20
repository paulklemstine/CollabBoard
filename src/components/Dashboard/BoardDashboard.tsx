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
                background: 'linear-gradient(135deg, #f59e0b 0%, #f97316 50%, #fb923c 100%)',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none">
                <g transform="rotate(-10, 38, 50)">
                  <rect x="18" y="26" width="40" height="44" rx="7" fill="rgba(255,255,255,0.4)"/>
                </g>
                <g transform="rotate(5, 58, 50)">
                  <rect x="38" y="26" width="40" height="44" rx="7" fill="white" opacity="0.95"/>
                </g>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Flow Space
              </h1>
              <p className="text-sm text-white/70 font-medium" key={refreshKey}>
                What are we building today, {user.displayName || user.email?.split('@')[0] || 'User'}?
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
          <h2 className="text-lg font-bold text-gray-800 mb-4">Spark something new</h2>
          <CreateBoardForm onCreateBoard={handleCreateBoard} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin-loader" />
          </div>
        ) : (
          <>
            {/* My Boards */}
            <h2 className="text-lg font-bold text-white/90 mb-4">Your Spaces</h2>
            {myBoards.length === 0 ? (
              <div className="glass-playful rounded-2xl p-8 text-center shadow-lg mb-8">
                <p className="text-gray-500 font-medium">Nothing here yet — that's about to change</p>
                <p className="text-gray-400 text-sm mt-1">Spin up your first board, or jump into someone else's.</p>
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
                <h2 className="text-lg font-bold text-white/90 mb-4">Collab invites</h2>
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
            <h2 className="text-lg font-bold text-white/90 mb-4">Open vibes</h2>
            {publicBoards.length === 0 ? (
              <div className="glass-playful rounded-2xl p-8 text-center shadow-lg">
                <p className="text-gray-500 font-medium">No public boards yet — be the first</p>
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
