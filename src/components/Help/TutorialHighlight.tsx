import { useState, useEffect } from 'react';

interface TutorialHighlightProps {
  selector: string | null;
}

export function TutorialHighlight({ selector }: TutorialHighlightProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }

    const update = () => {
      const el = document.querySelector(selector);
      if (el) {
        setRect(el.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    // Initial + poll for position changes (drawers animating in, etc.)
    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [selector]);

  if (!rect) return null;

  const pad = 4;

  return (
    <div
      style={{
        position: 'fixed',
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        borderRadius: 10,
        border: '2px solid rgba(124, 58, 237, 0.7)',
        boxShadow: '0 0 12px rgba(124, 58, 237, 0.4), inset 0 0 8px rgba(124, 58, 237, 0.1)',
        pointerEvents: 'none',
        zIndex: 9001,
        transition: 'left 500ms ease-in-out, top 500ms ease-in-out, width 300ms ease, height 300ms ease, opacity 300ms ease',
        animation: 'tutorial-highlight-pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}
