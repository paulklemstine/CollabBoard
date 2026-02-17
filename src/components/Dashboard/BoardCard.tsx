import type { BoardMetadata } from '../../types/board';

interface BoardCardProps {
  board: BoardMetadata;
  onSelect: (boardId: string) => void;
  onDelete: (boardId: string) => void;
  canDelete: boolean;
}

export function BoardCard({ board, onSelect, onDelete, canDelete }: BoardCardProps) {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(board.id);
  };

  const formattedDate = new Date(board.createdAt).toLocaleDateString();

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
          <p className="text-sm text-gray-500 mt-1">Created {formattedDate}</p>
        </div>
        {canDelete && (
          <button
            onClick={handleDelete}
            className="opacity-0 group-hover:opacity-100 ml-2 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all duration-200"
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
  );
}
