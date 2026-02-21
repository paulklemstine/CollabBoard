import type { AnyBoardObject } from '../services/boardService';
import { addObject, updateObject } from '../services/boardService';

// --- Types ---

export type AnimationCommand =
  | { type: 'pause'; ms: number }
  | { type: 'update'; targetIndex: number; props: Record<string, unknown> }
  | { type: 'create'; obj: Partial<AnyBoardObject> & { type: string }; parentIndex?: number; fromIndex?: number; toIndex?: number }
  | { type: 'ui'; drawer: string | null; tab?: string }
  | { type: 'cursor'; target: string; click?: boolean }
  | { type: 'select'; targetIndex: number }
  | { type: 'multiselect'; targetIndices: number[] }
  | { type: 'deselect' };

export interface StepAnimation {
  commands: AnimationCommand[];
}

export interface AnimationCallbacks {
  onDrawerChange: (drawer: string | null, tab?: string) => void;
  onCursorChange: (pos: { x: number; y: number; clicking: boolean } | null) => void;
  onHighlightChange: (selector: string | null) => void;
  onSelect: (id: string) => void;
  onMultiSelect: (ids: string[]) => void;
  onClearSelection: () => void;
  worldToScreen: (worldX: number, worldY: number) => { x: number; y: number };
}

// --- Helper: abortable sleep ---

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

// --- Target resolution ---

interface ObjectRecord {
  x: number;
  y: number;
  w: number;
  h: number;
}

function resolveTarget(
  target: string,
  createdObjects: Map<number, ObjectRecord>,
  callbacks: AnimationCallbacks,
): { x: number; y: number } | null {
  if (target === 'hide') return null;

  // CSS selector: '[data-tutorial-id="..."]'
  if (target.startsWith('[')) {
    const el = document.querySelector(target);
    if (el) {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }
    return null;
  }

  // Screen fraction: 'screen:0.5,0.6'
  if (target.startsWith('screen:')) {
    const parts = target.slice(7).split(',');
    const xFrac = parseFloat(parts[0]);
    const yFrac = parseFloat(parts[1]);
    return { x: window.innerWidth * xFrac, y: window.innerHeight * yFrac };
  }

  // Object ref: 'object:0'
  if (target.startsWith('object:')) {
    const idx = parseInt(target.slice(7), 10);
    const obj = createdObjects.get(idx);
    if (obj) {
      const screenPos = callbacks.worldToScreen(obj.x + obj.w / 2, obj.y + obj.h / 2);
      return screenPos;
    }
    return null;
  }

  return null;
}

// --- Runner ---

export async function runAnimation(
  animation: StepAnimation,
  boardId: string,
  userId: string,
  worldCenter: (xFrac: number, yFrac: number) => { x: number; y: number },
  signal: AbortSignal,
  callbacks: AnimationCallbacks,
): Promise<string[]> {
  const newIds: string[] = [];
  const createdObjects = new Map<number, ObjectRecord>();

  for (const cmd of animation.commands) {
    if (signal.aborted) break;

    switch (cmd.type) {
      case 'pause':
        await sleep(cmd.ms, signal);
        break;

      case 'update': {
        const targetId = newIds[cmd.targetIndex];
        if (targetId) {
          await updateObject(boardId, targetId, cmd.props as Partial<AnyBoardObject>);
        }
        break;
      }

      case 'create': {
        const id = crypto.randomUUID();
        const w = (cmd.obj.width as number) ?? 0;
        const h = (cmd.obj.height as number) ?? 0;
        const pos = worldCenter(
          (cmd.obj.x as number) ?? 0.5,
          (cmd.obj.y as number) ?? 0.5,
        );
        const isConnector = cmd.obj.type === 'connector';
        const finalX = isConnector ? 0 : pos.x - w / 2;
        const finalY = isConnector ? 0 : pos.y - h / 2;
        const base: Record<string, unknown> = {
          ...cmd.obj,
          id,
          x: finalX,
          y: finalY,
          rotation: (cmd.obj.rotation as number) ?? 0,
          createdBy: userId,
          updatedAt: Date.now(),
        };
        if (cmd.parentIndex !== undefined && newIds[cmd.parentIndex]) {
          base.parentId = newIds[cmd.parentIndex];
        }
        if (cmd.fromIndex !== undefined && newIds[cmd.fromIndex]) {
          base.fromId = newIds[cmd.fromIndex];
        }
        if (cmd.toIndex !== undefined && newIds[cmd.toIndex]) {
          base.toId = newIds[cmd.toIndex];
        }
        await addObject(boardId, base as unknown as AnyBoardObject);
        const idx = newIds.length;
        newIds.push(id);
        // Track position for object: targets
        if (!isConnector) {
          createdObjects.set(idx, { x: finalX, y: finalY, w, h });
        }
        break;
      }

      case 'ui': {
        callbacks.onDrawerChange(cmd.drawer, cmd.tab);
        break;
      }

      case 'cursor': {
        // Highlight the target element (only for CSS selector targets)
        const isSelector = cmd.target.startsWith('[');
        callbacks.onHighlightChange(isSelector ? cmd.target : null);

        const pos = resolveTarget(cmd.target, createdObjects, callbacks);
        if (pos) {
          callbacks.onCursorChange({ x: pos.x, y: pos.y, clicking: false });
          // Wait for cursor to arrive
          await sleep(650, signal);
          // Click ripple if requested
          if (cmd.click) {
            callbacks.onCursorChange({ x: pos.x, y: pos.y, clicking: true });
            await sleep(350, signal);
            callbacks.onCursorChange({ x: pos.x, y: pos.y, clicking: false });
          }
        } else if (cmd.target === 'hide') {
          callbacks.onCursorChange(null);
          callbacks.onHighlightChange(null);
        }
        break;
      }

      case 'select': {
        const targetId = newIds[cmd.targetIndex];
        if (targetId) {
          callbacks.onSelect(targetId);
        }
        break;
      }

      case 'multiselect': {
        const ids = cmd.targetIndices
          .map((i) => newIds[i])
          .filter(Boolean);
        if (ids.length > 0) {
          callbacks.onMultiSelect(ids);
        }
        break;
      }

      case 'deselect': {
        callbacks.onClearSelection();
        break;
      }
    }
  }

  return newIds;
}

// --- Per-step animation scripts ---
// Object positions use fractional screen coords (x: 0-1, y: 0-1).
// The runner centers objects on that position (subtracts half width/height).
// All y values >= 0.5 so objects render below the tutorial tooltip panel.
// 'cursor' commands guide the user through a realistic workflow.

function stickyAnimation(): StepAnimation {
  return {
    commands: [
      // 1. Open the shapes drawer
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 800 },
      // 2. Click the Sticky option — this creates the object
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-sticky"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'sticky', x: 0.5, y: 0.6, width: 180, height: 180,
        text: 'My first idea!', color: '#fef08a', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 800 },
      // 3. Select the sticky on canvas
      { type: 'cursor', target: 'object:0', click: true },
      { type: 'select', targetIndex: 0 },
      { type: 'pause', ms: 600 },
      // 4. Move cursor over the options chevron, then open colors drawer
      { type: 'cursor', target: '[data-tutorial-id="shape-options"]', click: false },
      { type: 'pause', ms: 400 },
      { type: 'cursor', target: '[data-tutorial-id="shape-options"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'colors' },
      { type: 'pause', ms: 600 },
      // 5. Cycle colors on selected sticky
      { type: 'update', targetIndex: 0, props: { color: '#93c5fd' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#86efac' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#fda4af' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#c4b5fd' } },
      { type: 'pause', ms: 500 },
      // 6. Close drawer, settle
      { type: 'ui', drawer: null },
      { type: 'update', targetIndex: 0, props: { color: '#fef08a', text: 'My first idea!' } },
      { type: 'deselect' },
      { type: 'cursor', target: 'hide' },
    ],
  };
}

function textAnimation(): StepAnimation {
  return {
    commands: [
      // 1. Move cursor over text options chevron, then open drawer
      { type: 'cursor', target: '[data-tutorial-id="text-options"]', click: false },
      { type: 'pause', ms: 400 },
      { type: 'cursor', target: '[data-tutorial-id="text-options"]', click: true },
      { type: 'ui', drawer: 'text' },
      { type: 'pause', ms: 600 },
      // 2. Click Bold option
      { type: 'cursor', target: '[data-tutorial-id="text-opt-bold"]', click: true },
      { type: 'pause', ms: 400 },
      // 3. Click Serif font
      { type: 'cursor', target: '[data-tutorial-id="text-opt-serif"]', click: true },
      { type: 'pause', ms: 400 },
      // 4. Close drawer, then click Text button to create
      { type: 'ui', drawer: null },
      { type: 'cursor', target: '[data-tutorial-id="text-button"]', click: true },
      { type: 'create', obj: {
        type: 'text', x: 0.5, y: 0.55, width: 280, height: 50,
        text: 'Bold Title', fontSize: 32,
        fontFamily: "'Inter', sans-serif", fontWeight: 'bold', fontStyle: 'normal',
        textAlign: 'center', color: '#7c3aed',
      } },
      { type: 'pause', ms: 800 },
      // 5. Select the text on canvas
      { type: 'cursor', target: 'object:0', click: true },
      { type: 'select', targetIndex: 0 },
      { type: 'pause', ms: 500 },
      // 6. Move cursor over text options chevron, then open text drawer
      { type: 'cursor', target: '[data-tutorial-id="text-options"]', click: false },
      { type: 'pause', ms: 400 },
      { type: 'cursor', target: '[data-tutorial-id="text-options"]', click: true },
      { type: 'ui', drawer: 'text' },
      { type: 'pause', ms: 500 },
      // 7. Cycle colors and styles while selected
      { type: 'update', targetIndex: 0, props: { color: '#dc2626' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#059669' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { fontSize: 36 } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { textAlign: 'left' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { textAlign: 'right' } },
      { type: 'pause', ms: 400 },
      // Settle
      { type: 'ui', drawer: null },
      { type: 'update', targetIndex: 0, props: { color: '#7c3aed', fontSize: 32, textAlign: 'center' } },
      { type: 'deselect' },
      { type: 'cursor', target: 'hide' },
    ],
  };
}

function shapeAnimation(): StepAnimation {
  return {
    commands: [
      // 1. Open shapes drawer
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 800 },
      // 2. Click Star option — creates shape, closes drawer
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-star"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'shape', shapeType: 'star', x: 0.35, y: 0.6,
        width: 130, height: 130, color: '#fca5a5', strokeColor: '#dc2626',
      } },
      { type: 'pause', ms: 600 },
      // 3. Reopen drawer, pick Circle
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 500 },
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-circle"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'shape', shapeType: 'circle', x: 0.5, y: 0.6,
        width: 130, height: 130, color: '#93c5fd', strokeColor: '#2563eb',
      } },
      { type: 'pause', ms: 600 },
      // 4. Reopen drawer, pick Hexagon
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 500 },
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-hexagon"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'shape', shapeType: 'hexagon', x: 0.65, y: 0.6,
        width: 130, height: 130, color: '#86efac', strokeColor: '#16a34a',
      } },
      { type: 'pause', ms: 700 },
      // 5. Select first shape on canvas
      { type: 'cursor', target: 'object:0', click: true },
      { type: 'select', targetIndex: 0 },
      { type: 'pause', ms: 500 },
      // 6. Move cursor over shape options chevron, then open colors drawer
      { type: 'cursor', target: '[data-tutorial-id="shape-options"]', click: false },
      { type: 'pause', ms: 400 },
      { type: 'cursor', target: '[data-tutorial-id="shape-options"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'colors' },
      { type: 'pause', ms: 600 },
      // 7. Cycle colors on selected shape
      { type: 'update', targetIndex: 0, props: { color: '#c4b5fd', strokeColor: '#7c3aed' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#fde68a', strokeColor: '#d97706' } },
      { type: 'pause', ms: 500 },
      // 8. Close drawer, settle
      { type: 'ui', drawer: null },
      { type: 'update', targetIndex: 0, props: { color: '#fca5a5', strokeColor: '#dc2626' } },
      { type: 'deselect' },
      { type: 'cursor', target: 'hide' },
    ],
  };
}

function stickerAnimation(): StepAnimation {
  return {
    commands: [
      // 1. Open the sticker drawer
      { type: 'cursor', target: '[data-tutorial-id="sticker-button"]', click: true },
      { type: 'ui', drawer: 'sticker' },
      { type: 'pause', ms: 800 },
      // 2. Click a sticker to place it (close drawer)
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'sticker', x: 0.45, y: 0.6, width: 80, height: 80,
        emoji: '\u{1F680}', rotation: 0,
      } },
      { type: 'pause', ms: 600 },
      // 3. Reopen drawer and pick another sticker
      { type: 'cursor', target: '[data-tutorial-id="sticker-button"]', click: true },
      { type: 'ui', drawer: 'sticker' },
      { type: 'pause', ms: 600 },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'sticker', x: 0.55, y: 0.6, width: 80, height: 80,
        emoji: '\u{2B50}', rotation: 0,
      } },
      { type: 'pause', ms: 600 },
      { type: 'cursor', target: 'hide' },
      // 4. Fun animations: wobble and resize
      { type: 'update', targetIndex: 0, props: { rotation: -8 } },
      { type: 'update', targetIndex: 1, props: { rotation: 8 } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { rotation: 8 } },
      { type: 'update', targetIndex: 1, props: { rotation: -8 } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { rotation: 0, width: 100, height: 100 } },
      { type: 'update', targetIndex: 1, props: { rotation: 0, width: 100, height: 100 } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { width: 80, height: 80 } },
      { type: 'update', targetIndex: 1, props: { width: 80, height: 80 } },
    ],
  };
}

function connectorAnimation(): StepAnimation {
  // Index 0 = sticky, 1 = shape, 2 = connector
  return {
    commands: [
      // 1. First create two objects to connect
      // Open shapes drawer, pick Sticky
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 500 },
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-sticky"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'sticky', x: 0.35, y: 0.6, width: 140, height: 140,
        text: 'Start', color: '#fef08a', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 500 },
      // Open shapes drawer, pick Circle
      { type: 'cursor', target: '[data-tutorial-id="shape-tool"]', click: true },
      { type: 'ui', drawer: 'shape', tab: 'shapes' },
      { type: 'pause', ms: 500 },
      { type: 'cursor', target: '[data-tutorial-id="shape-opt-circle"]', click: true },
      { type: 'ui', drawer: null },
      { type: 'create', obj: {
        type: 'shape', shapeType: 'circle', x: 0.65, y: 0.6,
        width: 120, height: 120, color: '#c4b5fd', strokeColor: '#7c3aed',
      } },
      { type: 'pause', ms: 500 },
      // 2. Move cursor over connector options chevron, then open drawer
      { type: 'cursor', target: '[data-tutorial-id="connector-options"]', click: false },
      { type: 'pause', ms: 400 },
      { type: 'cursor', target: '[data-tutorial-id="connector-options"]', click: true },
      { type: 'ui', drawer: 'connector' },
      { type: 'pause', ms: 600 },
      // Pick Curved style
      { type: 'cursor', target: '[data-tutorial-id="connector-opt-curved"]', click: true },
      { type: 'pause', ms: 400 },
      // Pick End Arrow
      { type: 'cursor', target: '[data-tutorial-id="connector-opt-end-arrow"]', click: true },
      { type: 'pause', ms: 400 },
      // Close drawer
      { type: 'ui', drawer: null },
      // Create connector between them
      { type: 'create', fromIndex: 0, toIndex: 1, obj: {
        type: 'connector', x: 0, y: 0, width: 0, height: 0,
        style: 'curved', endArrow: true, startArrow: false,
        strokeWidth: 3, color: '#818cf8', lineType: 'solid',
      } },
      { type: 'pause', ms: 600 },
      { type: 'cursor', target: 'hide' },
      // Cycle connector styles
      { type: 'update', targetIndex: 2, props: { style: 'straight' } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 2, props: { style: 'curved' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 2, props: { lineType: 'dashed' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 2, props: { lineType: 'dotted' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 2, props: { lineType: 'solid' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 2, props: { startArrow: true } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 2, props: { endArrow: false } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 2, props: { color: '#ef4444', endArrow: true, startArrow: false } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 2, props: { color: '#10b981' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 2, props: { strokeWidth: 5, color: '#818cf8' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 2, props: { strokeWidth: 3 } },
    ],
  };
}

function aiMockAnimation(): StepAnimation {
  // No cursor — staggered AI-style creation
  return {
    commands: [
      { type: 'create', obj: {
        type: 'sticky', x: 0.3, y: 0.6, width: 160, height: 160,
        text: 'Research', color: '#bfdbfe', textColor: '#1e3a5f',
      } },
      { type: 'pause', ms: 600 },
      { type: 'create', obj: {
        type: 'sticky', x: 0.5, y: 0.6, width: 160, height: 160,
        text: 'Design', color: '#c4b5fd', textColor: '#3b1f7e',
      } },
      { type: 'pause', ms: 600 },
      { type: 'create', obj: {
        type: 'sticky', x: 0.7, y: 0.6, width: 160, height: 160,
        text: 'Build', color: '#bbf7d0', textColor: '#14532d',
      } },
      { type: 'pause', ms: 600 },
    ],
  };
}

// --- Animation registry ---

const ANIMATIONS: Record<string, () => StepAnimation> = {
  sticky: stickyAnimation,
  text: textAnimation,
  shape: shapeAnimation,
  sticker: stickerAnimation,
  connector: connectorAnimation,
  'ai-mock': aiMockAnimation,
};

export function getAnimation(key: string): StepAnimation | null {
  const factory = ANIMATIONS[key];
  return factory ? factory() : null;
}
