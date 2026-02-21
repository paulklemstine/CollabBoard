interface TutorialCursorProps {
  x: number;
  y: number;
  visible: boolean;
  clicking: boolean;
}

export function TutorialCursor({ x, y, visible, clicking }: TutorialCursorProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 9002,
        pointerEvents: 'none',
        transition: 'left 600ms ease-in-out, top 600ms ease-in-out',
      }}
    >
      {/* Arrow cursor */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
      >
        <path
          d="M5 3l14 8-7 2-3 7z"
          fill="white"
          stroke="#7c3aed"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {/* Click ripple */}
      {clicking && (
        <div
          style={{
            position: 'absolute',
            top: 3,
            left: 5,
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'rgba(124, 58, 237, 0.3)',
            animation: 'cursor-click-ripple 400ms ease-out forwards',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
    </div>
  );
}
