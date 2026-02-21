import { useRef, useState, useCallback } from 'react';
import { FancyColorPicker } from './FancyColorPicker';

const PRESETS = [
  '#000000', '#475569', '#ffffff',
  '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#06b6d4', '#3b82f6',
  '#8b5cf6', '#ec4899', '#9a3412',
  '#166534', '#93c5fd',
];

const TRANSPARENT_BG = `repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 50% / 12px 12px`;

interface ColorPanelProps {
  label: string;
  color: string;
  onChange: (color: string) => void;
  showTransparent?: boolean;
  disableTransparent?: boolean;
}

export function ColorPanel({ label, color, onChange, showTransparent = false, disableTransparent = false }: ColorPanelProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTransparent = color === 'transparent';
  const isCustom = !isTransparent && !PRESETS.includes(color);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (!pickerOpen) return;
    closeTimeout.current = setTimeout(() => setPickerOpen(false), 300);
  }, [pickerOpen]);

  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{label}</div>
      <div className="flex gap-1.5 items-center flex-wrap">
        {PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className="w-7 h-7 rounded-lg transition-all hover:scale-110 shrink-0"
            style={{
              background: c,
              border: c === '#ffffff' ? '1px solid #d1d5db' : '1px solid transparent',
              boxShadow: color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c === '#ffffff' ? '#6366f1' : c}` : 'none',
            }}
            title={c}
          />
        ))}
        {showTransparent && (
          <button
            onClick={() => !disableTransparent && onChange('transparent')}
            disabled={disableTransparent}
            className="w-7 h-7 rounded-lg transition-all border border-gray-300 shrink-0"
            style={{
              background: TRANSPARENT_BG,
              boxShadow: isTransparent ? '0 0 0 2px white, 0 0 0 3.5px #6366f1' : 'none',
              opacity: disableTransparent ? 0.35 : 1,
              cursor: disableTransparent ? 'not-allowed' : 'pointer',
            }}
            title={disableTransparent ? 'Cannot make both fill and border transparent' : 'Transparent'}
          />
        )}
        {/* Custom color picker trigger */}
        <div
          className="relative shrink-0"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <button
            ref={buttonRef}
            onClick={() => setPickerOpen(o => !o)}
            className="w-7 h-7 rounded-full transition-all hover:scale-110 flex items-center justify-center"
            style={{
              background: isCustom ? color : '#f1f5f9',
              border: isCustom ? `2px solid ${color}` : '2px dashed #94a3b8',
              boxShadow: isCustom
                ? `0 0 0 2px white, 0 0 0 3.5px ${color}`
                : pickerOpen
                  ? '0 0 0 2px white, 0 0 0 3.5px #8b5cf6'
                  : 'none',
            }}
            title="Custom color"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isCustom ? '#fff' : '#64748b'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={isCustom ? { filter: 'drop-shadow(0 0 1px rgba(0,0,0,0.4))' } : undefined}>
              <path d="M2 22l1-1h3l9-9" />
              <path d="M15 12l-8.5 8.5" />
              <path d="M16 6l2-2a1.5 1.5 0 013 0l-1 1a1.5 1.5 0 010 3l-2 2" />
              <path d="M12 8l4 4" />
            </svg>
          </button>

          {/* Popover */}
          {pickerOpen && (
            <div
              ref={popoverRef}
              className="absolute bottom-full mb-2 right-0 glass-playful rounded-2xl shadow-2xl animate-bounce-in"
              style={{ zIndex: 1002 }}
            >
              <FancyColorPicker
                selectedColor={isTransparent ? '#000000' : color}
                onSelectColor={onChange}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { PRESETS as PALETTE };
