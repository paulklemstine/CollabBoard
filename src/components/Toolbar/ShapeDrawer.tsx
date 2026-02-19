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
}

export function ShapeDrawer({
  fillColor, strokeColor, borderColor,
  onFillColorChange, onStrokeColorChange, onBorderColorChange,
  onAddShape, onAddFrame,
}: ShapeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'shapes' | 'colors'>('shapes');
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 300);
  }, []);

  const shapes: { type: ShapeType | 'frame'; icon: React.ReactNode; label: string; uiColor: string; action: () => void }[] = [
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
      type: 'pentagon', label: 'Pentagon', uiColor: '#f59e0b',
      action: () => onAddShape('pentagon'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 22.5,9.5 19,21 5,21 1.5,9.5" /></svg>,
    },
    {
      type: 'hexagon', label: 'Hexagon', uiColor: '#06b6d4',
      action: () => onAddShape('hexagon'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" /></svg>,
    },
    {
      type: 'octagon', label: 'Octagon', uiColor: '#ef4444',
      action: () => onAddShape('octagon'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" /></svg>,
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
      type: 'line', label: 'Line', uiColor: '#78716c',
      action: () => onAddShape('line'),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="4" y1="20" x2="20" y2="4" /></svg>,
    },
    {
      type: 'frame', label: 'Frame', uiColor: '#a855f7',
      action: () => onAddFrame(),
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="6 3" /></svg>,
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
          onClick={() => { setIsOpen((o) => !o); setTab('shapes'); }}
          className="btn-lift px-3.5 py-2.5 rounded-l-xl text-sm font-bold text-indigo-700 transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)',
            boxShadow: '0 2px 10px rgba(99, 102, 241, 0.25)',
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
          className="btn-lift px-1.5 py-2.5 rounded-r-xl text-sm text-indigo-600 transition-all duration-200 border-l border-indigo-300/30 flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%)',
          }}
          title="Shape colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points={isOpen && tab === 'colors' ? '6 15 12 9 18 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
      </div>

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          {tab === 'shapes' ? (
            <div className="glass-playful rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2.5" style={{ width: 340 }}>
              {shapes.map((shape) => (
                <button
                  key={shape.type}
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
                  {borderColor !== 'transparent' && (
                    <rect
                      x="2" y="2" width="56" height="56" rx="10"
                      fill="none"
                      stroke={borderColor}
                      strokeWidth="2"
                      strokeDasharray="4 3"
                    />
                  )}
                </svg>
              </div>

              <ColorPanel label="Fill" color={fillColor} onChange={onFillColorChange} showTransparent />
              <ColorPanel label="Stroke" color={strokeColor} onChange={onStrokeColorChange} showTransparent />
              <ColorPanel label="Border" color={borderColor} onChange={onBorderColorChange} showTransparent />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
