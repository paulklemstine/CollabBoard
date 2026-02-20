import { useState, useRef, useCallback } from 'react';
import { ColorPanel } from './ColorPanel';

interface TextDrawerProps {
  fontSize: number;
  fontFamily: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right';
  textColor: string;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onFontWeightChange: (weight: 'normal' | 'bold') => void;
  onFontStyleChange: (style: 'normal' | 'italic') => void;
  onTextAlignChange: (align: 'left' | 'center' | 'right') => void;
  onTextColorChange: (color: string) => void;
  onAdd: () => void;
}

const FONTS = [
  { value: "'Inter', sans-serif", label: 'Sans' },
  { value: "'Georgia', serif", label: 'Serif' },
  { value: "'Fira Code', monospace", label: 'Mono' },
  { value: "'Caveat', cursive", label: 'Hand' },
];

export function TextDrawer({
  fontSize, fontFamily, fontWeight, fontStyle, textAlign, textColor,
  onFontSizeChange, onFontFamilyChange, onFontWeightChange, onFontStyleChange, onTextAlignChange, onTextColorChange,
  onAdd,
}: TextDrawerProps) {
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
          className="btn-lift flex items-center gap-1.5 px-3.5 py-2.5 rounded-l-xl text-sm font-bold text-gray-700 hover:text-violet-600 transition-all duration-200"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
          }}
          title="Add text"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="12" y1="4" x2="12" y2="20" />
            <line x1="8" y1="20" x2="16" y2="20" />
          </svg>
          Text
        </button>
        <button
          onClick={() => setIsOpen((o) => !o)}
          className="btn-lift px-1.5 py-2.5 rounded-r-xl text-sm text-gray-500 hover:text-violet-600 transition-all duration-200 border-l border-gray-200 flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
          }}
          title="Text options"
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
            <div className="flex items-center justify-center bg-white/30 rounded-xl p-3">
              <span
                style={{
                  fontSize: Math.min(fontSize, 36),
                  fontWeight,
                  fontStyle,
                  textAlign,
                  color: textColor,
                  fontFamily,
                }}
              >
                Text Label
              </span>
            </div>

            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Size</div>
                <div className="text-xs font-semibold text-violet-600">{fontSize}pt</div>
              </div>
              <input
                type="range"
                min={8}
                max={96}
                step={1}
                value={fontSize}
                onChange={(e) => onFontSizeChange(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-500"
                style={{ background: `linear-gradient(to right, #8b5cf6 ${((fontSize - 8) / 88) * 100}%, #e5e7eb ${((fontSize - 8) / 88) * 100}%)` }}
              />
            </div>

            {/* Font Family */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Font</div>
              <div className="flex gap-1.5">
                {FONTS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => onFontFamilyChange(f.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      fontFamily === f.value
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white/40 text-gray-600 hover:bg-white/70'
                    }`}
                    style={{ fontFamily: f.value }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Style */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Style</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onFontWeightChange(fontWeight === 'bold' ? 'normal' : 'bold')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    fontWeight === 'bold'
                      ? 'bg-cyan-500 text-white shadow-md'
                      : 'bg-white/40 text-gray-600 hover:bg-white/70'
                  }`}
                >
                  <span className="font-bold text-sm">B</span>
                </button>
                <button
                  onClick={() => onFontStyleChange(fontStyle === 'italic' ? 'normal' : 'italic')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    fontStyle === 'italic'
                      ? 'bg-cyan-500 text-white shadow-md'
                      : 'bg-white/40 text-gray-600 hover:bg-white/70'
                  }`}
                >
                  <span className="italic text-sm">I</span>
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">Align</div>
              <div className="flex gap-1.5">
                {(['left', 'center', 'right'] as const).map((align) => (
                  <button
                    key={align}
                    onClick={() => onTextAlignChange(align)}
                    className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center ${
                      textAlign === align
                        ? 'bg-violet-500 text-white shadow-md'
                        : 'bg-white/40 text-gray-600 hover:bg-white/70'
                    }`}
                  >
                    <svg width="16" height="12" viewBox="0 0 16 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      {align === 'left' && (<>
                        <line x1="1" y1="2" x2="15" y2="2" />
                        <line x1="1" y1="6" x2="10" y2="6" />
                        <line x1="1" y1="10" x2="13" y2="10" />
                      </>)}
                      {align === 'center' && (<>
                        <line x1="1" y1="2" x2="15" y2="2" />
                        <line x1="3" y1="6" x2="13" y2="6" />
                        <line x1="2" y1="10" x2="14" y2="10" />
                      </>)}
                      {align === 'right' && (<>
                        <line x1="1" y1="2" x2="15" y2="2" />
                        <line x1="6" y1="6" x2="15" y2="6" />
                        <line x1="3" y1="10" x2="15" y2="10" />
                      </>)}
                    </svg>
                  </button>
                ))}
              </div>
            </div>

            {/* Color */}
            <ColorPanel label="Color" color={textColor} onChange={onTextColorChange} showTransparent />
          </div>
        </div>
      )}
    </div>
  );
}
