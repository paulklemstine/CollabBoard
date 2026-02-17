import { useState } from 'react';
import type { ShapeType } from '../../types/board';

interface ShapeDrawerProps {
  selectedColor: string;
  onAddShape: (shapeType: ShapeType, color: string) => void;
  onAddFrame: () => void;
}

export function ShapeDrawer({ selectedColor, onAddShape, onAddFrame }: ShapeDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

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
      type: 'frame',
      label: 'Frame',
      color: '#8b5cf6',
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
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
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
          <div className="glass-playful rounded-2xl shadow-2xl p-3 flex gap-2">
            {shapes.map((shape) => (
              <button
                key={shape.type}
                onClick={shape.action}
                className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 hover:scale-105"
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
