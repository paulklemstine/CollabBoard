import { doc, collection, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { getBoardObjects } from './boardService';
import type { ViewportCenter } from '../components/AIChat/AIChat';

// ---- Template match types (mirrored from server) ----

type TemplateMatch = {
  type: 'flowchart';
  nodes: string[];
} | {
  type: 'template';
  templateType: 'swot' | 'kanban' | 'retrospective' | 'eisenhower' | 'mind-map' | 'timeline' | 'journey' | 'pros-cons';
} | {
  type: 'bulk-create';
  count: number;
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'random';
} | {
  type: 'single-create';
  objectType: 'sticky' | 'shape' | 'text' | 'frame';
  label?: string;
  color?: string;
  shapeType?: string;
  x?: number;
  y?: number;
} | {
  type: 'grid-create';
  rows: number;
  cols: number;
  labels?: string[];
} | {
  type: 'clear-board';
} | {
  type: 'numbered-flowchart';
  stepCount: number;
  topic?: string;
} | {
  type: 'arrange-grid';
} | {
  type: 'selective-delete';
  targetType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'connector';
} | {
  type: 'bulk-color';
  targetType?: 'sticky' | 'shape' | 'text' | 'frame' | 'all';
  color: string;
} | {
  type: 'row-create';
  count: number;
  direction: 'row' | 'column';
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame';
} | {
  type: 'canned-response';
  response: string;
} | {
  type: 'group-selection';
} | {
  type: 'duplicate-selection';
  direction: 'below' | 'right';
} | {
  type: 'table-create';
  columns: number;
  headers?: string[];
};

// ---- detectTemplate (pure regex, copied from server) ----

export function detectTemplate(prompt: string, selectedIds?: string[]): TemplateMatch | null {
  const lower = prompt.toLowerCase().trim();

  // Canned responses
  if (/^(?:undo|undo\s+(?:last|that|it))$/i.test(lower)) {
    return { type: 'canned-response', response: 'Use Ctrl+Z (Cmd+Z on Mac) to undo. The AI cannot undo actions.' };
  }
  if (/^(?:help|what\s+can\s+you\s+do|commands|what\s+are\s+your\s+(?:commands|capabilities))\??$/i.test(lower)) {
    return { type: 'canned-response', response: 'I can create objects (stickies, shapes, frames, text, connectors), move/resize/delete them, arrange layouts (grids, rows, columns), build templates (SWOT, kanban, retro, timeline, journey map, flowchart, mind map), and manipulate colors. Try: "create a SWOT analysis", "add 10 stickies", "arrange in a grid", or "A -> B -> C" for a flowchart.' };
  }

  // Group selection — requires selectedIds
  if (selectedIds && selectedIds.length > 0 &&
      /^(?:group|frame|wrap|enclose|put)\s+(?:these|them|selected|the\s+selected)/i.test(lower)) {
    return { type: 'group-selection' };
  }

  // Duplicate selection — requires selectedIds
  if (selectedIds && selectedIds.length > 0) {
    const dupMatch = lower.match(/^(?:duplicate|copy|clone)\s+(?:these|them|selected|the\s+selected)(?:\s+(?:to\s+the\s+)?(below|underneath|down|right|beside))?/i);
    if (dupMatch) {
      const dirStr = dupMatch[1] || 'below';
      const direction = /right|beside/.test(dirStr) ? 'right' as const : 'below' as const;
      return { type: 'duplicate-selection', direction };
    }
  }

  // Table create
  const tableMatch = lower.match(/(?:create|make|build)\s+(?:a\s+)?table\s+(?:with\s+)?(\d+)\s+(?:columns?|cols?)\s*(?::\s*(.+))?/i);
  if (tableMatch) {
    const columns = parseInt(tableMatch[1], 10);
    if (columns >= 1 && columns <= 20) {
      const headers = tableMatch[2]
        ? tableMatch[2].split(/\s*,\s*/).map(s => s.trim()).filter(Boolean)
        : undefined;
      return { type: 'table-create', columns, headers };
    }
  }

  // Flowchart arrow syntax
  const arrowParts = prompt.split(/\s*(?:->|-->|→)\s*/);
  if (arrowParts.length >= 2 && arrowParts.every(p => p.trim().length > 0 && p.trim().length < 100)) {
    return { type: 'flowchart', nodes: arrowParts.map(p => p.trim()) };
  }

  // Clear / delete all
  if (/^(?:clear|clean|wipe)\s+(?:the\s+)?(?:board|canvas|everything|all)/i.test(lower)
    || /^(?:delete|remove)\s+everything/i.test(lower)
    || /^(?:delete|remove)\s+all\s*$/i.test(lower)
    || /^(?:delete|remove)\s+all\s+(?:objects?|things?|items?|of\s+(?:them|it))/i.test(lower)) {
    return { type: 'clear-board' };
  }

  // Selective delete
  const selectiveDeleteMatch = lower.match(/^(?:delete|remove)\s+(?:all\s+)?(?:the\s+)?(sticky\s*notes?|stickies|notes?|cards?|shapes?|texts?|stickers?|frames?|connectors?|lines?|arrows?)/);
  if (selectiveDeleteMatch) {
    const typeStr = selectiveDeleteMatch[1];
    let targetType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'connector';
    if (/sticky|stickies|note|card/.test(typeStr)) targetType = 'sticky';
    else if (/shape|line|arrow/.test(typeStr)) targetType = 'shape';
    else if (/text/.test(typeStr)) targetType = 'text';
    else if (/sticker/.test(typeStr)) targetType = 'sticker';
    else if (/frame/.test(typeStr)) targetType = 'frame';
    else if (/connector/.test(typeStr)) targetType = 'connector';
    else targetType = 'sticky';
    return { type: 'selective-delete', targetType };
  }

  // Bulk color change
  const COLOR_NAME_MAP: Record<string, string> = {
    yellow: '#fef9c3', blue: '#dbeafe', green: '#dcfce7', pink: '#fce7f3',
    purple: '#f3e8ff', orange: '#ffedd5', red: '#fecaca', cyan: '#cffafe', teal: '#ccfbf1',
    white: '#ffffff', black: '#1e293b',
  };
  const colorNames = Object.keys(COLOR_NAME_MAP).join('|');
  const bulkColorMatch = lower.match(new RegExp(
    `(?:color|change|make|set|turn)\\s+(?:all\\s+)?(?:the\\s+)?(stickies|sticky\\s*notes?|notes?|shapes?|texts?|frames?|everything|objects?)\\s+(?:to\\s+)?(?:color\\s+)?(${colorNames})` +
    `|(?:color|change|make|set|turn)\\s+(?:all\\s+)?(?:the\\s+)?(stickies|sticky\\s*notes?|notes?|shapes?|texts?|frames?|everything|objects?)\\s+(?:to\\s+)?(?:color\\s+)?(${colorNames})`,
  ));
  const bulkColorMatch2 = !bulkColorMatch ? lower.match(new RegExp(
    `(?:color|change|make|set|turn)\\s+(?:all\\s+)?(?:the\\s+)?(?:everything|objects?|stickies|sticky\\s*notes?|notes?|shapes?|texts?|frames?)\\s+(?:to\\s+)?(${colorNames})`,
  )) : null;

  if (bulkColorMatch || bulkColorMatch2) {
    const m = bulkColorMatch || bulkColorMatch2;
    if (m) {
      let foundColor: string | undefined;
      let targetStr = '';
      for (const group of m.slice(1)) {
        if (group && COLOR_NAME_MAP[group]) foundColor = COLOR_NAME_MAP[group];
        else if (group) targetStr = group;
      }
      if (foundColor) {
        let targetType: 'sticky' | 'shape' | 'text' | 'frame' | 'all' = 'all';
        if (/sticky|stickies|note|card/.test(targetStr)) targetType = 'sticky';
        else if (/shape/.test(targetStr)) targetType = 'shape';
        else if (/text/.test(targetStr)) targetType = 'text';
        else if (/frame/.test(targetStr)) targetType = 'frame';
        return { type: 'bulk-color', targetType, color: foundColor };
      }
    }
  }

  // Arrange in a grid
  if (/(?:arrange|organize|layout|lay\s+out|sort|align)\s+(?:them\s+|these\s+|objects?\s+|everything\s+)?(?:in(?:to)?\s+)?(?:a\s+)?grid/i.test(lower)) {
    return { type: 'arrange-grid' };
  }

  // Grid pattern
  const gridMatch = lower.match(/(\d+)\s*[x×by]\s*(\d+)\s*(?:grid\s*(?:of\s*)?)?(?:sticky|stickies|note|notes|card|cards)?/);
  if (gridMatch) {
    const rows = parseInt(gridMatch[1], 10);
    const cols = parseInt(gridMatch[2], 10);
    if (rows >= 1 && rows <= 50 && cols >= 1 && cols <= 50 && rows * cols <= 500) {
      const labelMatch = prompt.match(/\b(?:for|about|on|with)\s+(.+)$/i);
      let labels: string[] | undefined;
      if (labelMatch) {
        labels = labelMatch[1].split(/\s+and\s+|,\s*/i).map(s => s.trim()).filter(Boolean);
      }
      return { type: 'grid-create', rows, cols, labels };
    }
  }

  // Row/column layout
  const rowColMatch = lower.match(/(?:create|add|make|place)\s+(\d+)\s+(sticky|stickies|note|notes|card|cards|shape|shapes|text|texts|sticker|stickers|frame|frames)\s+in\s+a\s+(row|column|line|horizontal|vertical)/i);
  if (rowColMatch) {
    const count = parseInt(rowColMatch[1], 10);
    const typeStr = rowColMatch[2];
    const dirStr = rowColMatch[3];
    if (count >= 1 && count <= 500) {
      let objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame';
      if (/sticky|stickies|note|card/.test(typeStr)) objectType = 'sticky';
      else if (/shape/.test(typeStr)) objectType = 'shape';
      else if (/text/.test(typeStr)) objectType = 'text';
      else if (/sticker/.test(typeStr)) objectType = 'sticker';
      else objectType = 'frame';
      const direction = /column|vertical/.test(dirStr) ? 'column' as const : 'row' as const;
      return { type: 'row-create', count, direction, objectType };
    }
  }

  // Numbered flowchart — only match generic requests (no topic/description after "flowchart")
  // "create a flowchart" → template; "create a flowchart about sandwiches" → LLM
  const flowchartNumMatch = lower.match(/(?:create|make|build|generate)\s+(?:a\s+)?(?:(\d+)[- ]?step\s+)?flowchart(?:\s+with\s+(\d+)\s+(?:step|stage|node)s?)?/);
  if (flowchartNumMatch) {
    // Check if there's a topic/description after the match — if so, let the LLM handle it
    const afterMatch = lower.slice(flowchartNumMatch.index! + flowchartNumMatch[0].length).trim();
    const hasTopicSuffix = /^(?:about|for|showing|on|of|to|that|with|describing|explaining)\s/i.test(afterMatch);
    if (!hasTopicSuffix) {
      const stepCount = parseInt(flowchartNumMatch[1] || flowchartNumMatch[2] || '5', 10);
      if (stepCount >= 2 && stepCount <= 20) {
        return { type: 'numbered-flowchart', stepCount };
      }
    }
  }

  // Bulk creation
  const bulkMatch = prompt.match(
    /(?:create|add|make|generate|put|place)\s+(\d+)\s+(?:random\s+)?(sticky|stickies|note|notes|card|cards|shape|shapes|text|texts|sticker|stickers|emoji|emojis|frame|frames|random|object|objects|thing|things|item|items)/i,
  );
  const bulkMatchReversed = !bulkMatch
    ? prompt.match(/(\d+)\s+(?:random\s+)?(?:sticky|stickies|note|notes|card|cards|shape|shapes|text|texts|sticker|stickers|emoji|emojis|frame|frames|object|objects|thing|things|item|items)/i)
    : null;

  const rawCount = bulkMatch ? parseInt(bulkMatch[1], 10) : bulkMatchReversed ? parseInt(bulkMatchReversed[1], 10) : 0;
  const rawType = bulkMatch ? bulkMatch[2].toLowerCase() : bulkMatchReversed ? bulkMatchReversed[0].toLowerCase() : '';

  if (rawCount >= 1 && rawCount <= 500 && rawType) {
    const contentWords = /\b(?:about|with|for|titled|saying|containing|regarding|related|labeled|named|called)\b/i;
    if (contentWords.test(prompt)) return null;

    let objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'random';
    if (/sticky|stickies|note|notes|card|cards/.test(rawType)) objectType = 'sticky';
    else if (/shape|shapes/.test(rawType)) objectType = 'shape';
    else if (/text|texts/.test(rawType)) objectType = 'text';
    else if (/sticker|stickers|emoji|emojis/.test(rawType)) objectType = 'sticker';
    else if (/frame|frames/.test(rawType)) objectType = 'frame';
    else objectType = 'random';

    return { type: 'bulk-create', count: rawCount, objectType };
  }

  // Structural templates
  if (/\bswot\b/i.test(prompt)) return { type: 'template', templateType: 'swot' };
  if (/\bkanban\b|\bsprint\s*board\b/i.test(prompt)) return { type: 'template', templateType: 'kanban' };
  if (/\bretro(?:spective)?\b/i.test(prompt)) return { type: 'template', templateType: 'retrospective' };
  if (/\beisenhower\b|\bpriority\s*matrix\b|\burgent\s*important\b/i.test(prompt)) return { type: 'template', templateType: 'eisenhower' };
  if (/\bmind\s*map\b|\bbrainstorm(?:ing)?\s+(?:board|session|template)\b/i.test(prompt)) return { type: 'template', templateType: 'mind-map' };
  if (/\bpros?\s*(?:and|&|\/)\s*cons?\b/i.test(prompt)) return { type: 'template', templateType: 'pros-cons' };
  if (/\btimeline\b/i.test(prompt)) return { type: 'template', templateType: 'timeline' };
  if (/\b(?:user\s*)?journey\s*map\b/i.test(prompt)) return { type: 'template', templateType: 'journey' };

  // "2x2 matrix" alias
  const matrixMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)\s*matrix/);
  if (matrixMatch) {
    const rows = parseInt(matrixMatch[1], 10);
    const cols = parseInt(matrixMatch[2], 10);
    if (rows >= 1 && rows <= 50 && cols >= 1 && cols <= 50) {
      return { type: 'grid-create', rows, cols };
    }
  }

  // Single object creation
  const singleMatch = lower.match(
    /^(?:create|add|make|place|put)\s+(?:a\s+|an\s+)?(?:(yellow|blue|green|pink|purple|orange|red|cyan|teal)\s+)?(sticky\s*note|sticky|note|card|rectangle|rect|square|circle|ellipse|oval|triangle|diamond|pentagon|hexagon|octagon|star|arrow\s*shape|arrow|cross|plus|line|shape|frame|text\s*(?:box|element)?|text)\b/,
  );
  if (singleMatch) {
    const colorName = singleMatch[1];
    const typeStr = singleMatch[2];

    const labelMatch = prompt.match(/(?:called|titled|named|saying|that\s+says|labeled)\s+['"]?(.+?)['"]?\s*$/i)
      || prompt.match(/'([^']+)'/)
      || prompt.match(/"([^"]+)"/);
    const label = labelMatch ? labelMatch[1].trim() : undefined;

    const coordMatch = prompt.match(/at\s+(?:position\s+)?\(?(\d+)\s*[,\s]\s*(\d+)\)?/i);
    const x = coordMatch ? parseInt(coordMatch[1], 10) : undefined;
    const y = coordMatch ? parseInt(coordMatch[2], 10) : undefined;

    const SINGLE_COLOR_MAP: Record<string, string> = {
      yellow: '#fef9c3', blue: '#dbeafe', green: '#dcfce7', pink: '#fce7f3',
      purple: '#f3e8ff', orange: '#ffedd5', red: '#fecaca', cyan: '#cffafe', teal: '#ccfbf1',
    };
    const color = colorName ? SINGLE_COLOR_MAP[colorName] : undefined;

    if (/sticky|note|card/.test(typeStr)) {
      return { type: 'single-create', objectType: 'sticky', label, color, x, y };
    } else if (/frame/.test(typeStr)) {
      return { type: 'single-create', objectType: 'frame', label, x, y };
    } else if (/^text/.test(typeStr)) {
      return { type: 'single-create', objectType: 'text', label, x, y };
    } else if (/rect|square/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'rect', color, x, y };
    } else if (/circle|ellipse|oval/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'circle', color, x, y };
    } else if (/triangle/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'triangle', color, x, y };
    } else if (/diamond/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'diamond', color, x, y };
    } else if (/pentagon/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'pentagon', color, x, y };
    } else if (/hexagon/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'hexagon', color, x, y };
    } else if (/octagon/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'octagon', color, x, y };
    } else if (/star/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'star', color, x, y };
    } else if (/arrow/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'arrow', color, x, y };
    } else if (/cross|plus/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'cross', color, x, y };
    } else if (/line/.test(typeStr)) {
      return { type: 'single-create', objectType: 'shape', shapeType: 'line', color, x, y };
    } else {
      return { type: 'single-create', objectType: 'shape', shapeType: 'rect', color, x, y };
    }
  }

  return null;
}

// ---- Client-executable check ----

const CLIENT_EXECUTABLE_TYPES = new Set([
  'canned-response', 'flowchart', 'template', 'bulk-create',
  'single-create', 'grid-create', 'numbered-flowchart', 'row-create',
  'group-selection', 'duplicate-selection', 'table-create',
]);

export function isClientExecutable(match: TemplateMatch): boolean {
  return CLIENT_EXECUTABLE_TYPES.has(match.type);
}

// ---- Viewport helper ----

interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

function toViewport(v?: ViewportCenter): Viewport | undefined {
  if (!v) return undefined;
  return { x: v.x, y: v.y, width: v.width, height: v.height };
}

// ---- Client-side batch helper (splits at 450 ops) ----

function objectsCol(boardId: string) {
  return collection(db, 'boards', boardId, 'objects');
}

interface PendingDoc {
  id: string;
  data: Record<string, unknown>;
}

async function commitBatch(boardId: string, docs: PendingDoc[]): Promise<void> {
  const batchSize = 450;
  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const d of chunk) {
      batch.set(doc(objectsCol(boardId), d.id), d.data);
    }
    await batch.commit();
  }
}

// ---- Executor: Flowchart ----

async function executeFlowchartClient(
  nodes: string[],
  boardId: string,
  userId: string,
  viewport?: Viewport,
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const spacing = 280;
  const totalWidth = (nodes.length - 1) * spacing + 200;
  const startX = viewport
    ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalWidth) / 2)
    : 100;
  const startY = viewport ? Math.round(viewport.y - 100) : 300;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];
  const nodeIds: string[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const id = crypto.randomUUID();
    nodeIds.push(id);
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'sticky', text: nodes[i],
        x: startX + i * spacing, y: startY,
        width: 200, height: 200, color: '#fef9c3', textColor: '#1e293b',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
        aiLabel: nodes[i], aiGroupId: 'flowchart',
      },
    });
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'connector', fromId: nodeIds[i], toId: nodeIds[i + 1],
        style: 'straight', lineType: 'solid', startArrow: false, endArrow: true,
        strokeWidth: 2, color: '#6366f1',
        x: 0, y: 0, width: 0, height: 0,
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      },
    });
  }

  await commitBatch(boardId, docs);
  return { response: `Done! Created flowchart with ${nodes.length} steps.`, objectsCreated };
}

// ---- Executor: Template ----

async function executeTemplateClient(
  templateType: string,
  boardId: string,
  userId: string,
  viewport?: Viewport,
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const titleBarH = 36;
  const startX = viewport ? Math.round(viewport.x - viewport.width / 2 + 40) : 0;
  const startY = viewport ? Math.round(viewport.y - viewport.height / 2 + 40 + titleBarH) : titleBarH;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];

  function addFrame(x: number, y: number, w: number, h: number, title: string): string {
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'frame', title, x, y, width: w, height: h,
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
      },
    });
    return id;
  }

  function addSticky(x: number, y: number, text: string, color: string, parentId: string): string {
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'sticky', text, x, y, width: 180, height: 180,
        color, textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId,
      },
    });
    return id;
  }

  function addStickyFull(x: number, y: number, w: number, h: number, text: string, color: string, parentId: string, extra?: Record<string, unknown>): string {
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'sticky', text, x, y, width: w, height: h,
        color, textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId,
        ...extra,
      },
    });
    return id;
  }

  function addConnector(fromId: string, toId: string, style: string = 'straight'): string {
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'connector', fromId, toId, style,
        lineType: 'solid', startArrow: false, endArrow: true,
        strokeWidth: 2, color: '#6366f1',
        x: 0, y: 0, width: 0, height: 0,
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      },
    });
    return id;
  }

  switch (templateType) {
    case 'swot': {
      const fw = 400, fh = 300, gap = 30;
      const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
      const colors = ['#dcfce7', '#fce7f3', '#dbeafe', '#ffedd5'];
      const prompts = ['What are we good at?', 'Where can we improve?', 'What trends can we leverage?', 'What risks do we face?'];
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const fx = startX + col * (fw + gap);
        const fy = startY + row * (fh + titleBarH + gap);
        const frameId = addFrame(fx, fy, fw, fh, titles[i]);
        addSticky(fx + 20, fy + 20, prompts[i], colors[i], frameId);
      }
      break;
    }
    case 'kanban': {
      const fw = 350, fh = 600, gap = 30;
      const titles = ['To Do', 'In Progress', 'Done'];
      const colors = ['#fef9c3', '#dbeafe', '#dcfce7'];
      const prompts = ['Add tasks here', 'Work in progress', 'Completed tasks'];
      for (let i = 0; i < 3; i++) {
        const frameId = addFrame(startX + i * (fw + gap), startY, fw, fh, titles[i]);
        addSticky(startX + i * (fw + gap) + 20, startY + 20, prompts[i], colors[i], frameId);
      }
      break;
    }
    case 'retrospective': {
      const fw = 400, fh = 500, gap = 30;
      const titles = ['What Went Well \u{1F60A}', "What Didn't Go Well \u{1F61E}", 'Action Items \u{1F3AF}'];
      const colors = ['#dcfce7', '#fce7f3', '#dbeafe'];
      const prompts = ['Add your wins here', 'What could be better?', 'Next steps to take'];
      for (let i = 0; i < 3; i++) {
        const frameId = addFrame(startX + i * (fw + gap), startY, fw, fh, titles[i]);
        addSticky(startX + i * (fw + gap) + 20, startY + 20, prompts[i], colors[i], frameId);
      }
      break;
    }
    case 'eisenhower': {
      const fw = 400, fh = 300, gap = 30;
      const titles = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Neither'];
      const colors = ['#fce7f3', '#dbeafe', '#ffedd5', '#f3e8ff'];
      const prompts = ['Do it now', 'Schedule it', 'Delegate it', 'Drop it'];
      for (let i = 0; i < 4; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const fx = startX + col * (fw + gap);
        const fy = startY + row * (fh + titleBarH + gap);
        const frameId = addFrame(fx, fy, fw, fh, titles[i]);
        addSticky(fx + 20, fy + 20, prompts[i], colors[i], frameId);
      }
      break;
    }
    case 'mind-map': {
      const centerId = addStickyFull(startX + 400, startY + 300, 200, 200, 'Central Idea', '#fef9c3', '');
      const positions = [
        { x: startX, y: startY + 300 },
        { x: startX + 800, y: startY + 300 },
        { x: startX + 400, y: startY },
        { x: startX + 400, y: startY + 600 },
      ];
      for (let i = 0; i < 4; i++) {
        const branchId = addStickyFull(positions[i].x, positions[i].y, 200, 200, `Branch ${i + 1}`, '#dbeafe', '');
        addConnector(centerId, branchId, 'curved');
      }
      break;
    }
    case 'timeline': {
      const stageWidth = 200, stageGap = 80;
      const labels = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
      const colors = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#f3e8ff'];
      const nodeIds: string[] = [];
      for (let i = 0; i < 5; i++) {
        const id = addStickyFull(
          startX + i * (stageWidth + stageGap), startY + 100,
          stageWidth, stageWidth, labels[i], colors[i], '',
          { aiLabel: labels[i], aiGroupId: 'timeline' },
        );
        nodeIds.push(id);
      }
      for (let i = 0; i < 4; i++) {
        addConnector(nodeIds[i], nodeIds[i + 1]);
      }
      break;
    }
    case 'journey': {
      const stages = ['Awareness', 'Consideration', 'Decision', 'Onboarding', 'Retention'];
      const colors = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#f3e8ff'];
      const prompts = ['How do users discover us?', 'What do users evaluate?', 'What triggers the decision?', 'First experience?', 'What keeps users coming back?'];
      const colWidth = 250, gap = 20;
      for (let i = 0; i < stages.length; i++) {
        const fx = startX + i * (colWidth + gap);
        const frameId = addFrame(fx, startY, colWidth, 400, stages[i]);
        addStickyFull(fx + 20, startY + 20, 200, 180, prompts[i], colors[i], frameId);
      }
      break;
    }
    case 'pros-cons': {
      const fw = 400, fh = 500, gap = 30;
      const titles = ['Pros', 'Cons'];
      const colors = ['#dcfce7', '#fce7f3'];
      const prompts = ['Add advantages here', 'Add disadvantages here'];
      for (let i = 0; i < 2; i++) {
        const frameId = addFrame(startX + i * (fw + gap), startY, fw, fh, titles[i]);
        addSticky(startX + i * (fw + gap) + 20, startY + 20, prompts[i], colors[i], frameId);
      }
      break;
    }
  }

  await commitBatch(boardId, docs);

  const templateNames: Record<string, string> = {
    'swot': 'SWOT analysis', 'kanban': 'Kanban board', 'retrospective': 'retrospective',
    'eisenhower': 'Eisenhower matrix', 'mind-map': 'mind map',
    'timeline': 'timeline', 'journey': 'user journey map', 'pros-cons': 'pros and cons',
  };
  return { response: `Done! Created ${templateNames[templateType] || templateType}.`, objectsCreated };
}

// ---- Executor: Bulk Create ----

async function executeBulkCreateClient(
  count: number,
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'random',
  boardId: string,
  userId: string,
  viewport?: Viewport,
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const randomTypes: Array<'sticky' | 'shape' | 'text' | 'sticker'> = ['sticky', 'shape', 'text', 'sticker'];
  const emojis = [
    '\u{1F60A}', '\u{1F60E}', '\u{1F914}', '\u{1F923}', '\u{1F929}', '\u{1F970}', '\u{1F60D}', '\u{1F973}', '\u{1F618}', '\u{1F642}',
    '\u{1F3AF}', '\u{1F4A1}', '\u{1F525}', '\u{1F680}', '\u{1F3A8}', '\u{1F4CC}', '\u{1F3C6}', '\u{1F4AA}', '\u{1F3C0}', '\u{1F3B8}',
    '\u2B50', '\u2728', '\u{1F31F}', '\u{1F308}', '\u{1F30E}', '\u26A1', '\u2764\uFE0F', '\u{1F49C}', '\u{1F499}', '\u{1F49A}',
    '\u{1F436}', '\u{1F431}', '\u{1F98A}', '\u{1F43B}', '\u{1F984}', '\u{1F985}', '\u{1F422}', '\u{1F41D}', '\u{1F419}', '\u{1F433}',
    '\u{1F352}', '\u{1F34E}', '\u{1F34A}', '\u{1F353}', '\u{1F951}', '\u{1F355}', '\u{1F354}', '\u{1F370}', '\u{1F382}', '\u{2615}',
    '\u{1F332}', '\u{1F33B}', '\u{1F335}', '\u{1F340}', '\u{1F33A}', '\u{1F333}', '\u{1F490}', '\u{1F337}', '\u{1F338}', '\u{1F339}',
  ];
  const shapeTypes = ['rect', 'circle', 'triangle', 'diamond'];
  const objSize = objectType === 'text' ? { w: 200, h: 40 } : { w: 200, h: 200 };
  const padding = 20;
  const cols = Math.ceil(Math.sqrt(count));
  const cellW = objSize.w + padding;
  const cellH = objSize.h + padding;
  const totalW = cols * cellW;
  const totalH = Math.ceil(count / cols) * cellH;

  const baseX = viewport
    ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalW) / 2)
    : 100;
  const baseY = viewport
    ? Math.round(viewport.y - viewport.height / 2 + (viewport.height - totalH) / 2)
    : 100;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = baseX + col * cellW;
    const y = baseY + row * cellH;
    const color = colors[i % colors.length];
    const resolvedType = objectType === 'random' ? randomTypes[i % randomTypes.length] : objectType;
    const id = crypto.randomUUID();
    objectsCreated.push(id);

    let data: Record<string, unknown>;
    switch (resolvedType) {
      case 'sticky':
        data = { type: 'sticky', text: '', x, y, width: 200, height: 200, color, textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'shape':
        data = { type: 'shape', shapeType: shapeTypes[i % shapeTypes.length], x, y, width: 120, height: 120, color: '#dbeafe', strokeColor: '#4f46e5', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'text':
        data = { type: 'text', text: `Text ${i + 1}`, x, y, width: 200, height: 40, fontSize: 24, fontFamily: "'Inter', sans-serif", fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#1e293b', bgColor: 'transparent', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'sticker':
        data = { type: 'sticker', emoji: emojis[i % emojis.length], x, y, width: 150, height: 150, rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'frame':
        data = { type: 'frame', title: `Frame ${i + 1}`, x, y, width: 400, height: 300, rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true };
        break;
      default:
        data = { type: 'sticky', text: '', x, y, width: 200, height: 200, color, textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
    }
    docs.push({ id, data });
  }

  await commitBatch(boardId, docs);
  const typeLabel = objectType === 'random' ? 'objects' : `${objectType}${count !== 1 ? 's' : ''}`;
  return { response: `Done! Created ${count} ${typeLabel}.`, objectsCreated };
}

// ---- Executor: Single Create ----

async function executeSingleCreateClient(
  objectType: 'sticky' | 'shape' | 'text' | 'frame',
  boardId: string,
  userId: string,
  viewport?: Viewport,
  label?: string,
  color?: string,
  shapeType?: string,
  posX?: number,
  posY?: number,
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const x = posX ?? (viewport ? Math.round(viewport.x - 100) : 200);
  const y = posY ?? (viewport ? Math.round(viewport.y - 100) : 200);
  const id = crypto.randomUUID();

  let data: Record<string, unknown>;
  switch (objectType) {
    case 'sticky':
      data = { type: 'sticky', text: label ?? '', x, y, width: 200, height: 200, color: color ?? '#fef9c3', textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
      break;
    case 'shape':
      data = { type: 'shape', shapeType: shapeType ?? 'rect', x, y, width: 120, height: 120, color: color ?? '#dbeafe', strokeColor: '#4f46e5', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
      break;
    case 'text':
      data = { type: 'text', text: label ?? 'Text', x, y, width: 300, height: 50, fontSize: 24, fontFamily: "'Inter', sans-serif", fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#1e293b', bgColor: 'transparent', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
      break;
    case 'frame':
      data = { type: 'frame', title: label ?? 'Frame', x, y, width: 400, height: 300, rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true };
      break;
    default:
      data = { type: 'sticky', text: label ?? '', x, y, width: 200, height: 200, color: '#fef9c3', textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
  }

  await commitBatch(boardId, [{ id, data }]);
  const typeLabel = objectType === 'frame' ? `frame "${label || 'Frame'}"` : objectType;
  return {
    response: `Done! Created ${typeLabel}${label && objectType !== 'frame' ? ` with text "${label}"` : ''}.`,
    objectsCreated: [id],
  };
}

// ---- Executor: Grid Create ----

async function executeGridCreateClient(
  rows: number,
  cols: number,
  boardId: string,
  userId: string,
  viewport?: Viewport,
  labels?: string[],
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const cellW = 220, cellH = 220;
  const totalW = cols * cellW, totalH = rows * cellH;
  const baseX = viewport ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalW) / 2) : 100;
  const baseY = viewport ? Math.round(viewport.y - viewport.height / 2 + (viewport.height - totalH) / 2) : 100;
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const total = rows * cols;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];

  for (let i = 0; i < total; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const text = labels
      ? (labels.length === 1 ? labels[0] : (labels[i % labels.length] ?? ''))
      : '';
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'sticky', text, x: baseX + col * cellW, y: baseY + row * cellH,
        width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      },
    });
  }

  await commitBatch(boardId, docs);
  return { response: `Done! Created ${rows}x${cols} grid (${total} sticky notes).`, objectsCreated };
}

// ---- Executor: Row Create ----

async function executeRowCreateClient(
  count: number,
  direction: 'row' | 'column',
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame',
  boardId: string,
  userId: string,
  viewport?: Viewport,
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const emojis = ['\u{1F60A}', '\u{1F3AF}', '\u{1F4A1}', '\u{1F525}', '\u2B50', '\u{1F680}', '\u2728', '\u{1F3A8}', '\u{1F4CC}', '\u{1F3C6}'];
  const objSize = objectType === 'text' ? { w: 200, h: 40 } : { w: 200, h: 200 };
  const padding = 20;

  const totalSpan = direction === 'row'
    ? count * (objSize.w + padding)
    : count * (objSize.h + padding);

  const baseX = viewport
    ? Math.round(viewport.x - (direction === 'row' ? totalSpan / 2 : objSize.w / 2))
    : 100;
  const baseY = viewport
    ? Math.round(viewport.y - (direction === 'column' ? totalSpan / 2 : objSize.h / 2))
    : 100;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];

  for (let i = 0; i < count; i++) {
    const x = direction === 'row' ? baseX + i * (objSize.w + padding) : baseX;
    const y = direction === 'column' ? baseY + i * (objSize.h + padding) : baseY;
    const id = crypto.randomUUID();
    objectsCreated.push(id);

    let data: Record<string, unknown>;
    switch (objectType) {
      case 'sticky':
        data = { type: 'sticky', text: '', x, y, width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'shape':
        data = { type: 'shape', shapeType: 'rect', x, y, width: 120, height: 120, color: '#dbeafe', strokeColor: '#4f46e5', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'text':
        data = { type: 'text', text: `Text ${i + 1}`, x, y, width: 200, height: 40, fontSize: 24, fontFamily: "'Inter', sans-serif", fontWeight: 'normal', fontStyle: 'normal', textAlign: 'left', color: '#1e293b', bgColor: 'transparent', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'sticker':
        data = { type: 'sticker', emoji: emojis[i % emojis.length], x, y, width: 150, height: 150, rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
        break;
      case 'frame':
        data = { type: 'frame', title: `Frame ${i + 1}`, x, y, width: 400, height: 300, rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true };
        break;
      default:
        data = { type: 'sticky', text: '', x, y, width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b', rotation: 0, createdBy: userId, updatedAt: now, parentId: '' };
    }
    docs.push({ id, data });
  }

  await commitBatch(boardId, docs);
  const typeLabel = `${objectType}${count !== 1 ? 's' : ''}`;
  return { response: `Done! Created ${count} ${typeLabel} in a ${direction}.`, objectsCreated };
}

// ---- Executor: Group Selection ----

async function executeGroupSelectionClient(
  boardId: string,
  userId: string,
  selectedIds: string[],
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const objects = await getBoardObjects(boardId);
  const selected = objects.filter(obj => selectedIds.includes(obj.id));

  if (selected.length === 0) {
    return { response: 'No selected objects found on the board.', objectsCreated: [] };
  }

  // Calculate bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of selected) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }

  const padding = 20;
  const frameX = minX - padding;
  const frameY = minY - padding;
  const frameW = (maxX - minX) + padding * 2;
  const frameH = (maxY - minY) + padding * 2;

  const frameId = crypto.randomUUID();
  const docs: PendingDoc[] = [{
    id: frameId,
    data: {
      type: 'frame', title: 'Group', x: frameX, y: frameY, width: frameW, height: frameH,
      rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
    },
  }];

  await commitBatch(boardId, docs);

  // Update selected objects to set parentId to the new frame
  const updateBatch = writeBatch(db);
  for (const obj of selected) {
    updateBatch.update(doc(collection(db, 'boards', boardId, 'objects'), obj.id), { parentId: frameId });
  }
  await updateBatch.commit();

  return { response: `Done! Grouped ${selected.length} objects into a frame.`, objectsCreated: [frameId] };
}

// ---- Executor: Duplicate Selection ----

async function executeDuplicateSelectionClient(
  direction: 'below' | 'right',
  boardId: string,
  userId: string,
  selectedIds: string[],
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const objects = await getBoardObjects(boardId);
  const selected = objects.filter(obj => selectedIds.includes(obj.id));

  if (selected.length === 0) {
    return { response: 'No selected objects found on the board.', objectsCreated: [] };
  }

  // Calculate bounding box for offset
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const obj of selected) {
    minX = Math.min(minX, obj.x);
    minY = Math.min(minY, obj.y);
    maxX = Math.max(maxX, obj.x + obj.width);
    maxY = Math.max(maxY, obj.y + obj.height);
  }

  const gap = 40;
  const offsetX = direction === 'right' ? (maxX - minX) + gap : 0;
  const offsetY = direction === 'below' ? (maxY - minY) + gap : 0;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];

  for (const obj of selected) {
    const id = crypto.randomUUID();
    objectsCreated.push(id);

    // Copy relevant fields — strip id, adjust position
    const { id: _id, ...rest } = obj as unknown as Record<string, unknown>;
    docs.push({
      id,
      data: {
        ...rest,
        x: obj.x + offsetX,
        y: obj.y + offsetY,
        createdBy: userId,
        updatedAt: now,
        parentId: '',
      },
    });
  }

  await commitBatch(boardId, docs);
  return { response: `Done! Duplicated ${selected.length} objects ${direction}.`, objectsCreated };
}

// ---- Executor: Table Create ----

async function executeTableCreateClient(
  columns: number,
  boardId: string,
  userId: string,
  viewport?: Viewport,
  headers?: string[],
): Promise<{ response: string; objectsCreated: string[] }> {
  const now = Date.now();
  const colWidth = 180;
  const headerHeight = 50;
  const rowHeight = 200;
  const gap = 10;
  const rows = 3; // default 3 data rows
  const totalWidth = columns * (colWidth + gap) - gap;
  const totalHeight = headerHeight + gap + rows * (rowHeight + gap) - gap;

  const startX = viewport ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalWidth) / 2) : 100;
  const startY = viewport ? Math.round(viewport.y - viewport.height / 2 + (viewport.height - totalHeight) / 2) : 100;

  const objectsCreated: string[] = [];
  const docs: PendingDoc[] = [];
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];

  // Create frame to contain the table
  const frameId = crypto.randomUUID();
  objectsCreated.push(frameId);
  docs.push({
    id: frameId,
    data: {
      type: 'frame', title: 'Table', x: startX - 20, y: startY - 20,
      width: totalWidth + 40, height: totalHeight + 40,
      rotation: 0, createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
    },
  });

  // Create header row as bold text objects
  for (let c = 0; c < columns; c++) {
    const headerText = headers && headers[c] ? headers[c] : `Column ${c + 1}`;
    const id = crypto.randomUUID();
    objectsCreated.push(id);
    docs.push({
      id,
      data: {
        type: 'text', text: headerText,
        x: startX + c * (colWidth + gap), y: startY,
        width: colWidth, height: headerHeight,
        fontSize: 18, fontFamily: "'Inter', sans-serif", fontWeight: 'bold',
        fontStyle: 'normal', textAlign: 'center', color: '#1e293b', bgColor: 'transparent',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: frameId,
      },
    });
  }

  // Create data cells as sticky notes
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const id = crypto.randomUUID();
      objectsCreated.push(id);
      docs.push({
        id,
        data: {
          type: 'sticky', text: '',
          x: startX + c * (colWidth + gap),
          y: startY + headerHeight + gap + r * (rowHeight + gap),
          width: colWidth, height: rowHeight,
          color: colors[c % colors.length], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameId,
        },
      });
    }
  }

  await commitBatch(boardId, docs);
  const headerLabel = headers?.length ? ` (${headers.join(', ')})` : '';
  return { response: `Done! Created table with ${columns} columns${headerLabel} and ${rows} rows.`, objectsCreated };
}

// ---- Main dispatcher ----

export async function executeTemplateMatch(
  match: TemplateMatch,
  boardId: string,
  userId: string,
  viewport?: ViewportCenter,
  selectedIds?: string[],
): Promise<{ response: string; objectsCreated: string[] }> {
  const vp = toViewport(viewport);

  switch (match.type) {
    case 'canned-response':
      return { response: match.response, objectsCreated: [] };
    case 'flowchart':
      return executeFlowchartClient(match.nodes, boardId, userId, vp);
    case 'template':
      return executeTemplateClient(match.templateType, boardId, userId, vp);
    case 'bulk-create':
      return executeBulkCreateClient(match.count, match.objectType, boardId, userId, vp);
    case 'single-create':
      return executeSingleCreateClient(match.objectType, boardId, userId, vp, match.label, match.color, match.shapeType, match.x, match.y);
    case 'grid-create':
      return executeGridCreateClient(match.rows, match.cols, boardId, userId, vp, match.labels);
    case 'numbered-flowchart': {
      const nodes = Array.from({ length: match.stepCount }, (_, i) => `Step ${i + 1}`);
      return executeFlowchartClient(nodes, boardId, userId, vp);
    }
    case 'row-create':
      return executeRowCreateClient(match.count, match.direction, match.objectType, boardId, userId, vp);
    case 'group-selection':
      if (!selectedIds?.length) throw new Error('No objects selected for grouping.');
      return executeGroupSelectionClient(boardId, userId, selectedIds);
    case 'duplicate-selection':
      if (!selectedIds?.length) throw new Error('No objects selected for duplication.');
      return executeDuplicateSelectionClient(match.direction, boardId, userId, selectedIds);
    case 'table-create':
      return executeTableCreateClient(match.columns, boardId, userId, vp, match.headers);
    default:
      throw new Error(`Unhandled client template type: ${(match as TemplateMatch).type}`);
  }
}
