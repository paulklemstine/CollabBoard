import { useRef, useEffect } from 'react';

interface WebcamPanelProps {
  label: string;
  stream: MediaStream | null;
  isMine: boolean;
  onClose?: () => void;
}

export function WebcamPanel({ label, stream, isMine, onClose }: WebcamPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, [stream]);

  return (
    <div
      className="relative rounded-xl overflow-hidden shadow-lg backdrop-blur-md bg-gray-900/80 border border-white/10 transition-shadow hover:shadow-xl"
      style={{ width: 180, height: 135 + 28 }}
    >
      {/* Video area */}
      <div className="relative" style={{ width: 180, height: 135 }}>
        {stream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isMine}
            className="w-full h-full object-cover rounded-t-xl"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 rounded-t-xl bg-gray-900">
            <span className="text-3xl mb-1">📷</span>
            <span className="text-xs">Offline</span>
          </div>
        )}

        {/* Close button (own webcam only) — always visible */}
        {isMine && onClose && (
          <button
            onClick={onClose}
            className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs transition-colors shadow-md"
            title="Stop webcam"
          >
            ✕
          </button>
        )}
      </div>

      {/* Name label */}
      <div
        className="flex items-center px-2 text-gray-200 text-xs font-medium truncate"
        style={{ height: 28, background: 'rgba(30, 30, 46, 0.9)' }}
      >
        {label}
      </div>
    </div>
  );
}
