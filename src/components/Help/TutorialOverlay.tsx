import type { TutorialStep } from '../../utils/tutorialSteps';
import { TutorialSpotlight } from './TutorialSpotlight';
import { TutorialTooltip } from './TutorialTooltip';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export function TutorialOverlay({
  step,
  stepIndex,
  totalSteps,
  onNext,
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
        onNext={onNext}
        onSkip={onSkip}
        onFinish={onFinish}
      />
    </>
  );
}
