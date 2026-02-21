import { useState, useRef, useCallback } from 'react';
import { ColorPanel } from './ColorPanel';
import type { ShapeType } from '../../types/board';

interface ShapeDrawerProps {
  fillColor: string;
  strokeColor: string;
  borderColor: string;
  onFillColorChange: (c: string) => void;
  onStrokeColorChange: (c: string) => void;
  onBorderColorChange: (c: string) => void;
  onAddShape: (shapeType: ShapeType) => void;
  onAddFrame: () => void;
  onAddBorderlessFrame: () => void;
  onAddSticky: () => void;
  forceOpen?: boolean;
  forceTab?: 'shapes' | 'colors';
}

export function ShapeDrawer({
  fillColor, strokeColor, borderColor: _borderColor,
  onFillColorChange, onStrokeColorChange, onBorderColorChange: _onBorderColorChange,
  onAddShape, onAddFrame, onAddBorderlessFrame, onAddSticky,
  forceOpen, forceTab,
}: ShapeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'shapes' | 'colors'>('shapes');
  const effectiveOpen = isOpen || !!forceOpen;
  const effectiveTab = forceOpen && forceTab ? forceTab : tab;
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const shapes: { type: ShapeType | 'frame' | 'borderless-frame'; icon: React.ReactNode; label: string; uiColor: string; action: () => void }[] = [
    {
      type: 'rect', label: 'Rectangle', uiColor: '#6366f1',
      action: () => onAddShape('rect'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>,
    },
    {
      type: 'circle', label: 'Circle', uiColor: '#ec4899',
      action: () => onAddShape('circle'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>,
    },
    {
      type: 'triangle', label: 'Triangle', uiColor: '#10b981',
      action: () => onAddShape('triangle'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 22,22 2,22" /></svg>,
    },
    {
      type: 'diamond', label: 'Diamond', uiColor: '#8b5cf6',
      action: () => onAddShape('diamond'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 22,12 12,22 2,12" /></svg>,
    },
    {
      type: 'hexagon', label: 'Hexagon', uiColor: '#06b6d4',
      action: () => onAddShape('hexagon'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>,
    },
    {
      type: 'star', label: 'Star', uiColor: '#f97316',
      action: () => onAddShape('star'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 14.9,8.6 22,9.3 16.8,14 18.2,21 12,17.5 5.8,21 7.2,14 2,9.3 9.1,8.6" /></svg>,
    },
    {
      type: 'arrow', label: 'Arrow', uiColor: '#3b82f6',
      action: () => onAddShape('arrow'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"><polygon points="2,8 14,8 14,3 22,12 14,21 14,16 2,16" /></svg>,
    },
    {
      type: 'cross', label: 'Cross', uiColor: '#14b8a6',
      action: () => onAddShape('cross'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="8,2 16,2 16,8 22,8 22,16 16,16 16,22 8,22 8,16 2,16 2,8 8,8" /></svg>,
    },
    {
      type: 'sticky' as ShapeType, label: 'Sticky', uiColor: '#f59e0b',
      action: () => onAddSticky(),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" /><polyline points="14 3 14 9 21 9" /></svg>,
    },
    {
      type: 'line', label: 'Line', uiColor: '#78716c',
      action: () => onAddShape('line'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4" /></svg>,
    },
    {
      type: 'frame', label: 'Frame', uiColor: '#a855f7',
      action: () => onAddFrame(),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="6 3" /></svg>,
    },
    {
      type: 'borderless-frame', label: 'Group', uiColor: '#94a3b8',
      action: () => onAddBorderlessFrame(),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" /></svg>,
    },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Split button */}
      <div className="flex items-stretch">
        <button
          data-tutorial-id="shape-tool"
          onClick={() => { setIsOpen((o) => !o); setTab('shapes'); }}
          className="btn-lift px-3.5 py-2.5 rounded-l-xl text-sm font-bold text-gray-700 hover:text-violet-600 transition-all duration-200"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
          }}
          title="Shapes"
        >
          <div className="flex items-center gap-1.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Shapes
          </div>
        </button>
        <button
          onClick={() => { setIsOpen((o) => !o); setTab('colors'); }}
          className="btn-lift px-1.5 py-2.5 rounded-r-xl text-sm text-gray-500 hover:text-violet-600 transition-all duration-200 border-l border-violet-200/60 flex items-center justify-center"
          style={{
            background: 'rgba(255, 255, 255, 0.6)',
          }}
          title="Shape colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={effectiveOpen && effectiveTab === 'colors' ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {/* Drawer */}
      {effectiveOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          {effectiveTab === 'shapes' ? (
            <div className="glass-playful rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2.5" style={{ width: 340 }}>
              {shapes.map((shape) => (
                <button
                  key={shape.type}
                  data-tutorial-id={`shape-opt-${shape.type}`}
                  onClick={() => { shape.action(); setIsOpen(false); }}
                  className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all duration-200 hover:scale-105"
                  style={{
                    background: `linear-gradient(135deg, ${shape.uiColor}15 0%, ${shape.uiColor}25 100%)`,
                    border: `1.5px solid ${shape.uiColor}40`,
                    color: shape.uiColor,
                  }}
                  title={`Add ${shape.label}`}
                >
                  {shape.icon}
                  <span className="text-xs font-semibold">{shape.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="glass-playful rounded-2xl shadow-2xl p-3 flex flex-col gap-3" style={{ width: 300 }}>
              {/* Preview */}
              <div className="flex items-center justify-center">
                <svg width="60" height="60" viewBox="0 0 60 60">
                  <rect
                    x="5" y="5" width="50" height="50" rx="8"
                    fill={fillColor === 'transparent' ? 'none' : fillColor}
                    stroke={strokeColor === 'transparent' ? 'none' : strokeColor}
                    strokeWidth="3"
                  />
                </svg>
              </div>

              <ColorPanel label="Fill" color={fillColor} onChange={onFillColorChange} showTransparent disableTransparent={strokeColor === 'transparent'} />
              <ColorPanel label="Border" color={strokeColor} onChange={onStrokeColorChange} showTransparent disableTransparent={fillColor === 'transparent'} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
