import { useSmoothedPosition } from '../../hooks/useSmoothedPosition';

interface CursorProps {
  x: number;
  y: number;
  name: string;
  color: string;
}

export function Cursor({ x, y, name, color }: CursorProps) {
  // Use predictive interpolation for buttery-smooth cursor movement
  const [smoothX, smoothY] = useSmoothedPosition(x, y, {
    smoothingFactor: 0.2,  // Responsive but smooth
    predictionFactor: 0.4, // Moderate velocity prediction
    snapInitial: true,     // No animation on first render
  });

  return (
    <div
      data-testid="cursor"
      style={{
        position: 'absolute',
        left: `${smoothX}px`,
        top: `${smoothY}px`,
        pointerEvents: 'none',
        zIndex: 1000,
        // Removed CSS transition - now using JS interpolation for smoother control
        willChange: 'transform', // Performance optimization
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={color}
        style={{
          filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.3)) drop-shadow(0 0 6px ${color}60)`,
        }}
      >
        <path d="M5 3l14 8-7 2-3 7z" />
      </svg>
      <span
        style={{
          background: `linear-gradient(135deg, ${color}, ${color}dd)`,
          color: '#fff',
          padding: '3px 8px',
          borderRadius: '8px',
          fontSize: '11px',
          fontWeight: 600,
          fontFamily: "'Inter', sans-serif",
          marginLeft: '14px',
          whiteSpace: 'nowrap',
          boxShadow: `0 2px 8px ${color}40`,
          letterSpacing: '0.02em',
        }}
      >
        {name}
      </span>
    </div>
  );
}
