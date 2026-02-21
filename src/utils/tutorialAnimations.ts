import type { AnyBoardObject } from '../services/boardService';
import { addObject, updateObject } from '../services/boardService';

// --- Types ---

export type AnimationCommand =
  | { type: 'pause'; ms: number }
  | { type: 'update'; targetIndex: number; props: Record<string, unknown> }
  | { type: 'create'; obj: Partial<AnyBoardObject> & { type: string }; parentIndex?: number; fromIndex?: number; toIndex?: number };

export interface StepAnimation {
  commands: AnimationCommand[];
}

// --- Helper: abortable sleep ---

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  });
}

// --- Runner ---

export async function runAnimation(
  animation: StepAnimation,
  boardId: string,
  userId: string,
  worldCenter: (xFrac: number, yFrac: number) => { x: number; y: number },
  signal: AbortSignal,
): Promise<string[]> {
  const newIds: string[] = [];

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
        const pos = worldCenter(
          (cmd.obj.x as number) ?? 0.5,
          (cmd.obj.y as number) ?? 0.5,
        );
        const base: Record<string, unknown> = {
          ...cmd.obj,
          id,
          x: pos.x,
          y: pos.y,
          rotation: (cmd.obj.rotation as number) ?? 0,
          createdBy: userId,
          updatedAt: Date.now(),
        };
        // Resolve references to previously created objects in this animation
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
        newIds.push(id);
        break;
      }
    }
  }

  return newIds;
}

// --- Per-step animation scripts ---
// Object positions use fractional screen coords (x: 0-1, y: 0-1).
// All y values ≥ 0.5 so objects render below the tutorial tooltip panel.
// 'targetIndex' is the index in `newIds` (objects created within this animation).

function stickyAnimation(): StepAnimation {
  return {
    commands: [
      { type: 'create', obj: {
        type: 'sticky', x: 0.5, y: 0.6, width: 180, height: 180,
        text: 'My first idea!', color: '#fef08a', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 800 },
      { type: 'update', targetIndex: 0, props: { color: '#93c5fd' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#86efac' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#fda4af' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#c4b5fd' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { text: 'Colors & styles!' } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: { fontWeight: 'bold' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#fef08a', fontWeight: 'normal', text: 'My first idea!' } },
    ],
  };
}

function textAnimation(): StepAnimation {
  return {
    commands: [
      { type: 'create', obj: {
        type: 'text', x: 0.5, y: 0.6, width: 260, height: 50,
        text: 'Welcome to my board!', fontSize: 28,
        fontFamily: "'Inter', sans-serif", fontWeight: 'bold', fontStyle: 'normal',
        textAlign: 'center', color: '#7c3aed',
      } },
      { type: 'pause', ms: 700 },
      { type: 'update', targetIndex: 0, props: { fontFamily: 'Georgia, serif' } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: { fontFamily: "'Courier New', monospace" } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: { fontSize: 36, fontFamily: "'Inter', sans-serif" } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { fontSize: 20 } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { textAlign: 'left', fontSize: 28 } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { textAlign: 'right' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { color: '#dc2626', textAlign: 'center' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { color: '#059669' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { color: '#7c3aed' } },
    ],
  };
}

function shapeAnimation(): StepAnimation {
  return {
    commands: [
      { type: 'create', obj: {
        type: 'shape', shapeType: 'star', x: 0.5, y: 0.6,
        width: 140, height: 140, color: '#c4b5fd', strokeColor: '#7c3aed',
      } },
      { type: 'pause', ms: 700 },
      { type: 'update', targetIndex: 0, props: { shapeType: 'circle' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { shapeType: 'diamond' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { shapeType: 'hexagon' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { shapeType: 'triangle' } },
      { type: 'pause', ms: 500 },
      { type: 'update', targetIndex: 0, props: { color: '#fca5a5', shapeType: 'star' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { color: '#93c5fd' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { color: '#86efac' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { width: 180, height: 180, color: '#c4b5fd' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { width: 100, height: 100 } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { width: 140, height: 140 } },
    ],
  };
}

function frameAnimation(): StepAnimation {
  // Index 0 = frame, 1-3 = child stickies created one by one
  return {
    commands: [
      // Create frame
      { type: 'create', obj: {
        type: 'frame', x: 0.5, y: 0.52, width: 500, height: 340,
        title: 'My Section', color: 'rgba(250, 245, 255, 0.35)',
        borderColor: '#a78bfa', textColor: '#581c87',
      } },
      { type: 'pause', ms: 700 },
      // Stagger children inside
      { type: 'create', parentIndex: 0, obj: {
        type: 'sticky', x: 0.38, y: 0.58, width: 120, height: 120,
        text: 'Idea A', color: '#fef08a', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 500 },
      { type: 'create', parentIndex: 0, obj: {
        type: 'sticky', x: 0.5, y: 0.58, width: 120, height: 120,
        text: 'Idea B', color: '#93c5fd', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 500 },
      { type: 'create', parentIndex: 0, obj: {
        type: 'sticky', x: 0.62, y: 0.58, width: 120, height: 120,
        text: 'Idea C', color: '#86efac', textColor: '#1e293b',
      } },
      { type: 'pause', ms: 700 },
      // Change frame title
      { type: 'update', targetIndex: 0, props: { title: 'Design Ideas' } },
      { type: 'pause', ms: 700 },
      { type: 'update', targetIndex: 0, props: { title: 'Sprint Goals' } },
      { type: 'pause', ms: 700 },
      // Dramatic frame color themes
      { type: 'update', targetIndex: 0, props: {
        borderColor: '#f472b6', color: 'rgba(251, 207, 232, 0.4)', textColor: '#9d174d',
      } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: {
        borderColor: '#38bdf8', color: 'rgba(186, 230, 253, 0.4)', textColor: '#0c4a6e',
      } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: {
        borderColor: '#34d399', color: 'rgba(167, 243, 208, 0.4)', textColor: '#064e3b',
      } },
      { type: 'pause', ms: 600 },
      // Recolor children to match
      { type: 'update', targetIndex: 1, props: { color: '#bbf7d0' } },
      { type: 'update', targetIndex: 2, props: { color: '#a7f3d0' } },
      { type: 'update', targetIndex: 3, props: { color: '#6ee7b7' } },
      { type: 'pause', ms: 600 },
      // Resize frame larger
      { type: 'update', targetIndex: 0, props: { width: 580, height: 380 } },
      { type: 'pause', ms: 600 },
      // Settle back
      { type: 'update', targetIndex: 0, props: {
        width: 500, height: 340, title: 'My Section',
        borderColor: '#a78bfa', color: 'rgba(250, 245, 255, 0.35)', textColor: '#581c87',
      } },
      { type: 'update', targetIndex: 1, props: { color: '#fef08a' } },
      { type: 'update', targetIndex: 2, props: { color: '#93c5fd' } },
      { type: 'update', targetIndex: 3, props: { color: '#86efac' } },
    ],
  };
}

function stickerAnimation(): StepAnimation {
  return {
    commands: [
      { type: 'create', obj: {
        type: 'sticker', x: 0.5, y: 0.6, width: 80, height: 80,
        emoji: '\u{1F680}', rotation: 0,
      } },
      { type: 'pause', ms: 600 },
      { type: 'update', targetIndex: 0, props: { emoji: '\u{1F3AF}' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { emoji: '\u{1F4A1}' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { emoji: '\u{1F525}' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { emoji: '\u{2B50}' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { emoji: '\u{1F3A8}' } },
      { type: 'pause', ms: 400 },
      { type: 'update', targetIndex: 0, props: { rotation: -8, emoji: '\u{1F680}' } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { rotation: 8 } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { rotation: -12 } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { rotation: 12 } },
      { type: 'pause', ms: 300 },
      { type: 'update', targetIndex: 0, props: { width: 120, height: 120, rotation: 0 } },
      { type: 'pause', ms: 350 },
      { type: 'update', targetIndex: 0, props: { width: 60, height: 60 } },
      { type: 'pause', ms: 350 },
      { type: 'update', targetIndex: 0, props: { width: 80, height: 80 } },
    ],
  };
}

function connectorAnimation(): StepAnimation {
  // Self-contained: creates two source objects then a connector between them.
  // Index 0 = sticky, 1 = shape, 2 = connector
  return {
    commands: [
      // Create source objects
      { type: 'create', obj: {
        type: 'sticky', x: 0.35, y: 0.6, width: 140, height: 140,
        text: 'Start', color: '#fef08a', textColor: '#1e293b',
      } },
      { type: 'create', obj: {
        type: 'shape', shapeType: 'circle', x: 0.65, y: 0.6,
        width: 120, height: 120, color: '#c4b5fd', strokeColor: '#7c3aed',
      } },
      { type: 'pause', ms: 400 },
      // Create connector referencing the two objects by index
      { type: 'create', fromIndex: 0, toIndex: 1, obj: {
        type: 'connector', x: 0, y: 0, width: 0, height: 0,
        style: 'curved', endArrow: true, startArrow: false,
        strokeWidth: 3, color: '#818cf8', lineType: 'solid',
      } },
      { type: 'pause', ms: 600 },
      // Animate connector (index 2)
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
  frame: frameAnimation,
  sticker: stickerAnimation,
  connector: connectorAnimation,
  'ai-mock': aiMockAnimation,
};

export function getAnimation(key: string): StepAnimation | null {
  const factory = ANIMATIONS[key];
  return factory ? factory() : null;
}
