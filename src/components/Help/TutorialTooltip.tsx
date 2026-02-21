import { useEffect, useState, useRef, useCallback } from 'react';
import type { TutorialStep } from '../../utils/tutorialSteps';

interface TutorialTooltipProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onKeep: () => void;
  onCleanup: () => void;
}

export function TutorialTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onKeep,
  onCleanup,
}: TutorialTooltipProps) {
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isFinalStep = step.id === 'complete';
  const isFirstStep = stepIndex === 0;

  const clampPosition = useCallback((top: number, left: number) => {
    const el = tooltipRef.current;
    const w = el?.offsetWidth ?? 360;
    const h = el?.offsetHeight ?? 220;
    const margin = 12;

    // Clamp so the tooltip stays fully on-screen
    const clampedLeft = Math.max(margin + w / 2, Math.min(left, window.innerWidth - margin - w / 2));
    const clampedTop = Math.max(margin + h, Math.min(top, window.innerHeight - margin));
    return { top: clampedTop, left: clampedLeft };
  }, []);

  useEffect(() => {
    const update = () => {
      if (!step.targetSelector) {
        setPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
        return;
      }

      const el = document.querySelector(step.targetSelector);
      if (!el) {
        setPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2,
        });
        return;
      }

      const rect = el.getBoundingClientRect();
      const pos = step.tooltipPosition;
      const gap = 20;

      let top = 0;
      let left = 0;

      if (pos === 'top') {
        top = rect.top - gap;
        left = rect.left + rect.width / 2;
      } else if (pos === 'bottom') {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2;
      } else if (pos === 'left') {
        top = rect.top + rect.height / 2;
        left = rect.left - gap;
      } else {
        top = rect.top + rect.height / 2;
        left = rect.right + gap;
      }

      setPosition(clampPosition(top, left));
    };

    update();
    // Re-measure after first render so we have tooltip dimensions
    requestAnimationFrame(update);
    window.addEventListener('resize', update);
    const interval = setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(interval);
    };
  }, [step.targetSelector, step.tooltipPosition, clampPosition]);

  // Always use translate(-50%, -100%) so tooltip is above + centered on the computed point
  const getTransform = () => {
    if (!step.targetSelector) return 'translate(-50%, -50%)';
    return 'translate(-50%, -100%)';
  };

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9001] animate-float-up"
      style={{
        top: position.top,
        left: position.left,
        transform: getTransform(),
        pointerEvents: 'auto',
        maxWidth: 'min(360px, 90vw)',
      }}
    >
      <div className="glass-playful rounded-2xl shadow-2xl p-5">
        {/* Step counter */}
        <div className="flex items-center gap-1.5 mb-3">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex
                  ? 'w-6 bg-violet-500'
                  : i < stepIndex
                    ? 'w-1.5 bg-violet-300'
                    : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
          <span className="ml-auto text-xs text-gray-400 font-medium">
            {stepIndex + 1} of {totalSteps}
          </span>
        </div>

        {/* Content */}
        <h3 className="text-base font-bold text-gray-800 mb-1.5">{step.title}</h3>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {isFinalStep ? (
            <>
              <button
                onClick={onKeep}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-md"
              >
                Keep objects
              </button>
              <button
                onClick={onCleanup}
                className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold bg-white/60 text-gray-700 hover:bg-white/80 transition-colors border border-gray-200"
              >
                Clean up
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onNext}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-md"
              >
                {isFirstStep ? "Let's go!" : 'Next'}
              </button>
              <button
                onClick={onSkip}
                className="px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
              >
                Skip tour
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
