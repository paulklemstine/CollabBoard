import { useState, useCallback, useRef, useEffect } from 'react';
import { TUTORIAL_STEPS } from '../utils/tutorialSteps';
import type { TutorialStep } from '../utils/tutorialSteps';
import type { StageTransform } from '../components/Board/Board';
import { screenToWorld } from '../utils/coordinates';
import { addObject, batchDeleteObjects } from '../services/boardService';
import type { StickyNote, Shape, Frame, Sticker, Connector, TextObject } from '../types/board';

const STORAGE_KEY = 'flowspace-tutorial-completed';

export interface UseTutorialReturn {
  isActive: boolean;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  startTutorial: () => void;
  nextStep: () => void;
  skipTutorial: () => void;
  finishTutorial: () => void;
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

  const worldCenter = (xFrac: number, yFrac: number) =>
    screenToWorld(
      window.innerWidth * xFrac,
      window.innerHeight * yFrac,
      stageTransformRef.current,
    );

  const createTutorialSticky = useCallback(async () => {
    const id = generateId();
    const pos = worldCenter(0.3, 0.45);
    const obj: StickyNote = {
      id,
      type: 'sticky',
      x: pos.x,
      y: pos.y,
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
  }, [boardId, userId]);

  const createTutorialText = useCallback(async () => {
    const id = generateId();
    const pos = worldCenter(0.5, 0.3);
    const obj: TextObject = {
      id,
      type: 'text',
      x: pos.x,
      y: pos.y,
      width: 260,
      height: 50,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      text: 'Welcome to my board!',
      fontSize: 28,
      fontFamily: "'Inter', sans-serif",
      fontWeight: 'bold',
      fontStyle: 'normal',
      textAlign: 'center',
      color: '#7c3aed',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
  }, [boardId, userId]);

  const createTutorialShape = useCallback(async () => {
    const id = generateId();
    const pos = worldCenter(0.65, 0.45);
    const obj: Shape = {
      id,
      type: 'shape',
      shapeType: 'star',
      x: pos.x,
      y: pos.y,
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
  }, [boardId, userId]);

  const createTutorialFrame = useCallback(async () => {
    const id = generateId();
    const pos = worldCenter(0.45, 0.38);
    const obj: Frame = {
      id,
      type: 'frame',
      x: pos.x,
      y: pos.y,
      width: 420,
      height: 300,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      title: 'My Section',
      color: 'rgba(250, 245, 255, 0.3)',
      borderColor: '#a78bfa',
      textColor: '#581c87',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
  }, [boardId, userId]);

  const createTutorialSticker = useCallback(async () => {
    const id = generateId();
    const pos = worldCenter(0.55, 0.55);
    const obj: Sticker = {
      id,
      type: 'sticker',
      x: pos.x,
      y: pos.y,
      width: 80,
      height: 80,
      rotation: -8,
      createdBy: userId,
      updatedAt: Date.now(),
      emoji: '🚀',
    };
    await addObject(boardId, obj);
    createdIdsRef.current.push(id);
  }, [boardId, userId]);

  const createTutorialConnector = useCallback(async () => {
    // Connect the sticky (index 0) and the shape (index 2)
    if (createdIdsRef.current.length < 3) return;
    const id = generateId();
    const fromId = createdIdsRef.current[0]; // sticky
    const toId = createdIdsRef.current[2]; // shape
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
      case 'create-text':
        await createTutorialText();
        break;
      case 'create-shape':
        await createTutorialShape();
        break;
      case 'create-frame':
        await createTutorialFrame();
        break;
      case 'create-sticker':
        await createTutorialSticker();
        break;
      case 'create-connector':
        await createTutorialConnector();
        break;
      default:
        break;
    }
  }, [createTutorialSticky, createTutorialText, createTutorialShape, createTutorialFrame, createTutorialSticker, createTutorialConnector]);

  const startTutorial = useCallback(() => {
    createdIdsRef.current = [];
    setCurrentStepIndex(0);
    setIsActive(true);
  }, []);

  const nextStep = useCallback(() => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex >= TUTORIAL_STEPS.length) {
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

  const close = useCallback(async () => {
    setIsActive(false);
    setCurrentStepIndex(0);
    localStorage.setItem(STORAGE_KEY, 'true');
    setHasCompleted(true);
    await cleanupObjects();
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
    skipTutorial: close,
    finishTutorial: close,
    hasCompleted,
  };
}
