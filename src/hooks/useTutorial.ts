import { useState, useCallback, useRef, useEffect } from 'react';
import { TUTORIAL_STEPS } from '../utils/tutorialSteps';
import type { TutorialStep } from '../utils/tutorialSteps';
import type { StageTransform } from '../components/Board/Board';
import { screenToWorld } from '../utils/coordinates';
import { addObject, batchDeleteObjects } from '../services/boardService';
import type { StickyNote, Shape, Connector } from '../types/board';

const STORAGE_KEY = 'flowspace-tutorial-completed';

export interface UseTutorialReturn {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  skipTutorial: () => void;
  cleanupAndClose: (keep: boolean) => void;
  hasCompleted: boolean;
}

export function useTutorial(
  boardId: string,
  userId: string,
  stageTransform: StageTransform,
): UseTutorialReturn {
  const [isActive, setIsActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const createdIdsRef = useRef<string[]>([]);
  const stageTransformRef = useRef(stageTransform);
  stageTransformRef.current = stageTransform;

  const currentStep = isActive ? (TUTORIAL_STEPS[currentStepIndex] ?? null) : null;

  const generateId = () => crypto.randomUUID();

  const createTutorialSticky = useCallback(async (): Promise<string> => {
    const id = generateId();
    const center = screenToWorld(
      window.innerWidth * 0.35,
      window.innerHeight * 0.4,
      stageTransformRef.current,
    );
    const obj: StickyNote = {
      id,
      type: 'sticky',
      x: center.x,
      y: center.y,
      width: 180,
      height: 180,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      text: 'My first idea!',
      color: '#fef08a',
      textColor: '#1e293b',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
    return id;
  }, [boardId, userId]);

  const createTutorialShape = useCallback(async (): Promise<string> => {
    const id = generateId();
    const center = screenToWorld(
      window.innerWidth * 0.65,
      window.innerHeight * 0.4,
      stageTransformRef.current,
    );
    const obj: Shape = {
      id,
      type: 'shape',
      shapeType: 'circle',
      x: center.x,
      y: center.y,
      width: 140,
      height: 140,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      color: '#c4b5fd',
      strokeColor: '#7c3aed',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
    return id;
  }, [boardId, userId]);

  const createTutorialConnector = useCallback(async () => {
    // Connect the first two tutorial objects (sticky and shape)
    if (createdIdsRef.current.length < 2) return;
    const id = generateId();
    const fromId = createdIdsRef.current[0];
    const toId = createdIdsRef.current[1];
    const obj: Connector = {
      id,
      type: 'connector',
      fromId,
      toId,
      style: 'curved',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      endArrow: true,
      startArrow: false,
      strokeWidth: 3,
      color: '#818cf8',
      lineType: 'solid',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
  }, [boardId, userId]);

  const executeStepAction = useCallback(async (step: TutorialStep) => {
    switch (step.action) {
      case 'create-sticky':
        await createTutorialSticky();
        break;
      case 'create-shape':
        await createTutorialShape();
        break;
      case 'create-connector':
        await createTutorialConnector();
        break;
      default:
        break;
    }
  }, [createTutorialSticky, createTutorialShape, createTutorialConnector]);

  const startTutorial = useCallback(() => {
    createdIdsRef.current = [];
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= TUTORIAL_STEPS.length) {
      // Last step — don't auto-close, let user choose keep/cleanup
      return;
    }
    setCurrentStepIndex(nextIndex);
  }, [currentStepIndex]);

  const cleanupObjects = useCallback(async () => {
    if (createdIdsRef.current.length > 0) {
      await batchDeleteObjects(boardId, createdIdsRef.current);
      createdIdsRef.current = [];
    }
  }, [boardId]);

  const skipTutorial = useCallback(async () => {
    setIsActive(false);
    setCurrentStepIndex(0);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompleted(true);
    await cleanupObjects();
  }, [cleanupObjects]);

  const cleanupAndClose = useCallback(async (keep: boolean) => {
    setIsActive(false);
    setCurrentStepIndex(0);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompleted(true);
    if (!keep) {
      await cleanupObjects();
    } else {
      createdIdsRef.current = [];
    }
  }, [cleanupObjects]);

  // Execute step action when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;
    executeStepAction(currentStep);
  }, [isActive, currentStepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps: TUTORIAL_STEPS.length,
    startTutorial,
    nextStep,
    skipTutorial,
    cleanupAndClose,
    hasCompleted,
  };
}
