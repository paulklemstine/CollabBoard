import { useEffect, useState } from 'react';

interface TutorialSpotlightProps {
  targetSelector: string | null;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = 8;
const RADIUS = 14;

export function TutorialSpotlight({ targetSelector }: TutorialSpotlightProps) {
  const [target, setTarget] = useState<TargetRect | null>(null);

  useEffect(() => {
    if (!targetSelector) {
      setTarget(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTarget({
          x: rect.left - PADDING,
          y: rect.top - PADDING,
          width: rect.width + PADDING * 2,
          height: rect.height + PADDING * 2,
        });
      } else {
        setTarget(null);
      }
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update);
    const interval = setInterval(update, 500);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      clearInterval(interval);
    };
  }, [targetSelector]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[9000] pointer-events-none">
      {/* Glow ring around the target */}
      <div
        className="absolute spotlight-glow"
        style={{
          left: target.x,
          top: target.y,
          width: target.width,
          height: target.height,
          borderRadius: RADIUS,
          transition: 'all 500ms cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
      {/* Sparkle dots at corners */}
      {[
        { cx: target.x - 4, cy: target.y - 4 },
        { cx: target.x + target.width + 4, cy: target.y - 4 },
        { cx: target.x - 4, cy: target.y + target.height + 4 },
        { cx: target.x + target.width + 4, cy: target.y + target.height + 4 },
      ].map((pos, i) => (
        <div
          key={i}
          className="absolute rounded-full spotlight-sparkle"
          style={{
            left: pos.cx - 3,
            top: pos.cy - 3,
            width: 6,
            height: 6,
            background: 'white',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
