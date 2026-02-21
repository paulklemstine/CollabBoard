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
  const [openSpacesPage, setOpenSpacesPage] = useState(0);
  const PAGE_SIZE = 12;
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
                Welcome, {user.displayName || user.email?.split('@')[0] || 'User'}
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="btn-lift px-4 py-2 rounded-xl text-sm font-semibold text-orange-400 border border-orange-400/50 hover:text-white hover:bg-orange-500/20 hover:border-orange-400 transition-all duration-200"
          >
            Sign Out
          </button>
        </div>

        {/* Create Board */}
        <div className="glass-playful rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-lg font-bold text-gray-800 mb-4">New Space</h2>
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
                <p className="text-gray-500 font-medium">No boards yet</p>
                <p className="text-gray-400 text-sm mt-1">Create your first board or join a public one below.</p>
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
                <h2 className="text-lg font-bold text-white/90 mb-4">Shared with Me</h2>
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
            {(() => {
              const totalPages = Math.ceil(publicBoards.length / PAGE_SIZE);
              const page = Math.min(openSpacesPage, Math.max(0, totalPages - 1));
              const paged = publicBoards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
              return (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white/90">Open Spaces</h2>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setOpenSpacesPage(p => Math.max(0, p - 1))}
                          disabled={page === 0}
                          className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                          title="Previous page"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                        </button>
                        <span className="text-sm text-white/60 font-medium">{page + 1}/{totalPages}</span>
                        <button
                          onClick={() => setOpenSpacesPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={page >= totalPages - 1}
                          className="p-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                          title="Next page"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 6 15 12 9 18" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {paged.length === 0 ? (
                    <div className="glass-playful rounded-2xl p-8 text-center shadow-lg">
                      <p className="text-gray-500 font-medium">No public boards yet — be the first</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {paged.map((board) => (
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
              );
            })()}
          </>
        )}

      </div>
    </div>
  );
}
