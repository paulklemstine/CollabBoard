import { useState } from 'react';
import type { BoardMetadata } from '../../types/board';
import { BoardPreview } from './BoardPreview';

interface BoardCardProps {
  board: BoardMetadata;
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  canDelete: boolean;
  isOwner?: boolean;
  onToggleVisibility?: (boardId: string, isPublic: boolean) => void;
}

export function BoardCard({ board, onSelect, onDelete, canDelete, isOwner, onToggleVisibility }: BoardCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(board.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
  };

  const handleToggleVisibility = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleVisibility?.(board.id, board.isPublic === false);
  };

  const formattedDate = new Date(board.createdAt).toLocaleDateString();
  const isPublic = board.isPublic !== false;

  return (
    <div
      onClick={() => onSelect(board.id)}
      className="glass-playful rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(board.id);
        }
      }}
    >
      <BoardPreview boardId={board.id} />
      <div className="flex items-start justify-between p-4 pt-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-800 truncate">{board.name}</h3>
          <p className="text-sm text-gray-500 mt-1">
            By {board.createdByName || 'Unknown'} &middot; {formattedDate}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {isOwner && onToggleVisibility && (
            <button
              onClick={handleToggleVisibility}
              className="flex items-center gap-1.5 shrink-0"
              aria-label={isPublic ? `Make ${board.name} private` : `Make ${board.name} public`}
            >
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                {isPublic ? 'Public' : 'Private'}
              </span>
              <div
                className="relative w-9 h-5 rounded-full transition-colors duration-200"
                style={{
                  background: isPublic
                    ? 'linear-gradient(135deg, #818cf8, #c084fc)'
                    : '#cbd5e1',
                }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-all duration-200"
                  style={{ left: isPublic ? 18 : 2 }}
                />
              </div>
            </button>
          )}
          {canDelete && !confirmDelete && (
            <button
              onClick={handleDelete}
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
              aria-label={`Delete ${board.name}`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
              </svg>
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-1.5 animate-float-up">
              <span className="text-xs font-semibold text-red-500">Delete?</span>
              <button
                onClick={handleDelete}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:shadow-lg transition-all duration-200"
              >
                Yes
              </button>
              <button
                onClick={handleCancelDelete}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-500 bg-white/60 hover:bg-white/90 border border-gray-200 transition-all duration-200"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
