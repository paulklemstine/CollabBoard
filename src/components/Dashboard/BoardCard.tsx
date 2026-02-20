import { useState } from 'react';
import type { BoardMetadata } from '../../types/board';
import { BoardPreview } from './BoardPreview';
import { BoardQuickLook } from './BoardQuickLook';

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
  const [quickLookOpen, setQuickLookOpen] = useState(false);

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

  const handleQuickLook = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQuickLookOpen(true);
  };

  const isPublic = board.isPublic !== false;

  return (
    <>
      <div
        onClick={() => onSelect(board.id)}
        className="rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl group bg-white/70 backdrop-blur-sm"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(board.id);
          }
        }}
      >
        {/* Preview with overlaid title and quick look button */}
        <div className="relative">
          <BoardPreview boardId={board.id} thumbnailUrl={board.thumbnailUrl} />
          {/* Quick look button */}
          <button
            onClick={handleQuickLook}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-white/80 backdrop-blur-sm text-gray-500 hover:text-purple-600 hover:bg-white shadow-sm transition-all duration-200"
            aria-label={`Quick look at ${board.name}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3.5 pb-2.5 pt-8">
            <h3 className="text-sm font-bold text-white truncate drop-shadow-sm">{board.name}</h3>
          </div>
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5">
          <span className="text-xs text-gray-400 font-medium truncate">
            {board.createdByName || 'Unknown'}
          </span>
          <div className="flex items-center gap-1.5">
            {isOwner && onToggleVisibility && (
              <button
                onClick={handleToggleVisibility}
                className="flex items-center gap-1 shrink-0"
                aria-label={isPublic ? `Make ${board.name} private` : `Make ${board.name} public`}
              >
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  {isPublic ? 'Public' : 'Private'}
                </span>
                <div
                  className="relative w-8 h-[18px] rounded-full transition-colors duration-200"
                  style={{
                    background: isPublic
                      ? 'linear-gradient(135deg, #818cf8, #c084fc)'
                      : '#cbd5e1',
                  }}
                >
                  <div
                    className="absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-all duration-200"
                    style={{ left: isPublic ? 16 : 2 }}
                  />
                </div>
              </button>
            )}
            {canDelete && !confirmDelete && (
              <button
                onClick={handleDelete}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
                aria-label={`Delete ${board.name}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                </svg>
              </button>
            )}
            {confirmDelete && (
              <div className="flex items-center gap-1.5 animate-float-up">
                <span className="text-[11px] font-semibold text-red-500">Delete?</span>
                <button
                  onClick={handleDelete}
                  className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white bg-gradient-to-r from-red-500 to-pink-500 hover:shadow-lg transition-all duration-200"
                >
                  Yes
                </button>
                <button
                  onClick={handleCancelDelete}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-gray-500 bg-white/60 hover:bg-white/90 border border-gray-200 transition-all duration-200"
                >
                  No
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Look Modal */}
      {quickLookOpen && (
        <BoardQuickLook
          boardId={board.id}
          boardName={board.name}
          onClose={() => setQuickLookOpen(false)}
          onOpenBoard={onSelect}
        />
      )}
    </>
  );
}
