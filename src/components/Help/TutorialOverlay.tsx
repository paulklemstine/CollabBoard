import type { TutorialStep } from '../../utils/tutorialSteps';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  isAnimating: boolean;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onFinish: () => void;
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
    </>
  );
}
