interface HelpPanelProps {
  onClose: () => void;
  onStartTutorial: () => void;
}

const SHORTCUTS = [
  { keys: 'Ctrl+Z', desc: 'Undo' },
  { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
  { keys: 'Ctrl+C', desc: 'Copy' },
  { keys: 'Ctrl+V', desc: 'Paste' },
  { keys: 'Ctrl+D', desc: 'Duplicate' },
  { keys: 'Delete', desc: 'Remove' },
  { keys: 'Esc', desc: 'Deselect' },
  { keys: 'L', desc: 'AI Labels' },
  { keys: 'Scroll', desc: 'Zoom' },
  { keys: 'Click+Drag', desc: 'Select area' },
];

const FEATURES = [
  { icon: '📝', label: 'Sticky notes for quick ideas' },
  { icon: '🔷', label: 'Shapes, frames & text' },
  { icon: '🔗', label: 'Connect objects with lines' },
  { icon: '✨', label: 'AI-powered board generation' },
  { icon: '👥', label: 'Real-time collaboration' },
  { icon: '📹', label: 'Webcam video sharing' },
  { icon: '😀', label: 'Stickers & GIFs' },
];

export function HelpPanel({ onClose, onStartTutorial }: HelpPanelProps) {
  return (
    <div
      className="fixed z-[1100] animate-float-up"
      style={{
        top: 52,
        left: 16,
        width: 340,
        maxHeight: 'calc(100vh - 70px)',
      }}
    >
      <div className="glass-playful rounded-2xl shadow-2xl p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 70px)' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">Help & Shortcuts</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Shortcuts */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Keyboard Shortcuts</div>
          <div className="grid grid-cols-2 gap-1.5">
            {SHORTCUTS.map((s) => (
              <div key={s.keys} className="flex items-center gap-2 text-xs">
                <kbd className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono text-[10px] border border-gray-200 whitespace-nowrap">
                  {s.keys}
                </kbd>
                <span className="text-gray-500">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Features */}
        <div className="mb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Features</div>
          <div className="flex flex-col gap-1.5">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-xs text-gray-600">
                <span className="text-sm">{f.icon}</span>
                <span>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tour button */}
        <button
          onClick={() => {
            onClose();
            onStartTutorial();
          }}
          className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-md"
        >
          Take the tour
        </button>
      </div>
    </div>
  );
}
