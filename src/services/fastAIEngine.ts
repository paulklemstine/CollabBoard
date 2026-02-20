/**
 * Fast AI Engine — client-side command parser for <2s responses.
 * Handles common board operations via regex pattern matching and
 * writes directly to Firestore through boardService, bypassing
 * the Cloud Function entirely.
 *
 * Returns null when the command doesn't match any known pattern,
 * signaling the caller to fall back to Pro mode.
 */
import { auth } from './firebase';
import { addObject, batchAddObjects, batchDeleteObjects, batchUpdateObjects, getBoardObjects, updateObject } from './boardService';
import type { StickyNote, Frame, Shape, TextObject } from '../types/board';
import type { AnyBoardObject } from './boardService';

export interface FastAIResult {
  response: string;
  objectsCreated: string[];
}

// ---- ID generator ----
function genId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ---- Sticky note colors ----
const STICKY_COLORS: Record<string, string> = {
  yellow: '#fef9c3',
  blue: '#dbeafe',
  green: '#dcfce7',
  pink: '#fce7f3',
  purple: '#f3e8ff',
  orange: '#ffedd5',
};

function pickColor(text: string): string {
  const lower = text.toLowerCase();
  for (const [name, hex] of Object.entries(STICKY_COLORS)) {
    if (lower.includes(name)) return hex;
  }
  // Random from palette
  const values = Object.values(STICKY_COLORS);
  return values[Math.floor(Math.random() * values.length)];
}

function randomColor(): string {
  const values = Object.values(STICKY_COLORS);
  return values[Math.floor(Math.random() * values.length)];
}

// ---- Timestamp helper ----
function now(): number {
  return Date.now();
}

function userId(): string {
  return auth.currentUser?.uid ?? 'anonymous';
}

// ---- Base fields for a new board object ----
function baseFields(x: number, y: number, w: number, h: number) {
  return {
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    createdBy: userId(),
    updatedAt: now(),
  };
}

// ---- Pattern matchers ----

interface ParsedCommand {
  execute: (boardId: string, selectedIds?: string[]) => Promise<FastAIResult>;
}

// Create sticky note(s)
function matchCreateSticky(prompt: string): ParsedCommand | null {
  // "create N sticky notes saying X" or "create a sticky note" or "add a note saying X"
  const multiMatch = prompt.match(
    /(?:create|add|make)\s+(\d+)\s+(?:sticky\s*notes?|notes?|stickies)/i,
  );
  if (multiMatch) {
    const count = Math.min(parseInt(multiMatch[1], 10), 50);
    const sayingMatch = prompt.match(/(?:saying|with text|that says?|with|about)\s+["']?(.+?)["']?\s*$/i);
    const text = sayingMatch?.[1] ?? '';
    return {
      async execute(boardId) {
        const objs: AnyBoardObject[] = [];
        const ids: string[] = [];
        const cols = Math.ceil(Math.sqrt(count));
        for (let i = 0; i < count; i++) {
          const id = genId();
          ids.push(id);
          const col = i % cols;
          const row = Math.floor(i / cols);
          objs.push({
            id,
            type: 'sticky',
            text: text || `Note ${i + 1}`,
            color: randomColor(),
            textColor: '#1e293b',
            ...baseFields(100 + col * 220, 100 + row * 220, 200, 200),
          } as StickyNote);
        }
        await batchAddObjects(boardId, objs);
        return {
          response: `Created ${count} sticky note${count !== 1 ? 's' : ''}${text ? ` saying "${text}"` : ''}.`,
          objectsCreated: ids,
        };
      },
    };
  }

  // Single sticky
  const singleMatch = prompt.match(
    /(?:create|add|make)\s+(?:a\s+)?(?:(?:(\w+)\s+)?sticky\s*note|note|sticky)(?:\s+(?:saying|with text|that says?|with|about)\s+["']?(.+?)["']?)?\s*$/i,
  );
  if (singleMatch) {
    const colorHint = singleMatch[1] ?? '';
    const text = singleMatch[2] ?? '';
    return {
      async execute(boardId) {
        const id = genId();
        const color = colorHint ? (STICKY_COLORS[colorHint.toLowerCase()] ?? pickColor(colorHint)) : randomColor();
        await addObject(boardId, {
          id,
          type: 'sticky',
          text: text || 'New note',
          color,
          textColor: '#1e293b',
          ...baseFields(100 + Math.random() * 200, 100 + Math.random() * 200, 200, 200),
        } as StickyNote);
        return {
          response: `Created a sticky note${text ? ` saying "${text}"` : ''}.`,
          objectsCreated: [id],
        };
      },
    };
  }

  return null;
}

// Create frame
function matchCreateFrame(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:create|add|make)\s+(?:a\s+)?frame(?:\s+(?:called|named|titled)\s+["']?(.+?)["']?)?\s*$/i,
  );
  if (!match) return null;

  const title = match[1] ?? 'Untitled Frame';
  return {
    async execute(boardId) {
      const id = genId();
      await addObject(boardId, {
        id,
        type: 'frame',
        title,
        ...baseFields(50, 50, 500, 400),
      } as Frame);
      return {
        response: `Created a frame${title !== 'Untitled Frame' ? ` called "${title}"` : ''}.`,
        objectsCreated: [id],
      };
    },
  };
}

// Create text
function matchCreateText(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:create|add|make)\s+(?:a\s+)?text(?:\s+(?:saying|with|that says?)\s+["']?(.+?)["']?)?\s*$/i,
  );
  if (!match) return null;

  const text = match[1] ?? 'New text';
  return {
    async execute(boardId) {
      const id = genId();
      await addObject(boardId, {
        id,
        type: 'text',
        text,
        fontSize: 24,
        fontFamily: 'sans',
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: '#1e293b',
        ...baseFields(100 + Math.random() * 200, 100 + Math.random() * 200, 300, 60),
      } as TextObject);
      return {
        response: `Created a text element saying "${text}".`,
        objectsCreated: [id],
      };
    },
  };
}

// Create shape
function matchCreateShape(prompt: string): ParsedCommand | null {
  const shapeTypes = ['rect', 'circle', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'arrow', 'cross'];
  const match = prompt.match(
    /(?:create|add|make)\s+(?:a\s+)?(?:(rect(?:angle)?|circle|triangle|diamond|pentagon|hexagon|octagon|star|arrow|cross)\s+)?shape|(?:create|add|make)\s+(?:a\s+)?(rect(?:angle)?|circle|triangle|diamond|pentagon|hexagon|octagon|star|arrow|cross)/i,
  );
  if (!match) return null;

  const raw = (match[1] ?? match[2] ?? 'rect').toLowerCase();
  const shapeType = raw === 'rectangle' ? 'rect' : raw;
  if (!shapeTypes.includes(shapeType)) return null;

  return {
    async execute(boardId) {
      const id = genId();
      await addObject(boardId, {
        id,
        type: 'shape',
        shapeType: shapeType as Shape['shapeType'],
        color: '#dbeafe',
        ...baseFields(100 + Math.random() * 200, 100 + Math.random() * 200, 150, 150),
      } as Shape);
      return {
        response: `Created a ${shapeType} shape.`,
        objectsCreated: [id],
      };
    },
  };
}

// Delete selected
function matchDeleteSelected(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:delete|remove|clear)\s+(?:the\s+)?(?:selected|selection|these|this)/i,
  );
  if (!match) return null;

  return {
    async execute(boardId, selectedIds) {
      if (!selectedIds || selectedIds.length === 0) {
        return { response: 'No objects are selected to delete.', objectsCreated: [] };
      }
      await batchDeleteObjects(boardId, selectedIds);
      return {
        response: `Deleted ${selectedIds.length} object${selectedIds.length !== 1 ? 's' : ''}.`,
        objectsCreated: [],
      };
    },
  };
}

// Clear board / delete all / remove everything
function matchClearBoard(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:clear|clean|wipe|reset|empty)\s+(?:the\s+)?(?:board|canvas|everything|all)|(?:delete|remove)\s+(?:all|everything)(?:\s+(?:on|from)\s+(?:the\s+)?board)?/i,
  );
  if (!match) return null;

  return {
    async execute(boardId) {
      const objects = await getBoardObjects(boardId);
      if (objects.length === 0) {
        return { response: 'Board is already empty.', objectsCreated: [] };
      }
      const ids = objects.map(o => o.id);
      // Firestore batch limit is 500, chunk if needed
      for (let i = 0; i < ids.length; i += 500) {
        await batchDeleteObjects(boardId, ids.slice(i, i + 500));
      }
      return {
        response: `Cleared the board — removed ${ids.length} object${ids.length !== 1 ? 's' : ''}.`,
        objectsCreated: [],
      };
    },
  };
}

// Change color of selected objects
function matchChangeColor(prompt: string): ParsedCommand | null {
  const COLOR_MAP: Record<string, string> = {
    red: '#fca5a5', yellow: '#fef9c3', blue: '#dbeafe', green: '#dcfce7',
    pink: '#fce7f3', purple: '#f3e8ff', orange: '#ffedd5', white: '#ffffff',
    black: '#1e293b', gray: '#e2e8f0', grey: '#e2e8f0', violet: '#ddd6fe',
    teal: '#ccfbf1', cyan: '#cffafe', lime: '#ecfccb', rose: '#ffe4e6',
    indigo: '#e0e7ff', amber: '#fef3c7',
  };

  const match = prompt.match(
    /(?:change|set|make)\s+(?:the\s+)?(?:color|colour)\s+(?:of\s+(?:the\s+)?(?:selected|selection|these|this)\s+)?(?:to\s+)?(\w+)/i,
  ) || prompt.match(
    /(?:make|turn|color|colour)\s+(?:the\s+)?(?:selected|selection|these|this|them)\s+(\w+)/i,
  );
  if (!match) return null;

  const colorName = match[1].toLowerCase();
  // Accept hex colors directly
  const hexMatch = prompt.match(/#[0-9a-fA-F]{3,8}/);
  const color = hexMatch ? hexMatch[0] : COLOR_MAP[colorName];
  if (!color) return null;

  return {
    async execute(boardId, selectedIds) {
      if (!selectedIds || selectedIds.length === 0) {
        return { response: 'No objects selected to change color.', objectsCreated: [] };
      }
      const updates = selectedIds.map(id => ({ id, updates: { color } as Partial<AnyBoardObject> }));
      await batchUpdateObjects(boardId, updates);
      return {
        response: `Changed color of ${selectedIds.length} object${selectedIds.length !== 1 ? 's' : ''} to ${colorName}.`,
        objectsCreated: [],
      };
    },
  };
}

// Arrange / organize / layout selected or all objects
function matchArrange(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:arrange|organize|layout|lay\s+out|tidy|tidy\s+up|sort|align|space|spread|grid|stack|line\s+up)\s*(?:the\s+)?(?:board|items?|objects?|everything|all|stickies|notes?|selected|these|them)?/i,
  );
  if (!match) return null;

  // Determine layout mode from the prompt
  const lower = prompt.toLowerCase();
  let mode: 'grid' | 'row' | 'column' = 'grid';
  if (/row|horizontal|left.to.right|side.by.side/i.test(lower)) mode = 'row';
  if (/column|vertical|top.to.bottom|stack/i.test(lower)) mode = 'column';

  return {
    async execute(boardId, selectedIds) {
      const allObjects = await getBoardObjects(boardId);
      // Use selected objects if available, otherwise all non-frame objects
      let targets = selectedIds && selectedIds.length > 0
        ? allObjects.filter(o => selectedIds.includes(o.id))
        : allObjects.filter(o => o.type !== 'frame');

      if (targets.length === 0) {
        return { response: 'No objects to arrange.', objectsCreated: [] };
      }

      const spacing = 20;
      const updates: { id: string; x: number; y: number }[] = [];

      if (mode === 'row') {
        let cursorX = 100;
        for (const obj of targets) {
          updates.push({ id: obj.id, x: cursorX, y: 100 });
          cursorX += (obj.width || 200) + spacing;
        }
      } else if (mode === 'column') {
        let cursorY = 100;
        for (const obj of targets) {
          updates.push({ id: obj.id, x: 100, y: cursorY });
          cursorY += (obj.height || 200) + spacing;
        }
      } else {
        // Grid
        const cols = Math.ceil(Math.sqrt(targets.length));
        for (let i = 0; i < targets.length; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const w = targets[i].width || 200;
          const h = targets[i].height || 200;
          updates.push({
            id: targets[i].id,
            x: 100 + col * (w + spacing),
            y: 100 + row * (h + spacing),
          });
        }
      }

      await batchUpdateObjects(boardId, updates.map(u => ({ id: u.id, updates: { x: u.x, y: u.y } as Partial<AnyBoardObject> })));
      return {
        response: `Arranged ${targets.length} object${targets.length !== 1 ? 's' : ''} in a ${mode}.`,
        objectsCreated: [],
      };
    },
  };
}

// Duplicate selected objects
function matchDuplicate(prompt: string): ParsedCommand | null {
  const match = prompt.match(
    /(?:duplicate|copy|clone)\s+(?:the\s+)?(?:selected|selection|these|this|them)/i,
  );
  if (!match) return null;

  return {
    async execute(boardId, selectedIds) {
      if (!selectedIds || selectedIds.length === 0) {
        return { response: 'No objects selected to duplicate.', objectsCreated: [] };
      }
      const allObjects = await getBoardObjects(boardId);
      const selectedObjs = allObjects.filter(o => selectedIds.includes(o.id));
      const newIds: string[] = [];
      const newObjs: AnyBoardObject[] = [];
      for (const obj of selectedObjs) {
        const id = genId();
        newIds.push(id);
        newObjs.push({
          ...obj,
          id,
          x: (obj.x || 0) + 30,
          y: (obj.y || 0) + 30,
          updatedAt: now(),
          createdBy: userId(),
        } as AnyBoardObject);
      }
      await batchAddObjects(boardId, newObjs);
      return {
        response: `Duplicated ${newIds.length} object${newIds.length !== 1 ? 's' : ''}.`,
        objectsCreated: newIds,
      };
    },
  };
}

// ---- Templates ----

function matchTemplate(prompt: string): ParsedCommand | null {
  const lower = prompt.toLowerCase().trim();

  // SWOT analysis
  if (/swot/i.test(lower)) {
    return { execute: (boardId) => createSwotTemplate(boardId) };
  }

  // Pros and cons
  if (/pros?\s*(and|&|\/)\s*cons?/i.test(lower) || lower === 'pros cons') {
    return { execute: (boardId) => createProsConsTemplate(boardId) };
  }

  // 2x2 matrix
  if (/2\s*x\s*2|two\s*by\s*two|matrix/i.test(lower)) {
    return { execute: (boardId) => create2x2Template(boardId) };
  }

  // Kanban
  if (/kanban/i.test(lower)) {
    return { execute: (boardId) => createKanbanTemplate(boardId) };
  }

  // Timeline
  if (/timeline/i.test(lower)) {
    return { execute: (boardId) => createTimelineTemplate(boardId) };
  }

  // Retrospective
  if (/retro(?:spective)?/i.test(lower)) {
    return { execute: (boardId) => createRetroTemplate(boardId) };
  }

  // Eisenhower
  if (/eisenhower|urgent.*important/i.test(lower)) {
    return { execute: (boardId) => createEisenhowerTemplate(boardId) };
  }

  // Mind map
  if (/mind\s*map/i.test(lower)) {
    return { execute: (boardId) => createMindMapTemplate(boardId) };
  }

  return null;
}

async function createSwotTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
  const colors = ['#dcfce7', '#fce7f3', '#dbeafe', '#ffedd5'];
  const prompts = ['What are we good at?', 'Where can we improve?', 'What trends can we leverage?', 'What risks do we face?'];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const frameId = genId();
    const stickyId = genId();
    const fx = 50 + col * 420;
    const fy = 50 + row * 320;
    ids.push(frameId, stickyId);
    objs.push(
      { id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, fy, 400, 300) } as Frame,
      { id: stickyId, type: 'sticky', text: prompts[i], color: colors[i], textColor: '#1e293b', parentId: frameId, ...baseFields(fx + 20, fy + 20, 180, 180) } as StickyNote,
    );
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a SWOT analysis template with 4 quadrants.', objectsCreated: ids };
}

async function createProsConsTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['Pros', 'Cons'];
  const colors = ['#dcfce7', '#fce7f3'];
  const prompts = ['Add advantages here', 'Add disadvantages here'];

  for (let i = 0; i < 2; i++) {
    const frameId = genId();
    const stickyId = genId();
    const fx = 50 + i * 420;
    ids.push(frameId, stickyId);
    objs.push(
      { id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, 50, 400, 500) } as Frame,
      { id: stickyId, type: 'sticky', text: prompts[i], color: colors[i], textColor: '#1e293b', parentId: frameId, ...baseFields(fx + 20, 70, 180, 180) } as StickyNote,
    );
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a Pros & Cons template.', objectsCreated: ids };
}

async function create2x2Template(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['High Impact / Low Effort', 'High Impact / High Effort', 'Low Impact / Low Effort', 'Low Impact / High Effort'];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const frameId = genId();
    const fx = 50 + col * 420;
    const fy = 50 + row * 320;
    ids.push(frameId);
    objs.push({ id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, fy, 400, 300) } as Frame);
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a 2x2 matrix template.', objectsCreated: ids };
}

async function createKanbanTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['To Do', 'In Progress', 'Done'];
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7'];
  const prompts = ['Add tasks here', 'Work in progress', 'Completed tasks'];

  for (let i = 0; i < 3; i++) {
    const frameId = genId();
    const stickyId = genId();
    const fx = 50 + i * 370;
    ids.push(frameId, stickyId);
    objs.push(
      { id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, 50, 350, 600) } as Frame,
      { id: stickyId, type: 'sticky', text: prompts[i], color: colors[i], textColor: '#1e293b', parentId: frameId, ...baseFields(fx + 20, 70, 180, 180) } as StickyNote,
    );
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a Kanban board with To Do, In Progress, and Done columns.', objectsCreated: ids };
}

async function createTimelineTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const labels = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];
  const colors = ['#dbeafe', '#dcfce7', '#fef9c3', '#f3e8ff'];

  for (let i = 0; i < 4; i++) {
    const id = genId();
    ids.push(id);
    objs.push({
      id,
      type: 'sticky',
      text: labels[i],
      color: colors[i],
      textColor: '#1e293b',
      ...baseFields(50 + i * 260, 100, 240, 200),
    } as StickyNote);
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a 4-phase timeline.', objectsCreated: ids };
}

async function createRetroTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['What Went Well', "What Didn't Go Well", 'Action Items'];
  const colors = ['#dcfce7', '#fce7f3', '#dbeafe'];
  const prompts = ['Add your wins here', 'What could be better?', 'Next steps to take'];

  for (let i = 0; i < 3; i++) {
    const frameId = genId();
    const stickyId = genId();
    const fx = 50 + i * 420;
    ids.push(frameId, stickyId);
    objs.push(
      { id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, 50, 400, 500) } as Frame,
      { id: stickyId, type: 'sticky', text: prompts[i], color: colors[i], textColor: '#1e293b', parentId: frameId, ...baseFields(fx + 20, 70, 180, 180) } as StickyNote,
    );
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a Retrospective template with 3 columns.', objectsCreated: ids };
}

async function createEisenhowerTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const titles = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Neither'];
  const colors = ['#fce7f3', '#dbeafe', '#ffedd5', '#f3e8ff'];
  const prompts = ['Do it now', 'Schedule it', 'Delegate it', 'Drop it'];

  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const frameId = genId();
    const stickyId = genId();
    const fx = 50 + col * 420;
    const fy = 50 + row * 320;
    ids.push(frameId, stickyId);
    objs.push(
      { id: frameId, type: 'frame', title: titles[i], ...baseFields(fx, fy, 400, 300) } as Frame,
      { id: stickyId, type: 'sticky', text: prompts[i], color: colors[i], textColor: '#1e293b', parentId: frameId, ...baseFields(fx + 20, fy + 20, 180, 180) } as StickyNote,
    );
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created an Eisenhower matrix template.', objectsCreated: ids };
}

async function createMindMapTemplate(boardId: string): Promise<FastAIResult> {
  const ids: string[] = [];
  const objs: AnyBoardObject[] = [];
  const centerId = genId();
  ids.push(centerId);
  objs.push({
    id: centerId,
    type: 'sticky',
    text: 'Central Idea',
    color: '#fef9c3',
    textColor: '#1e293b',
    ...baseFields(450, 350, 200, 200),
  } as StickyNote);

  const positions = [
    { x: 50, y: 350 },
    { x: 850, y: 350 },
    { x: 450, y: 50 },
    { x: 450, y: 650 },
  ];
  for (let i = 0; i < 4; i++) {
    const id = genId();
    ids.push(id);
    objs.push({
      id,
      type: 'sticky',
      text: `Branch ${i + 1}`,
      color: '#dbeafe',
      textColor: '#1e293b',
      ...baseFields(positions[i].x, positions[i].y, 200, 200),
    } as StickyNote);
  }
  await batchAddObjects(boardId, objs);
  return { response: 'Created a mind map with a central idea and 4 branches.', objectsCreated: ids };
}

// ---- Main entry point ----

/**
 * Attempt to execute a command using fast client-side parsing.
 * Returns null if the command is not recognized (caller should fall back to Pro mode).
 */
export async function executeFastCommand(
  boardId: string,
  prompt: string,
  selectedIds?: string[],
): Promise<FastAIResult | null> {
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  // Try each matcher in priority order
  const matchers = [
    matchClearBoard,
    matchDeleteSelected,
    matchChangeColor,
    matchDuplicate,
    matchArrange,
    matchTemplate,
    matchCreateSticky,
    matchCreateFrame,
    matchCreateText,
    matchCreateShape,
  ];

  for (const matcher of matchers) {
    const parsed = matcher(trimmed);
    if (parsed) {
      return parsed.execute(boardId, selectedIds);
    }
  }

  // No match — signal fallback
  return null;
}
