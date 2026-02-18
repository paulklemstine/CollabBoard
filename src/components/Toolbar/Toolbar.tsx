import { useState } from 'react';
import { COLORS } from './ColorPicker';
import { ColorDrawer } from './ColorDrawer';
import { ShapeDrawer } from './ShapeDrawer';
import { StickerDrawer } from './StickerDrawer';
import type { ShapeType } from '../../types/board';

interface ToolbarProps {
  onAddStickyNote: (color: string) => void;
  onAddShape: (shapeType: ShapeType, color: string) => void;
  onAddFrame: () => void;
  onAddSticker: (emoji: string) => void;
  connectMode: boolean;
  connectingFrom: string | null;
  onToggleConnectMode: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
  onToggleAI: () => void;
  aiOpen: boolean;
}

export function Toolbar({
  onAddStickyNote,
  onAddShape,
  onAddFrame,
  onAddSticker,
  connectMode,
  connectingFrom,
  onToggleConnectMode,
  selectMode,
  onToggleSelectMode,
  onToggleAI,
  aiOpen,
}: ToolbarProps) {
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);

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
        overflow: 'visible',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          maxWidth: 'calc(100vw - 32px)',
          overflow: 'visible',
        }}
      >
        <div
          style={{
            boxShadow: '0 8px 32px rgba(139, 92, 246, 0.12), 0 4px 16px rgba(236, 72, 153, 0.08), 0 2px 8px rgba(0,0,0,0.06)',
          }}
          className="flex gap-1.5 glass-playful rounded-2xl p-2.5 items-center animate-float-up"
        >
      {/* Select Mode Toggle */}
      <button
        onClick={onToggleSelectMode}
        className={`btn-lift flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
          selectMode
            ? 'text-white'
            : 'text-gray-500 bg-white/30'
        }`}
        style={selectMode ? {
          background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
          boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
        } : undefined}
        title="Toggle select mode (drag to select multiple objects)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        </svg>
        <span className="text-xs">Select</span>
      </button>

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

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

      {/* Color Drawer */}
      <ColorDrawer selectedColor={selectedColor} onSelectColor={setSelectedColor} />

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Shape Drawer */}
      <ShapeDrawer selectedColor={selectedColor} onAddShape={onAddShape} onAddFrame={onAddFrame} />

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* Sticker Drawer */}
      <StickerDrawer onAddSticker={onAddSticker} />

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

      <div className="w-px h-8 mx-0.5" style={{ background: 'linear-gradient(to bottom, rgba(251,146,60,0.2), rgba(168,85,247,0.3), rgba(96,165,250,0.2))' }} />

      {/* AI Assistant */}
      <button
        onClick={onToggleAI}
        className={`btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
          aiOpen
            ? 'text-white'
            : 'text-purple-600 bg-white/50 hover:bg-white/80'
        }`}
        style={aiOpen ? {
          background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
          boxShadow: '0 4px 16px rgba(168, 85, 247, 0.4)',
        } : undefined}
        title="AI Assistant"
      >
        <div className="flex items-center gap-1.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.912 5.813a2 2 0 0 0 1.275 1.275L21 12l-5.813 1.912a2 2 0 0 0-1.275 1.275L12 21l-1.912-5.813a2 2 0 0 0-1.275-1.275L3 12l5.813-1.912a2 2 0 0 0 1.275-1.275L12 3z" />
          </svg>
          AI
        </div>
      </button>
        </div>
      </div>
    </div>
  );
}
