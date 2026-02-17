import { useState } from 'react';
import { ColorPicker, COLORS } from './ColorPicker';
import type { ShapeType } from '../../types/board';

const EMOJI_OPTIONS = ['\ud83d\udc4d', '\u2764\ufe0f', '\u2b50', '\ud83d\udd25', '\u2705', '\u274c', '\u2753', '\ud83d\udca1'];

interface ToolbarProps {
  onAddStickyNote: (color: string) => void;
  onAddShape: (shapeType: ShapeType, color: string) => void;
  onAddFrame: () => void;
  onAddSticker: (emoji: string) => void;
  connectMode: boolean;
  connectingFrom: string | null;
  onToggleConnectMode: () => void;
}

export function Toolbar({
  onAddStickyNote,
  onAddShape,
  onAddFrame,
  onAddSticker,
  connectMode,
  connectingFrom,
  onToggleConnectMode,
}: ToolbarProps) {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const connectLabel = connectMode
    ? connectingFrom
      ? 'Click target...'
      : 'Click source...'
    : 'Connect';

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: 0,
        right: 0,
        zIndex: 1000,
        pointerEvents: 'none',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
    <div
      style={{
        pointerEvents: 'auto',
        maxWidth: 'calc(100vw - 32px)',
        overflowX: 'auto',
        boxShadow: '0 8px 32px rgba(139, 92, 246, 0.12), 0 4px 16px rgba(236, 72, 153, 0.08), 0 2px 8px rgba(0,0,0,0.06)',
      }}
      className="flex gap-1.5 glass-playful rounded-2xl p-2.5 items-center animate-float-up toolbar-scroll"
    >
      {/* Sticky Note */}
      <button
        onClick={() => onAddStickyNote(selectedColor)}
        className="btn-lift flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-amber-900 transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #f59e0b 100%)',
          boxShadow: '0 2px 10px rgba(251, 191, 36, 0.3)',
        }}
        title="Add sticky note"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Sticky
      </button>

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Color Picker */}
      <ColorPicker selectedColor={selectedColor} onSelectColor={setSelectedColor} />

      {/* Shape buttons */}
      <button
        onClick={() => onAddShape('rect', selectedColor)}
        className="btn-lift px-3 py-2.5 rounded-xl text-sm font-semibold text-indigo-600 bg-indigo-50/80 hover:bg-indigo-100 transition-all duration-200"
        title="Add rectangle"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      </button>
      <button
        onClick={() => onAddShape('circle', selectedColor)}
        className="btn-lift px-3 py-2.5 rounded-xl text-sm font-semibold text-pink-600 bg-pink-50/80 hover:bg-pink-100 transition-all duration-200"
        title="Add circle"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      </button>

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Frame */}
      <button
        onClick={() => onAddFrame()}
        className="btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold text-violet-700 transition-all duration-200"
        style={{
          background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)',
          boxShadow: '0 2px 10px rgba(167, 139, 250, 0.25)',
        }}
        title="Add frame"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="6 3" />
        </svg>
      </button>

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Sticker */}
      <div className="relative">
        <button
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold text-rose-700 transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 50%, #fda4af 100%)',
            boxShadow: '0 2px 10px rgba(251, 113, 133, 0.25)',
          }}
          title="Add sticker"
        >
          <span className="text-base">
            {'\u2728'}
          </span>
        </button>
        {showEmojiPicker && (
          <div
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 glass-playful rounded-2xl shadow-2xl p-2.5 flex gap-1.5 animate-bounce-in"
            style={{ zIndex: 1001 }}
          >
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onAddSticker(emoji);
                  setShowEmojiPicker(false);
                }}
                className="text-2xl hover:scale-125 rounded-lg p-1.5 transition-all duration-150 hover:bg-white/60"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Connect */}
      <button
        onClick={onToggleConnectMode}
        className={`btn-lift px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
          connectMode
            ? 'text-white shadow-lg shadow-indigo-500/30'
            : 'text-gray-600 bg-white/50 hover:bg-white/80'
        }`}
        style={connectMode ? {
          background: 'linear-gradient(135deg, #818cf8 0%, #a78bfa 50%, #c084fc 100%)',
          boxShadow: '0 4px 16px rgba(139, 92, 246, 0.4)',
        } : undefined}
        title="Connect objects"
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          {connectLabel}
        </div>
      </button>
    </div>
    </div>
  );
}
