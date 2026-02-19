import { useSmoothedPosition } from '../../hooks/useSmoothedPosition';

interface CursorProps {
  x: number;
  y: number;
  name: string;
  color: string;
  /** When set, cursor is offscreen and should render as a directional arrow */
  offscreen?: { angle: number };
}

export function Cursor({ x, y, name, color, offscreen }: CursorProps) {
  // Use predictive interpolation for buttery-smooth cursor movement
  const [smoothX, smoothY] = useSmoothedPosition(x, y, {
    smoothingFactor: 0.2,  // Responsive but smooth
    predictionFactor: 0.4, // Moderate velocity prediction
    snapInitial: true,     // No animation on first render
  });

  if (offscreen) {
    // Convert angle to degrees for CSS rotation (arrow points right at 0deg)
    const deg = (offscreen.angle * 180) / Math.PI;

    return (
      <div
        data-testid="cursor"
        data-offscreen="true"
        style={{
          position: 'absolute',
          left: `${smoothX}px`,
          top: `${smoothY}px`,
          pointerEvents: 'none',
          zIndex: 1000,
          willChange: 'transform',
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Directional arrow pointing toward offscreen peer */}
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          style={{
            transform: `rotate(${deg}deg)`,
            filter: `drop-shadow(0 1px 3px rgba(0,0,0,0.3)) drop-shadow(0 0 6px ${color}60)`,
          }}
        >
          <polygon
            points="28,14 6,2 10,14 6,26"
            fill={color}
          />
        </svg>
        <span
          style={{
            display: 'block',
            background: `linear-gradient(135deg, ${color}, ${color}dd)`,
            color: '#fff',
            padding: '2px 6px',
            borderRadius: '6px',
            fontSize: '10px',
            fontWeight: 600,
            fontFamily: "'Inter', sans-serif",
            whiteSpace: 'nowrap',
            boxShadow: `0 2px 8px ${color}40`,
            letterSpacing: '0.02em',
            textAlign: 'center',
            marginTop: '2px',
          }}
        >
          {name}
        </span>
      </div>
    );
  }

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
