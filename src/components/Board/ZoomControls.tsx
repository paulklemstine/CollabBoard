interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
}

export function ZoomControls({ scale, onZoomIn, onZoomOut, onResetZoom }: ZoomControlsProps) {
  const percentage = Math.round(scale * 100);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        pointerEvents: 'auto',
      }}
      className="flex items-center gap-0.5 glass rounded-xl shadow-lg p-1 animate-float-up"
    >
      <button
        onClick={onZoomOut}
        className="btn-lift w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-white/60 transition-colors text-lg font-bold"
        title="Zoom out"
        aria-label="Zoom out"
      >
        -
      </button>
      <button
        onClick={onResetZoom}
        className="btn-lift px-2 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-white/60 transition-colors text-xs font-semibold min-w-[3rem]"
        title="Reset zoom"
        aria-label="Reset zoom"
      >
        {percentage}%
      </button>
      <button
        onClick={onZoomIn}
        className="btn-lift w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-white/60 transition-colors text-lg font-bold"
        title="Zoom in"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
