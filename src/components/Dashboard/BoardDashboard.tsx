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
  const { boards, loading, addBoard, removeBoard } = useUserBoards(
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
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
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

        {/* Board List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-10 h-10 rounded-full border-4 border-white/30 border-t-white animate-spin-loader" />
          </div>
        ) : boards.length === 0 ? (
          <div className="glass-playful rounded-2xl p-12 text-center shadow-lg">
            <p className="text-gray-500 text-lg font-medium">No flows yet</p>
            <p className="text-gray-400 text-sm mt-2">Spin up your first board and invite others to ideate in real time.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                onSelect={onSelectBoard}
                onDelete={removeBoard}
                canDelete={board.createdBy === user.uid || board.createdByGuest}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
