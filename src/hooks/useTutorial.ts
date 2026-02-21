import { useState, useCallback, useRef, useEffect } from 'react';
import { TUTORIAL_STEPS } from '../utils/tutorialSteps';
import type { TutorialStep } from '../utils/tutorialSteps';
import type { StageTransform } from '../components/Board/Board';
import { screenToWorld, worldToScreen } from '../utils/coordinates';
import { batchDeleteObjects } from '../services/boardService';
import { getAnimation, runAnimation } from '../utils/tutorialAnimations';
import type { AnimationCallbacks } from '../utils/tutorialAnimations';

const STORAGE_KEY = 'flowspace-tutorial-completed';

export interface SelectionCallbacks {
  selectObject: (id: string) => void;
  selectMultiple: (ids: Set<string>) => void;
  clearSelection: () => void;
}

export interface UseTutorialReturn {
  isActive: boolean;
  isAnimating: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
  hasCompleted: boolean;
  openDrawer: string | null;
  openDrawerTab: string | undefined;
  cursorPos: { x: number; y: number; clicking: boolean } | null;
  highlightSelector: string | null;
}

export function useTutorial(
  boardId: string,
  userId: string,
  stageTransform: StageTransform,
  selectionCallbacks?: SelectionCallbacks,
): UseTutorialReturn {
  const [isActive, setIsActive] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });
  const [drawerState, setDrawerState] = useState<{ drawer: string | null; tab?: string }>({ drawer: null });
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number; clicking: boolean } | null>(null);
  const [highlightSelector, setHighlightSelector] = useState<string | null>(null);

  const createdIdsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const stageTransformRef = useRef(stageTransform);
  stageTransformRef.current = stageTransform;

  const selectionRef = useRef(selectionCallbacks);
  selectionRef.current = selectionCallbacks;

  const currentStep = isActive ? (TUTORIAL_STEPS[currentStepIndex] ?? null) : null;

  const worldCenter = useCallback((xFrac: number, yFrac: number) =>
    screenToWorld(
      window.innerWidth * xFrac,
      window.innerHeight * yFrac,
      stageTransformRef.current,
    ), []);

  const handleDrawerChange = useCallback((drawer: string | null, tab?: string) => {
    setDrawerState({ drawer, tab });
  }, []);

  const handleCursorChange = useCallback((pos: { x: number; y: number; clicking: boolean } | null) => {
    setCursorPos(pos);
  }, []);

  const handleHighlightChange = useCallback((selector: string | null) => {
    setHighlightSelector(selector);
  }, []);

  const handleWorldToScreen = useCallback((worldX: number, worldY: number) => {
    return worldToScreen(worldX, worldY, stageTransformRef.current);
  }, []);

  const handleSelect = useCallback((id: string) => {
    selectionRef.current?.selectObject(id);
  }, []);

  const handleMultiSelect = useCallback((ids: string[]) => {
    selectionRef.current?.selectMultiple(new Set(ids));
  }, []);

  const handleClearSelection = useCallback(() => {
    selectionRef.current?.clearSelection();
  }, []);

  const abortAnimation = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setDrawerState({ drawer: null });
    setCursorPos(null);
    setHighlightSelector(null);
    selectionRef.current?.clearSelection();
  }, []);

  const cleanupObjects = useCallback(async () => {
    if (createdIdsRef.current.length > 0) {
      const ids = [...createdIdsRef.current];
      createdIdsRef.current = [];
      await batchDeleteObjects(boardId, ids);
    }
  }, [boardId]);

  const startTutorial = useCallback(() => {
    abortAnimation();
    createdIdsRef.current = [];
    setCurrentStepIndex(0);
    setIsActive(true);
    setIsAnimating(false);
  }, [abortAnimation]);

  const close = useCallback(async () => {
    abortAnimation();
    setIsActive(false);
    setIsAnimating(false);
    setCurrentStepIndex(0);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompleted(true);
    await cleanupObjects();
  }, [abortAnimation, cleanupObjects]);

  const nextStep = useCallback(async () => {
    abortAnimation();
    await cleanupObjects();
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= TUTORIAL_STEPS.length) {
      return;
    }
    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex, abortAnimation, cleanupObjects]);

  const prevStep = useCallback(async () => {
    if (currentStepIndex <= 0) return;
    abortAnimation();
    await cleanupObjects();
    setCurrentStepIndex(currentStepIndex - 1);
  }, [currentStepIndex, abortAnimation, cleanupObjects]);

  // Run animation when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;

    const { animationKey } = currentStep;
    if (!animationKey) return;

    const animation = getAnimation(animationKey);
    if (!animation) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsAnimating(true);

    const callbacks: AnimationCallbacks = {
      onDrawerChange: handleDrawerChange,
      onCursorChange: handleCursorChange,
      onHighlightChange: handleHighlightChange,
      worldToScreen: handleWorldToScreen,
      onSelect: handleSelect,
      onMultiSelect: handleMultiSelect,
      onClearSelection: handleClearSelection,
    };

    (async () => {
      try {
        const newIds = await runAnimation(animation, boardId, userId, worldCenter, controller.signal, callbacks);
        createdIdsRef.current.push(...newIds);
      } catch {
        // AbortError — animation was cancelled, no-op
      } finally {
        setIsAnimating(false);
      }
    })();
  }, [isActive, currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive,
    isAnimating,
    currentStep,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    startTutorial,
    nextStep,
    prevStep,
    skipTutorial: close,
    finishTutorial: close,
    hasCompleted,
    openDrawer: drawerState.drawer,
    openDrawerTab: drawerState.tab,
    cursorPos,
    highlightSelector,
  };
}
