import type { TutorialStep } from '../../utils/tutorialSteps';

interface TutorialTooltipProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export function TutorialTooltip({
  step,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onFinish,
}: TutorialTooltipProps) {
  const isFinalStep = step.id === 'complete';
  const isFirstStep = stepIndex === 0;

  return (
    <div
      className="fixed z-[9001] animate-float-up"
      style={{
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'auto',
        maxWidth: 'min(400px, 90vw)',
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
            <button
              onClick={onFinish}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-violet-500 text-white hover:bg-violet-600 transition-colors shadow-md"
            >
              Finish
            </button>
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
