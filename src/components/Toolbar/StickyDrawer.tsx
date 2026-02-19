import { useState, useRef, useCallback } from 'react';
import { ColorPanel } from './ColorPanel';

interface StickyDrawerProps {
  bgColor: string;
  textColor: string;
  borderColor: string;
  onBgColorChange: (c: string) => void;
  onTextColorChange: (c: string) => void;
  onBorderColorChange: (c: string) => void;
  onAdd: () => void;
}

export function StickyDrawer({
  bgColor, textColor, borderColor,
  onBgColorChange, onTextColorChange, onBorderColorChange,
  onAdd,
}: StickyDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-stretch">
        <button
          onClick={onAdd}
          className="btn-lift flex items-center gap-1.5 px-3.5 py-2.5 rounded-l-xl text-sm font-bold text-amber-900 transition-all duration-200"
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
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="btn-lift px-1.5 py-2.5 rounded-r-xl text-sm text-amber-800 transition-all duration-200 border-l border-amber-600/20 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
          }}
          title="Sticky note options"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isOpen ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl p-3 flex flex-col gap-3" style={{ width: 300 }}>
            {/* Preview */}
            <div className="flex items-center justify-center">
              <div
                className="rounded-xl px-4 py-3 text-sm font-semibold"
                style={{
                  background: bgColor === 'transparent' ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px' : bgColor,
                  color: textColor === 'transparent' ? 'transparent' : textColor,
                  border: `2px solid ${borderColor === 'transparent' ? 'transparent' : borderColor}`,
                  minWidth: 120,
                  textAlign: 'center',
                }}
              >
                Sticky Note
              </div>
            </div>

            <ColorPanel label="Background" color={bgColor} onChange={onBgColorChange} />
            <ColorPanel label="Text" color={textColor} onChange={onTextColorChange} />
            <ColorPanel label="Border" color={borderColor} onChange={onBorderColorChange} />
          </div>
        </div>
      )}
    </div>
  );
}
