import { useState, useRef, useCallback } from 'react';
import type { ShapeType } from '../../types/board';

interface ShapeDrawerProps {
  selectedColor: string;
  onAddShape: (shapeType: ShapeType, color: string) => void;
  onAddFrame: () => void;
}

export function ShapeDrawer({ selectedColor, onAddShape, onAddFrame }: ShapeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (closeTimeout.current) { clearTimeout(closeTimeout.current); closeTimeout.current = null; }
    setIsOpen(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimeout.current = setTimeout(() => setIsOpen(false), 200);
  }, []);

  const shapes: { type: ShapeType | 'frame'; icon: React.ReactNode; label: string; color: string; action: () => void }[] = [
    {
      type: 'rect',
      label: 'Rectangle',
      color: '#6366f1',
      action: () => onAddShape('rect', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
        </svg>
      ),
    },
    {
      type: 'circle',
      label: 'Circle',
      color: '#ec4899',
      action: () => onAddShape('circle', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>
      ),
    },
    {
      type: 'triangle',
      label: 'Triangle',
      color: '#10b981',
      action: () => onAddShape('triangle', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,2 22,22 2,22" />
        </svg>
      ),
    },
    {
      type: 'diamond',
      label: 'Diamond',
      color: '#8b5cf6',
      action: () => onAddShape('diamond', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,2 22,12 12,22 2,12" />
        </svg>
      ),
    },
    {
      type: 'pentagon',
      label: 'Pentagon',
      color: '#f59e0b',
      action: () => onAddShape('pentagon', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,2 22.5,9.5 19,21 5,21 1.5,9.5" />
        </svg>
      ),
    },
    {
      type: 'hexagon',
      label: 'Hexagon',
      color: '#06b6d4',
      action: () => onAddShape('hexagon', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,2 21,7 21,17 12,22 3,17 3,7" />
        </svg>
      ),
    },
    {
      type: 'octagon',
      label: 'Octagon',
      color: '#ef4444',
      action: () => onAddShape('octagon', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="8,2 16,2 22,8 22,16 16,22 8,22 2,16 2,8" />
        </svg>
      ),
    },
    {
      type: 'star',
      label: 'Star',
      color: '#f97316',
      action: () => onAddShape('star', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="12,2 14.9,8.6 22,9.3 16.8,14 18.2,21 12,17.5 5.8,21 7.2,14 2,9.3 9.1,8.6" />
        </svg>
      ),
    },
    {
      type: 'arrow',
      label: 'Arrow',
      color: '#3b82f6',
      action: () => onAddShape('arrow', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
          <polygon points="2,8 14,8 14,3 22,12 14,21 14,16 2,16" />
        </svg>
      ),
    },
    {
      type: 'cross',
      label: 'Cross',
      color: '#14b8a6',
      action: () => onAddShape('cross', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <polygon points="8,2 16,2 16,8 22,8 22,16 16,16 16,22 8,22 8,16 2,16 2,8 8,8" />
        </svg>
      ),
    },
    {
      type: 'line',
      label: 'Line',
      color: '#78716c',
      action: () => onAddShape('line', selectedColor),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="4" y1="20" x2="20" y2="4" />
        </svg>
      ),
    },
    {
      type: 'frame',
      label: 'Frame',
      color: '#a855f7',
      action: () => onAddFrame(),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="6 3" />
        </svg>
      ),
    },
  ];

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        className="btn-lift px-3.5 py-2.5 rounded-xl text-sm font-bold text-indigo-700 transition-all duration-200"
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

      {/* Drawer */}
      {isOpen && (
        <div
          className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 animate-bounce-in"
          style={{ zIndex: 1001 }}
        >
          <div className="glass-playful rounded-2xl shadow-2xl p-3 grid grid-cols-4 gap-2.5" style={{ width: 340 }}>
            {shapes.map((shape) => (
              <button
                key={shape.type}
                onClick={() => { shape.action(); setIsOpen(false); }}
                className="flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-xl transition-all duration-200 hover:scale-105"
                style={{
                  background: `linear-gradient(135deg, ${shape.color}15 0%, ${shape.color}25 100%)`,
                  border: `1.5px solid ${shape.color}40`,
                  color: shape.color,
                }}
                title={`Add ${shape.label}`}
              >
                {shape.icon}
                <span className="text-xs font-semibold">{shape.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
