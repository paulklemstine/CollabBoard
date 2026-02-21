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
const RADIUS = 12;

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
    // Re-measure on resize/scroll
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update);
    const interval = setInterval(update, 500);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      clearInterval(interval);
    };
  }, [targetSelector]);

  return (
    <svg
      className="fixed inset-0 z-[9000] pointer-events-none spotlight-fade"
      width="100vw"
      height="100vh"
      style={{ width: '100vw', height: '100vh' }}
    >
      <defs>
        <mask id="tutorial-spotlight-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {target && (
            <rect
              x={target.x}
              y={target.y}
              width={target.width}
              height={target.height}
              rx={RADIUS}
              ry={RADIUS}
              fill="black"
              className="transition-all duration-500 ease-out"
            />
          )}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(0, 0, 0, 0.5)"
        mask="url(#tutorial-spotlight-mask)"
      />
    </svg>
  );
}
