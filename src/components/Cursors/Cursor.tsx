interface CursorProps {
  x: number;
  y: number;
  name: string;
  color: string;
}

export function Cursor({ x, y, name, color }: CursorProps) {
  return (
    <div
      data-testid="cursor"
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill={color}
        style={{ filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))' }}
      >
        <path d="M5 3l14 8-7 2-3 7z" />
      </svg>
      <span
        style={{
          background: color,
          color: '#fff',
          padding: '2px 6px',
          borderRadius: '4px',
          fontSize: '12px',
          marginLeft: '16px',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  );
}
