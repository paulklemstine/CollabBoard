import type { BoardMetadata } from '../../types/board';

interface BoardCardProps {
  board: BoardMetadata;
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  canDelete: boolean;
  isOwner?: boolean;
  onToggleVisibility?: (boardId: string, isPublic: boolean) => void;
}

export function BoardCard({ board, onSelect, onDelete, canDelete, isOwner, onToggleVisibility }: BoardCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(board.id);
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
      className="glass-playful rounded-2xl p-6 cursor-pointer hover:scale-[1.02] transition-all duration-200 shadow-lg hover:shadow-xl group"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(board.id);
        }
      }}
    >
      <div className="flex items-start justify-between">
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
              className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-gray-400 hover:text-purple-500 hover:bg-purple-50 transition-all duration-200"
              aria-label={isPublic ? `Make ${board.name} private` : `Make ${board.name} public`}
            >
              {isPublic ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>
          )}
          {canDelete && (
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
        </div>
      </div>
    </div>
  );
}
