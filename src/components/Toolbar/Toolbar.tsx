interface ToolbarProps {
  onAddStickyNote: () => void;
}

export function Toolbar({ onAddStickyNote }: ToolbarProps) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      className="flex gap-2 bg-white rounded-lg shadow-lg p-2"
    >
      <button
        onClick={() => onAddStickyNote()}
        className="flex items-center gap-2 px-4 py-2 bg-yellow-200 hover:bg-yellow-300 rounded-md text-sm font-medium transition-colors"
        title="Add sticky note"
      >
        <span className="text-lg">+</span> Sticky Note
      </button>
    </div>
  );
}
