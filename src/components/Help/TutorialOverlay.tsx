import type { TutorialStep } from '../../utils/tutorialSteps';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';
import { TutorialCursor } from './TutorialCursor';
import { TutorialHighlight } from './TutorialHighlight';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  isAnimating: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
  cursorPos?: { x: number; y: number; clicking: boolean } | null;
  highlightSelector?: string | null;
}

export function TutorialOverlay({
  step,
  stepIndex,
  totalSteps,
  isAnimating,
  onNext,
  onPrev,
  onSkip,
  onFinish,
  cursorPos,
  highlightSelector,
}: TutorialOverlayProps) {
  return (
    <>
      <TutorialSpotlight targetSelector={step.targetSelector} />
      <TutorialTooltip
        step={step}
        stepIndex={stepIndex}
        totalSteps={totalSteps}
        isAnimating={isAnimating}
        onNext={onNext}
        onPrev={onPrev}
        onSkip={onSkip}
        onFinish={onFinish}
      />
      <TutorialHighlight selector={highlightSelector ?? null} />
      {cursorPos && (
        <TutorialCursor
          x={cursorPos.x}
          y={cursorPos.y}
          visible={true}
          clicking={cursorPos.clicking}
        />
      )}
    </>
  );
}
