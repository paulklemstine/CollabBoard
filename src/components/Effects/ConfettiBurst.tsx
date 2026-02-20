import { useEffect, useState } from 'react';

const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#6366f1', '#14b8a6'];
const PIECE_COUNT = 30;

interface ConfettiBurstProps {
  trigger: boolean;
  onComplete?: () => void;
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function ConfettiBurst({ trigger, onComplete }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Array<{
    id: number;
    color: string;
    tx: string;
    ty: string;
    tr: string;
    size: number;
  }>>([]);

  useEffect(() => {
    if (!trigger) return;

    const newPieces = Array.from({ length: PIECE_COUNT }, (_, i) => ({
      id: i,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      tx: `${randomBetween(-120, 120)}px`,
      ty: `${randomBetween(-160, -20)}px`,
      tr: `${randomBetween(-360, 360)}deg`,
      size: randomBetween(4, 8),
    }));

    setPieces(newPieces);

    const timer = setTimeout(() => {
      setPieces([]);
      onComplete?.();
    }, 900);

    return () => clearTimeout(timer);
  }, [trigger, onComplete]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none" style={{ position: 'relative', width: 0, height: 0 }}>
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            backgroundColor: p.color,
            '--tx': p.tx,
            '--ty': p.ty,
            '--tr': p.tr,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
