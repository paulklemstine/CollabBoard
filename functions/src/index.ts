import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type Anthropic from '@anthropic-ai/sdk';

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const giphyApiKey = defineSecret('GIPHY_API_KEY');

// ---- Cached Anthropic client singleton (import once per function instance, reuse across warm invocations) ----
let _anthropicClient: Anthropic | null = null;

async function getAnthropicClient(): Promise<Anthropic> {
  if (!_anthropicClient) {
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    _anthropicClient = new AnthropicSDK({ apiKey: anthropicApiKey.value() });
  }
  return _anthropicClient;
}

// ---- GIPHY search (server-side, no SDK needed) ----

async function searchGiphy(query: string): Promise<string | null> {
  const key = giphyApiKey.value().trim();
  if (!key) {
    console.warn('searchGiphy: GIPHY_API_KEY secret is empty');
    return null;
  }
  try {
    const url = `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&limit=10`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`searchGiphy: GIPHY API returned ${res.status} for query "${query}"`);
      return null;
    }
    const json = await res.json();
    const gifs = json.data;
    if (!gifs?.length) {
      console.warn(`searchGiphy: no results for query "${query}"`);
      return null;
    }
    const gif = gifs[Math.floor(Math.random() * gifs.length)];
    const img = gif.images?.fixed_height ?? gif.images?.original;
    return img?.url || null;
  } catch (err) {
    console.warn('searchGiphy: fetch error:', err);
    return null;
  }
}

// ---- Tool definitions (trimmed for token efficiency) ----
// All create tools share: x,y (position), parentId (frame), aiLabel, aiGroupId, aiGroupLabel
// Defaults handled server-side — descriptions omit them.

const tools = [
  {
    name: 'executePlan',
    description: 'Execute multiple creation ops in one atomic batch. Use tempIds for cross-refs (e.g. connector fromId refs a sticky tempId). Ops: createStickyNote, createShape, createFrame, createSticker, createGifSticker, createText, createConnector.',
    input_schema: {
      type: 'object' as const,
      properties: {
        operations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: ['createStickyNote', 'createShape', 'createFrame', 'createSticker', 'createGifSticker', 'createText', 'createConnector'] },
              tempId: { type: 'string', description: 'Optional temp ID for cross-referencing between ops' },
              params: { type: 'object', description: 'Op params — createStickyNote: text,color,textColor,width,height. createShape: shapeType(rect|circle|triangle|diamond|pentagon|hexagon|octagon|star|arrow|cross|line),color,strokeColor,width,height. createFrame: title,width,height,borderless. createSticker: emoji(single Unicode emoji char e.g. "🐱","🦊","🐶"),size. createGifSticker: searchTerm,size. createText: text,fontSize,fontFamily,fontWeight,fontStyle,textAlign,color,bgColor,width,height. createConnector: fromId,toId,color,lineType. All ops accept: x,y,parentId,aiLabel,aiGroupId.' },
            },
            required: ['op'],
          },
        },
        aiGroupId: { type: 'number' },
        aiGroupLabel: { type: 'string' },
      },
      required: ['operations'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move object to x,y.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, x: { type: 'number' }, y: { type: 'number' } },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'resizeObject',
    description: 'Resize object.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, width: { type: 'number' }, height: { type: 'number' } },
      required: ['objectId', 'width', 'height'],
    },
  },
  {
    name: 'updateText',
    description: 'Update text of sticky/text element.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, newText: { type: 'string' } },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description: 'Change object colors. Provide only fields to change: newColor(bg/fill), textColor, strokeColor, bgColor, borderColor.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string' },
        newColor: { type: 'string' }, textColor: { type: 'string' },
        strokeColor: { type: 'string' }, bgColor: { type: 'string' }, borderColor: { type: 'string' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete one object.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' } },
      required: ['objectId'],
    },
  },
  {
    name: 'deleteObjects',
    description: 'Bulk delete objects by IDs.',
    input_schema: {
      type: 'object' as const,
      properties: { objectIds: { type: 'array', items: { type: 'string' } } },
      required: ['objectIds'],
    },
  },
  {
    name: 'updateParent',
    description: 'Set parent frame. Empty string "" = detach.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, newParentId: { type: 'string' } },
      required: ['objectId', 'newParentId'],
    },
  },
  {
    name: 'embedInFrame',
    description: 'Move objects into frame, auto-reposition.',
    input_schema: {
      type: 'object' as const,
      properties: { objectIds: { type: 'array', items: { type: 'string' } }, frameId: { type: 'string' } },
      required: ['objectIds', 'frameId'],
    },
  },
  {
    name: 'alignObjects',
    description: 'Align objects. center-x=vertical column, center-y=horizontal row.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' } },
        alignment: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'center-x', 'center-y', 'distribute-horizontal', 'distribute-vertical'] },
        spacing: { type: 'number' },
      },
      required: ['objectIds', 'alignment'],
    },
  },
  {
    name: 'layoutObjects',
    description: 'Arrange in pattern.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' } },
        mode: { type: 'string', enum: ['row', 'column', 'grid', 'staggered', 'circular', 'pack', 'fan'] },
        spacing: { type: 'number' }, startX: { type: 'number' }, startY: { type: 'number' },
        columns: { type: 'number' }, radius: { type: 'number' }, arcDegrees: { type: 'number' },
        alignment: { type: 'string', enum: ['start', 'center', 'end'] },
      },
      required: ['objectIds', 'mode'],
    },
  },
  {
    name: 'duplicateObject',
    description: 'Duplicate object N times with offset.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string' }, count: { type: 'number' },
        offsetX: { type: 'number' }, offsetY: { type: 'number' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'setZIndex',
    description: 'Change layer order.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string' },
        operation: { type: 'string', enum: ['toFront', 'toBack', 'forward', 'backward'] },
      },
      required: ['objectId', 'operation'],
    },
  },
  {
    name: 'rotateObject',
    description: 'Rotate object (degrees).',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, rotation: { type: 'number' } },
      required: ['objectId', 'rotation'],
    },
  },
  {
    name: 'getObject',
    description: 'Get full object details by ID.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' } },
      required: ['objectId'],
    },
  },
  {
    name: 'updateFrameTitle',
    description: 'Update frame title.',
    input_schema: {
      type: 'object' as const,
      properties: { objectId: { type: 'string' }, title: { type: 'string' } },
      required: ['objectId', 'title'],
    },
  },
  {
    name: 'searchObjects',
    description: 'Search by type/text/parentId. AND logic.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectType: { type: 'string', description: 'sticky|shape|frame|sticker|connector|text' },
        textContains: { type: 'string' }, parentId: { type: 'string' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'getBoardSummary',
    description: 'Counts by type + frame list with IDs.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'getBoardState',
    description: 'Full compact board state with all object IDs and properties.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'getSelectedObjects',
    description: 'Get details of user-selected objects.',
    input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
];

// Human-readable labels for deterministic summaries (C1)
const TOOL_LABELS: Record<string, string> = {
  executePlan: 'Executed plan',
  moveObject: 'Moved object',
  resizeObject: 'Resized object',
  updateText: 'Updated text',
  changeColor: 'Changed color',
  deleteObject: 'Deleted object',
  updateParent: 'Changed parent',
  embedInFrame: 'Embedded in frame',
  alignObjects: 'Aligned objects',
  layoutObjects: 'Arranged layout',
  duplicateObject: 'Duplicated object',
  setZIndex: 'Changed layer order',
  rotateObject: 'Rotated object',
  getObject: 'Fetched object',
  updateFrameTitle: 'Updated frame title',
  searchObjects: 'Searched objects',
  getBoardSummary: 'Read board summary',
  deleteObjects: 'Deleted objects',
  getBoardState: 'Read board state',
  getSelectedObjects: 'Fetched selected objects',
};

// ---- System prompt ----

const SYSTEM_PROMPT = `You are Flow Space AI — a collaborative whiteboard assistant. Use tools to create/manipulate objects. Emit ALL tool calls in a single response.

CREATE objects via executePlan — ONE call with all operations. Use tempIds to cross-reference (e.g. connector refs a sticky's tempId).
Examples:
{"operations":[{"op":"createStickyNote","tempId":"s1","params":{"text":"Hello","x":100,"y":100}},{"op":"createConnector","params":{"fromId":"s1","toId":"s2"}}]}
{"operations":[{"op":"createFrame","tempId":"f1","params":{"title":"Ideas","x":100,"y":100,"width":460,"height":260}},{"op":"createStickyNote","params":{"text":"First","x":120,"y":120,"parentId":"f1"}},{"op":"createStickyNote","params":{"text":"Second","x":340,"y":120,"parentId":"f1"}}]}

Compact board state keys: w=width, h=height, pid=parentId, rot=rotation, sel=selected.

Canvas: infinite, X→right, Y→down. (0,0)=top-left of ~1200x800 viewport.

Frames: ALWAYS set parentId on children when creating objects inside a frame — use the frame's tempId. Coords are ABSOLUTE. Title bar renders ABOVE frame.y. Position children at frameX+20, frameY+20. Use embedInFrame for bulk. updateParent auto-repositions.

Layout: layoutObjects (row/column/grid/staggered/circular/pack/fan). alignObjects (left/right/top/bottom/center-x/center-y/distribute-horizontal/distribute-vertical). "Align horizontally"=same Y (row). "Align vertically"=same X (column). Auto spacing 20px.

Colors — Yellow:#fef9c3 Blue:#dbeafe Green:#dcfce7 Pink:#fce7f3 Purple:#f3e8ff Orange:#ffedd5
Fonts — sans(Inter) serif(Georgia) mono(Fira Code) cursive(Caveat)

Stickers: createSticker emoji param is REQUIRED — must be a single Unicode emoji character (e.g. "🐱","🦊","🐶","🦁","🐸"). Always vary emojis — never repeat the same one. For animated GIFs use createGifSticker with searchTerm.

Always provide aiLabel + aiGroupId. Provide aiGroupLabel once per group. borderless=true for invisible frames.

Selected objects listed as "Currently selected objects". "these"/"selected"/"this" = selected IDs. Use directly with tools.

Inspect board: getBoardState/getBoardSummary/searchObjects. Single object: getObject. Bulk delete: deleteObjects.

Reply SHORT — 1-2 casual sentences. No IDs/coords/technical details.`;

// ---- Helper: read board state ----

async function readBoardState(boardId: string) {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Classify whether a prompt needs existing board context.
 * Creation-only prompts (e.g. "make a sticky note") don't need board state at all.
 * Context-needed prompts (e.g. "organize the board") get a compact summary.
 */
function requestNeedsContext(prompt: string): 'none' | 'summary' {
  const lower = prompt.toLowerCase();
  // Keywords indicating the user wants to interact with existing objects
  const contextKeywords = [
    'move', 'delete', 'remove', 'change', 'update', 'edit', 'rename',
    'organize', 'arrange', 'align', 'sort', 'reorder', 'rearrange',
    'what', 'how many', 'list', 'show', 'find', 'search', 'where',
    'existing', 'current', 'the board', 'on the board', 'all ',
    'clear', 'clean', 'duplicate', 'copy', 'resize', 'rotate',
    'connect', 'group', 'ungroup', 'color', 'recolor',
    'selected', 'these', 'this',
  ];
  for (const kw of contextKeywords) {
    if (lower.includes(kw)) return 'summary';
  }
  return 'none';
}

/**
 * Build a compact board summary string: counts by type + frame list.
 * Much cheaper than full JSON board state.
 */
function buildBoardSummary(boardState: any[]): string {
  if (boardState.length === 0) return 'Board is empty.';
  const byType: Record<string, number> = {};
  const childCounts: Record<string, number> = {};
  const frames: { id: string; title: string; childCount: number }[] = [];
  for (const obj of boardState) {
    byType[obj.type] = (byType[obj.type] || 0) + 1;
    if (obj.parentId) childCounts[obj.parentId] = (childCounts[obj.parentId] || 0) + 1;
  }
  for (const obj of boardState) {
    if (obj.type === 'frame') {
      frames.push({ id: obj.id, title: obj.title ?? 'Untitled', childCount: childCounts[obj.id] || 0 });
    }
  }
  const parts = [`${boardState.length} objects`];
  for (const [type, count] of Object.entries(byType)) {
    parts.push(`${count} ${type}${count > 1 ? 's' : ''}`);
  }
  let summary = parts.join(', ') + '.';
  if (frames.length > 0) {
    summary += ' Frames: ' + frames.map(f => `${f.title} (${f.id}, ${f.childCount > 0 ? f.childCount + ' children' : 'empty'})`).join(', ') + '.';
  }
  return summary;
}

/**
 * Strip unnecessary fields and use short keys to reduce token count.
 * Drops: updatedAt, createdBy, zIndex (when 0), rotation (when 0), default colors.
 */
function compactBoardObject(obj: any): Record<string, unknown> {
  const compact: Record<string, unknown> = { id: obj.id, type: obj.type };
  // Position — always include
  compact.x = obj.x;
  compact.y = obj.y;
  // Dimensions — short keys
  if (obj.width != null) compact.w = obj.width;
  if (obj.height != null) compact.h = obj.height;
  // Parent — short key, skip empty
  if (obj.parentId) compact.pid = obj.parentId;
  // Text content
  if (obj.text != null) compact.text = obj.text;
  if (obj.title != null) compact.title = obj.title;
  // Shape-specific
  if (obj.shapeType) compact.shapeType = obj.shapeType;
  // Emoji/sticker
  if (obj.emoji) compact.emoji = obj.emoji;
  if (obj.gifSearchTerm) compact.gif = obj.gifSearchTerm;
  // Colors — skip defaults
  const defaultColors: Record<string, string> = {
    'sticky:color': '#fef9c3',
    'sticky:textColor': '#1e293b',
    'shape:color': '#dbeafe',
    'shape:strokeColor': '#4f46e5',
    'text:color': '#1e293b',
    'text:bgColor': 'transparent',
    'connector:color': '#6366f1',
  };
  for (const field of ['color', 'textColor', 'strokeColor', 'bgColor', 'borderColor']) {
    if (obj[field] != null) {
      const defaultKey = `${obj.type}:${field}`;
      if (obj[field] !== defaultColors[defaultKey]) {
        compact[field] = obj[field];
      }
    }
  }
  // Rotation — skip when 0
  if (obj.rotation) compact.rot = obj.rotation;
  // Connector fields
  if (obj.fromId) compact.fromId = obj.fromId;
  if (obj.toId) compact.toId = obj.toId;
  if (obj.style && obj.style !== 'straight') compact.style = obj.style;
  if (obj.lineType && obj.lineType !== 'solid') compact.lineType = obj.lineType;
  if (obj.startArrow) compact.startArrow = true;
  if (obj.endArrow) compact.endArrow = true;
  // Text styling — skip defaults
  if (obj.fontSize && obj.fontSize !== 24) compact.fontSize = obj.fontSize;
  if (obj.fontWeight && obj.fontWeight !== 'normal') compact.fontWeight = obj.fontWeight;
  if (obj.fontStyle && obj.fontStyle !== 'normal') compact.fontStyle = obj.fontStyle;
  if (obj.textAlign && obj.textAlign !== 'left') compact.textAlign = obj.textAlign;
  if (obj.fontFamily && obj.fontFamily !== "'Inter', sans-serif") compact.fontFamily = obj.fontFamily;
  // Frame borderless
  if (obj.borderless) compact.borderless = true;
  // AI metadata
  if (obj.aiLabel) compact.aiLabel = obj.aiLabel;
  if (obj.aiGroupId) compact.aiGroupId = obj.aiGroupId;
  return compact;
}

// ---- Tool execution ----

interface ToolInput {
  text?: string;
  x?: number;
  y?: number;
  color?: string;
  textColor?: string;
  strokeColor?: string;
  borderColor?: string;
  shapeType?: string;
  width?: number;
  height?: number;
  size?: number;
  emoji?: string;
  title?: string;
  fromId?: string;
  toId?: string;
  style?: string;
  lineType?: string;
  startArrow?: boolean;
  endArrow?: boolean;
  strokeWidth?: number;
  fontSize?: number;
  fontWeight?: string;
  fontStyle?: string;
  textAlign?: string;
  fontFamily?: string;
  bgColor?: string;
  searchTerm?: string;
  objectId?: string;
  newText?: string;
  newColor?: string;
  parentId?: string;
  borderless?: boolean;
  newParentId?: string;
  rotation?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  objectIds?: string[];
  alignment?: string;
  columns?: number;
  spacing?: number;
  startX?: number;
  startY?: number;
  mode?: string;
  radius?: number;
  arcDegrees?: number;
  count?: number;
  offsetX?: number;
  offsetY?: number;
  operation?: string;
  templateType?: string;
  aiLabel?: string;
  aiGroupId?: number;
  aiGroupLabel?: string;
  objectType?: string;
  textContains?: string;
  frameId?: string;
}

// ---- Layout helpers ----

interface LayoutObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LayoutPosition {
  id: string;
  x: number;
  y: number;
}

function computeAutoOrigin(objects: LayoutObject[]) {
  const minX = Math.min(...objects.map(o => o.x));
  const minY = Math.min(...objects.map(o => o.y));
  const maxX = Math.max(...objects.map(o => o.x + o.width));
  const maxY = Math.max(...objects.map(o => o.y + o.height));
  return { minX, minY, maxX, maxY, centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2 };
}

/** After aligning on one axis, nudge apart on the perpendicular axis to prevent overlaps. */
function nudgeOverlaps(objects: LayoutObject[], axis: 'x' | 'y', spacing: number): void {
  if (axis === 'y') {
    objects.sort((a, b) => a.y - b.y);
    for (let i = 1; i < objects.length; i++) {
      const minY = objects[i - 1].y + objects[i - 1].height + spacing;
      if (objects[i].y < minY) objects[i].y = minY;
    }
  } else {
    objects.sort((a, b) => a.x - b.x);
    for (let i = 1; i < objects.length; i++) {
      const minX = objects[i - 1].x + objects[i - 1].width + spacing;
      if (objects[i].x < minX) objects[i].x = minX;
    }
  }
}

function layoutRow(objects: LayoutObject[], spacing: number, startX: number, startY: number, crossAlign: string): LayoutPosition[] {
  const sorted = [...objects].sort((a, b) => a.x - b.x);
  const maxH = Math.max(...sorted.map(o => o.height));
  let cursorX = startX;
  return sorted.map(obj => {
    const y = crossAlign === 'start' ? startY
      : crossAlign === 'end' ? startY + maxH - obj.height
      : startY + (maxH - obj.height) / 2;
    const pos = { id: obj.id, x: cursorX, y };
    cursorX += obj.width + spacing;
    return pos;
  });
}

function layoutColumn(objects: LayoutObject[], spacing: number, startX: number, startY: number, crossAlign: string): LayoutPosition[] {
  const sorted = [...objects].sort((a, b) => a.y - b.y);
  const maxW = Math.max(...sorted.map(o => o.width));
  let cursorY = startY;
  return sorted.map(obj => {
    const x = crossAlign === 'start' ? startX
      : crossAlign === 'end' ? startX + maxW - obj.width
      : startX + (maxW - obj.width) / 2;
    const pos = { id: obj.id, x, y: cursorY };
    cursorY += obj.height + spacing;
    return pos;
  });
}

function layoutGrid(objects: LayoutObject[], columns: number, spacing: number, startX: number, startY: number): LayoutPosition[] {
  const rows = Math.ceil(objects.length / columns);
  const colWidths = new Array(columns).fill(0);
  const rowHeights = new Array(rows).fill(0);

  for (let i = 0; i < objects.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    colWidths[col] = Math.max(colWidths[col], objects[i].width);
    rowHeights[row] = Math.max(rowHeights[row], objects[i].height);
  }

  // Prefix sums for offsets
  const colOffsets = [startX];
  for (let c = 1; c < columns; c++) colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + spacing;
  const rowOffsets = [startY];
  for (let r = 1; r < rows; r++) rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + spacing;

  return objects.map((obj, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    return {
      id: obj.id,
      x: colOffsets[col] + (colWidths[col] - obj.width) / 2,
      y: rowOffsets[row] + (rowHeights[row] - obj.height) / 2,
    };
  });
}

function layoutStaggered(objects: LayoutObject[], columns: number, spacing: number, startX: number, startY: number): LayoutPosition[] {
  const rows = Math.ceil(objects.length / columns);
  const colWidths = new Array(columns).fill(0);
  const rowHeights = new Array(rows).fill(0);

  for (let i = 0; i < objects.length; i++) {
    const col = i % columns;
    const row = Math.floor(i / columns);
    colWidths[col] = Math.max(colWidths[col], objects[i].width);
    rowHeights[row] = Math.max(rowHeights[row], objects[i].height);
  }

  const colOffsets = [startX];
  for (let c = 1; c < columns; c++) colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + spacing;
  const rowOffsets = [startY];
  for (let r = 1; r < rows; r++) rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + spacing;

  return objects.map((obj, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    const staggerOffset = (row % 2 === 1) ? (colWidths[0] + spacing) / 2 : 0;
    return {
      id: obj.id,
      x: colOffsets[col] + staggerOffset + (colWidths[col] - obj.width) / 2,
      y: rowOffsets[row] + (rowHeights[row] - obj.height) / 2,
    };
  });
}

function layoutCircular(objects: LayoutObject[], radiusInput: number | undefined, spacing: number, centerX: number, centerY: number): LayoutPosition[] {
  const n = objects.length;
  if (n === 1) return [{ id: objects[0].id, x: centerX - objects[0].width / 2, y: centerY - objects[0].height / 2 }];

  const maxDim = Math.max(...objects.map(o => Math.max(o.width, o.height)));
  const autoRadius = (n * (maxDim + spacing)) / (2 * Math.PI);
  const radius = radiusInput ?? Math.max(autoRadius, 150);
  const angleStep = (2 * Math.PI) / n;

  return objects.map((obj, i) => {
    const angle = i * angleStep - Math.PI / 2; // start from top (12 o'clock)
    return {
      id: obj.id,
      x: centerX + radius * Math.cos(angle) - obj.width / 2,
      y: centerY + radius * Math.sin(angle) - obj.height / 2,
    };
  });
}

function layoutPack(objects: LayoutObject[], spacing: number, startX: number, startY: number): LayoutPosition[] {
  // Shelf-based bin packing — sort tall-first for better packing
  const sorted = [...objects].sort((a, b) => b.height - a.height);
  const totalArea = sorted.reduce((sum, o) => sum + o.width * o.height, 0);
  const maxWidth = Math.max(Math.sqrt(totalArea) * 1.3, Math.max(...sorted.map(o => o.width)) + spacing);

  const shelves: { y: number; height: number; cursorX: number }[] = [];
  const positions: LayoutPosition[] = [];

  for (const obj of sorted) {
    let placed = false;
    for (const shelf of shelves) {
      if (shelf.cursorX + obj.width <= maxWidth) {
        positions.push({ id: obj.id, x: startX + shelf.cursorX, y: startY + shelf.y });
        shelf.cursorX += obj.width + spacing;
        shelf.height = Math.max(shelf.height, obj.height);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const newShelfY = shelves.length > 0
        ? shelves[shelves.length - 1].y + shelves[shelves.length - 1].height + spacing
        : 0;
      positions.push({ id: obj.id, x: startX, y: startY + newShelfY });
      shelves.push({ y: newShelfY, height: obj.height, cursorX: obj.width + spacing });
    }
  }
  return positions;
}

function layoutFan(objects: LayoutObject[], radiusInput: number | undefined, arcDegrees: number, spacing: number, centerX: number, centerY: number): LayoutPosition[] {
  const n = objects.length;
  if (n === 1) return [{ id: objects[0].id, x: centerX - objects[0].width / 2, y: centerY - objects[0].height / 2 }];

  const arcRadians = (arcDegrees * Math.PI) / 180;
  const maxDim = Math.max(...objects.map(o => Math.max(o.width, o.height)));
  const autoRadius = (n * (maxDim + spacing)) / arcRadians;
  const radius = radiusInput ?? Math.max(autoRadius, 150);

  // Center the arc so it opens downward from center
  const startAngle = -arcRadians / 2 - Math.PI / 2;
  const angleStep = n > 1 ? arcRadians / (n - 1) : 0;

  return objects.map((obj, i) => {
    const angle = startAngle + i * angleStep;
    return {
      id: obj.id,
      x: centerX + radius * Math.cos(angle) - obj.width / 2,
      y: centerY + radius * Math.sin(angle) - obj.height / 2,
    };
  });
}

const FONT_FAMILY_MAP: Record<string, string> = {
  sans: "'Inter', sans-serif",
  serif: "'Georgia', serif",
  mono: "'Fira Code', monospace",
  cursive: "'Caveat', cursive",
};
function resolveFontFamily(input?: string): string {
  return FONT_FAMILY_MAP[input ?? 'sans'] ?? FONT_FAMILY_MAP.sans;
}


/**
 * Pure function: builds Firestore document data for a creation operation
 * without writing to the database. Used by executePlan and executeTool.
 */

// ---- Template Engine: bypass LLM for known patterns ----

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
}

function detectTemplate(prompt: string): TemplateMatch | null {
  const lower = prompt.toLowerCase().trim();

  // Canned responses: "undo", "help", "what can you do"
  if (/^(?:undo|undo\s+(?:last|that|it))$/i.test(lower)) {
    return { type: 'canned-response', response: 'Use Ctrl+Z (Cmd+Z on Mac) to undo. The AI cannot undo actions.' };
  }
  if (/^(?:help|what\s+can\s+you\s+do|commands|what\s+are\s+your\s+(?:commands|capabilities))\??$/i.test(lower)) {
    return { type: 'canned-response', response: 'I can create objects (stickies, shapes, frames, text, connectors), move/resize/delete them, arrange layouts (grids, rows, columns), build templates (SWOT, kanban, retro, timeline, journey map, flowchart, mind map), and manipulate colors. Try: "create a SWOT analysis", "add 10 stickies", "arrange in a grid", or "A -> B -> C" for a flowchart.' };
  }

  // Flowchart arrow syntax: "A -> B -> C" or "A --> B" or "A → B"
  const arrowParts = prompt.split(/\s*(?:->|-->|→)\s*/);
  if (arrowParts.length >= 2 && arrowParts.every(p => p.trim().length > 0 && p.trim().length < 100)) {
    return { type: 'flowchart', nodes: arrowParts.map(p => p.trim()) };
  }

  // Clear / delete all: "clear the board", "delete everything", "remove all objects"
  if (/^(?:clear|clean|wipe)\s+(?:the\s+)?(?:board|canvas|everything|all)/i.test(lower)
    || /^(?:delete|remove)\s+everything/i.test(lower)
    || /^(?:delete|remove)\s+all\s*$/i.test(lower)
    || /^(?:delete|remove)\s+all\s+(?:objects?|things?|items?|of\s+(?:them|it))/i.test(lower)) {
    return { type: 'clear-board' };
  }

  // Selective delete: "delete all stickies", "remove all shapes", "delete all frames"
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

  // Bulk color change: "color all stickies blue", "make everything red", "change all shapes to green"
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
  // Also try reversed: "make blue all stickies" or simpler "color everything blue"
  const bulkColorMatch2 = !bulkColorMatch ? lower.match(new RegExp(
    `(?:color|change|make|set|turn)\\s+(?:all\\s+)?(?:the\\s+)?(?:everything|objects?|stickies|sticky\\s*notes?|notes?|shapes?|texts?|frames?)\\s+(?:to\\s+)?(${colorNames})`,
  )) : null;

  if (bulkColorMatch || bulkColorMatch2) {
    const m = bulkColorMatch || bulkColorMatch2;
    if (m) {
      // Find the color name in the match
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

  // Arrange in a grid: "arrange in a grid", "organize in a grid", "lay out in a grid"
  if (/(?:arrange|organize|layout|lay\s+out|sort|align)\s+(?:them\s+|these\s+|objects?\s+|everything\s+)?(?:in(?:to)?\s+)?(?:a\s+)?grid/i.test(lower)) {
    return { type: 'arrange-grid' };
  }

  // Grid pattern: "create a 3x4 grid of stickies", "make a 2x3 grid"
  const gridMatch = lower.match(/(\d+)\s*[x×by]\s*(\d+)\s*(?:grid\s*(?:of\s*)?)?(?:sticky|stickies|note|notes|card|cards)?/);
  if (gridMatch) {
    const rows = parseInt(gridMatch[1], 10);
    const cols = parseInt(gridMatch[2], 10);
    if (rows >= 1 && rows <= 50 && cols >= 1 && cols <= 50 && rows * cols <= 500) {
      const labelMatch = prompt.match(/\bfor\s+(.+)$/i);
      let labels: string[] | undefined;
      if (labelMatch) {
        labels = labelMatch[1].split(/\s+and\s+|,\s*/i).map(s => s.trim()).filter(Boolean);
      }
      return { type: 'grid-create', rows, cols, labels };
    }
  }

  // Row/column layout: "add 5 stickies in a row", "create 3 shapes in a column"
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

  // Numbered flowchart: "create a flowchart with 5 steps", "make a 5-step flowchart"
  const flowchartNumMatch = lower.match(/(?:create|make|build|generate)\s+(?:a\s+)?(?:(\d+)[- ]?step\s+)?flowchart(?:\s+with\s+(\d+)\s+(?:step|stage|node)s?)?/);
  if (flowchartNumMatch) {
    const stepCount = parseInt(flowchartNumMatch[1] || flowchartNumMatch[2] || '5', 10);
    if (stepCount >= 2 && stepCount <= 20) {
      return { type: 'numbered-flowchart', stepCount };
    }
  }

  // Bulk creation: "create 10 stickies", "add 50 random objects", "generate 20 cards"
  const bulkMatch = prompt.match(
    /(?:create|add|make|generate|put|place)\s+(\d+)\s+(sticky|stickies|note|notes|card|cards|shape|shapes|text|texts|sticker|stickers|frame|frames|random|object|objects|thing|things|item|items)/i,
  );
  const bulkMatchReversed = !bulkMatch
    ? prompt.match(/(\d+)\s+(?:random\s+)?(?:sticky|stickies|note|notes|card|cards|shape|shapes|text|texts|sticker|stickers|frame|frames|object|objects|thing|things|item|items)/i)
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
    else if (/sticker|stickers/.test(rawType)) objectType = 'sticker';
    else if (/frame|frames/.test(rawType)) objectType = 'frame';
    else objectType = 'random';

    return { type: 'bulk-create', count: rawCount, objectType };
  }

  // Structural templates + aliases
  if (/\bswot\b/i.test(prompt)) return { type: 'template', templateType: 'swot' };
  if (/\bkanban\b|\bsprint\s*board\b/i.test(prompt)) return { type: 'template', templateType: 'kanban' };
  if (/\bretro(?:spective)?\b/i.test(prompt)) return { type: 'template', templateType: 'retrospective' };
  if (/\beisenhower\b|\bpriority\s*matrix\b|\burgent\s*important\b/i.test(prompt)) return { type: 'template', templateType: 'eisenhower' };
  if (/\bmind\s*map\b|\bbrainstorm(?:ing)?\s+(?:board|session|template)\b/i.test(prompt)) return { type: 'template', templateType: 'mind-map' };
  if (/\bpros?\s*(?:and|&|\/)\s*cons?\b/i.test(prompt)) return { type: 'template', templateType: 'pros-cons' };
  if (/\btimeline\b/i.test(prompt)) return { type: 'template', templateType: 'timeline' };
  if (/\b(?:user\s*)?journey\s*map\b/i.test(prompt)) return { type: 'template', templateType: 'journey' };

  // "2x2 matrix" alias → grid
  const matrixMatch = lower.match(/(\d+)\s*[x×]\s*(\d+)\s*matrix/);
  if (matrixMatch) {
    const rows = parseInt(matrixMatch[1], 10);
    const cols = parseInt(matrixMatch[2], 10);
    if (rows >= 1 && rows <= 50 && cols >= 1 && cols <= 50) {
      return { type: 'grid-create', rows, cols };
    }
  }

  // Single object creation: "add a sticky note", "create a rectangle", "add a star", etc.
  const singleMatch = lower.match(
    /^(?:create|add|make|place|put)\s+(?:a\s+|an\s+)?(?:(yellow|blue|green|pink|purple|orange|red|cyan|teal)\s+)?(sticky\s*note|sticky|note|card|rectangle|rect|square|circle|ellipse|oval|triangle|diamond|pentagon|hexagon|octagon|star|arrow\s*shape|arrow|cross|plus|line|shape|frame|text\s*(?:box|element)?|text)\b/,
  );
  if (singleMatch) {
    const colorName = singleMatch[1];
    const typeStr = singleMatch[2];

    // Parse optional label
    const labelMatch = prompt.match(/(?:called|titled|named|saying|that\s+says|labeled)\s+['"]?(.+?)['"]?\s*$/i)
      || prompt.match(/'([^']+)'/)
      || prompt.match(/"([^"]+)"/);
    const label = labelMatch ? labelMatch[1].trim() : undefined;

    // Parse optional coordinates: "at 100, 200" or "at position 100, 200" or "at (100, 200)"
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

async function executeFlowchart(
  nodes: string[],
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const batch = db.batch();
  const spacing = 280;
  const totalWidth = (nodes.length - 1) * spacing + 200;
  const startX = viewport
    ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalWidth) / 2)
    : 100;
  const startY = viewport
    ? Math.round(viewport.y - 100)
    : 300;
  const nodeIds: string[] = [];

  // Create stickies in a row
  for (let i = 0; i < nodes.length; i++) {
    const docRef = objectsRef.doc();
    nodeIds.push(docRef.id);
    batch.set(docRef, {
      type: 'sticky',
      text: nodes[i],
      x: startX + i * spacing,
      y: startY,
      width: 200,
      height: 200,
      color: '#fef9c3',
      textColor: '#1e293b',
      rotation: 0,
      createdBy: userId,
      updatedAt: now,
      parentId: '',
      aiLabel: nodes[i],
      aiGroupId: 'flowchart',
    });
    objectsCreated.push(docRef.id);
  }

  // Create connectors between adjacent nodes
  for (let i = 0; i < nodes.length - 1; i++) {
    const connRef = objectsRef.doc();
    batch.set(connRef, {
      type: 'connector',
      fromId: nodeIds[i],
      toId: nodeIds[i + 1],
      style: 'straight',
      lineType: 'solid',
      startArrow: false,
      endArrow: true,
      strokeWidth: 2,
      color: '#6366f1',
      x: 0, y: 0, width: 0, height: 0,
      rotation: 0,
      createdBy: userId,
      updatedAt: now,
      parentId: '',
    });
    objectsCreated.push(connRef.id);
  }

  await batch.commit();
  return `Done! Created flowchart with ${nodes.length} steps.`;
}

async function executeTemplate(
  templateType: string,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const batch = db.batch();
  const titleBarH = 36; // Math.max(36, defaultFontSize(14) + 20)
  // Viewport-aware positioning: center the template in the user's visible area
  const startX = viewport ? Math.round(viewport.x - viewport.width / 2 + 40) : 0;
  const startY = viewport ? Math.round(viewport.y - viewport.height / 2 + 40 + titleBarH) : titleBarH;

  switch (templateType) {
    case 'swot': {
      const frameWidth = 400;
      const frameHeight = 300;
      const gap = 30;
      const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
      const colors = ['#dcfce7', '#fce7f3', '#dbeafe', '#ffedd5'];
      const prompts = ['What are we good at?', 'Where can we improve?', 'What trends can we leverage?', 'What risks do we face?'];

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = startX + col * (frameWidth + gap);
        const fy = startY + row * (frameHeight + titleBarH + gap);
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: titles[i], x: fx, y: fy,
          width: frameWidth, height: frameHeight, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: prompts[i], x: fx + 20, y: fy + 20,
          width: 180, height: 180, color: colors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }

    case 'kanban': {
      const frameWidth = 350;
      const frameHeight = 600;
      const gap = 30;
      const titles = ['To Do', 'In Progress', 'Done'];
      const kanbanColors = ['#fef9c3', '#dbeafe', '#dcfce7'];
      const kanbanPrompts = ['Add tasks here', 'Work in progress', 'Completed tasks'];

      for (let i = 0; i < 3; i++) {
        const fx = startX + i * (frameWidth + gap);
        const fy = startY;
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: titles[i], x: fx, y: fy,
          width: frameWidth, height: frameHeight, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: kanbanPrompts[i], x: fx + 20, y: fy + 20,
          width: 180, height: 180, color: kanbanColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }

    case 'retrospective': {
      const retroFrameWidth = 400;
      const retroFrameHeight = 500;
      const retroGap = 30;
      const retroTitles = ['What Went Well \u{1F60A}', 'What Didn\'t Go Well \u{1F61E}', 'Action Items \u{1F3AF}'];
      const retroColors = ['#dcfce7', '#fce7f3', '#dbeafe'];
      const retroPrompts = ['Add your wins here', 'What could be better?', 'Next steps to take'];

      for (let i = 0; i < 3; i++) {
        const fx = startX + i * (retroFrameWidth + retroGap);
        const fy = startY;
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: retroTitles[i], x: fx, y: fy,
          width: retroFrameWidth, height: retroFrameHeight, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: retroPrompts[i], x: fx + 20, y: fy + 20,
          width: 180, height: 180, color: retroColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }

    case 'eisenhower': {
      const eiFrameWidth = 400;
      const eiFrameHeight = 300;
      const eiGap = 30;
      const eiTitles = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Neither'];
      const eiColors = ['#fce7f3', '#dbeafe', '#ffedd5', '#f3e8ff'];
      const eiPrompts = ['Do it now', 'Schedule it', 'Delegate it', 'Drop it'];

      for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const fx = startX + col * (eiFrameWidth + eiGap);
        const fy = startY + row * (eiFrameHeight + titleBarH + eiGap);
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: eiTitles[i], x: fx, y: fy,
          width: eiFrameWidth, height: eiFrameHeight, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: eiPrompts[i], x: fx + 20, y: fy + 20,
          width: 180, height: 180, color: eiColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }

    case 'mind-map': {
      const centerRef = objectsRef.doc();
      batch.set(centerRef, {
        type: 'sticky', text: 'Central Idea',
        x: startX + 400, y: startY + 300, width: 200, height: 200,
        color: '#fef9c3', rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      });
      objectsCreated.push(centerRef.id);

      const positions = [
        { x: startX, y: startY + 300 },
        { x: startX + 800, y: startY + 300 },
        { x: startX + 400, y: startY },
        { x: startX + 400, y: startY + 600 },
      ];

      for (let i = 0; i < 4; i++) {
        const branchRef = objectsRef.doc();
        batch.set(branchRef, {
          type: 'sticky', text: `Branch ${i + 1}`,
          x: positions[i].x, y: positions[i].y, width: 200, height: 200,
          color: '#dbeafe', rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
        });
        objectsCreated.push(branchRef.id);

        const connRef = objectsRef.doc();
        batch.set(connRef, {
          type: 'connector', fromId: centerRef.id, toId: branchRef.id,
          style: 'curved', x: 0, y: 0, width: 0, height: 0,
          rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
        });
        objectsCreated.push(connRef.id);
      }
      break;
    }

    case 'timeline': {
      const stageCount = 5;
      const stageWidth = 200;
      const stageGap = 80;
      const stageLabels = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Phase 5'];
      const stageColors = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#f3e8ff'];
      const nodeIds: string[] = [];

      for (let i = 0; i < stageCount; i++) {
        const sx = startX + i * (stageWidth + stageGap);
        const sy = startY + 100;
        const stageRef = objectsRef.doc();
        nodeIds.push(stageRef.id);
        batch.set(stageRef, {
          type: 'sticky', text: stageLabels[i], x: sx, y: sy,
          width: stageWidth, height: stageWidth, color: stageColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          aiLabel: stageLabels[i], aiGroupId: 'timeline',
        });
        objectsCreated.push(stageRef.id);
      }

      // Connect stages with arrows
      for (let i = 0; i < stageCount - 1; i++) {
        const connRef = objectsRef.doc();
        batch.set(connRef, {
          type: 'connector', fromId: nodeIds[i], toId: nodeIds[i + 1],
          style: 'straight', lineType: 'solid', startArrow: false, endArrow: true,
          strokeWidth: 2, color: '#6366f1',
          x: 0, y: 0, width: 0, height: 0,
          rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
        });
        objectsCreated.push(connRef.id);
      }
      break;
    }

    case 'journey': {
      const stages = ['Awareness', 'Consideration', 'Decision', 'Onboarding', 'Retention'];
      const journeyColors = ['#dbeafe', '#dcfce7', '#fef9c3', '#ffedd5', '#f3e8ff'];
      const journeyPrompts = ['How do users discover us?', 'What do users evaluate?', 'What triggers the decision?', 'First experience?', 'What keeps users coming back?'];
      const colWidth = 250;
      const gap = 20;

      for (let i = 0; i < stages.length; i++) {
        const fx = startX + i * (colWidth + gap);
        const fy = startY;
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: stages[i], x: fx, y: fy,
          width: colWidth, height: 400, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: journeyPrompts[i], x: fx + 20, y: fy + 20,
          width: 200, height: 180, color: journeyColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }

    case 'pros-cons': {
      const pcFrameWidth = 400;
      const pcFrameHeight = 500;
      const pcGap = 30;
      const pcTitles = ['Pros', 'Cons'];
      const pcColors = ['#dcfce7', '#fce7f3'];
      const pcPrompts = ['Add advantages here', 'Add disadvantages here'];

      for (let i = 0; i < 2; i++) {
        const fx = startX + i * (pcFrameWidth + pcGap);
        const fy = startY;
        const frameRef = objectsRef.doc();
        batch.set(frameRef, {
          type: 'frame', title: pcTitles[i], x: fx, y: fy,
          width: pcFrameWidth, height: pcFrameHeight, rotation: 0,
          createdBy: userId, updatedAt: now, parentId: '', sentToBack: true,
        });
        objectsCreated.push(frameRef.id);

        const stickyRef = objectsRef.doc();
        batch.set(stickyRef, {
          type: 'sticky', text: pcPrompts[i], x: fx + 20, y: fy + 20,
          width: 180, height: 180, color: pcColors[i], textColor: '#1e293b',
          rotation: 0, createdBy: userId, updatedAt: now, parentId: frameRef.id,
        });
        objectsCreated.push(stickyRef.id);
      }
      break;
    }
  }

  await batch.commit();

  const templateNames: Record<string, string> = {
    'swot': 'SWOT analysis', 'kanban': 'Kanban board', 'retrospective': 'retrospective',
    'eisenhower': 'Eisenhower matrix', 'mind-map': 'mind map',
    'timeline': 'timeline', 'journey': 'user journey map', 'pros-cons': 'pros and cons',
  };
  return `Done! Created ${templateNames[templateType] || templateType}.`;
}

async function executeBulkCreate(
  count: number,
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'random',
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();

  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const randomTypes: Array<'sticky' | 'shape' | 'text' | 'sticker'> = ['sticky', 'shape', 'text', 'sticker'];
  const emojis = ['😊', '🎯', '💡', '🔥', '⭐', '🚀', '✨', '🎨', '📌', '🏆'];
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

  // Split into batches of 450 to stay under Firestore's 500-op limit
  const batchSize = 450;
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    const batch = db.batch();

    for (let i = batchStart; i < batchEnd; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = baseX + col * cellW;
      const y = baseY + row * cellH;
      const color = colors[i % colors.length];
      const resolvedType = objectType === 'random' ? randomTypes[i % randomTypes.length] : objectType;

      const docRef = objectsRef.doc();
      let data: Record<string, unknown>;

      switch (resolvedType) {
        case 'sticky':
          data = {
            type: 'sticky', text: '', x, y,
            width: 200, height: 200, color, textColor: '#1e293b',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'shape':
          data = {
            type: 'shape', shapeType: shapeTypes[i % shapeTypes.length], x, y,
            width: 120, height: 120, color: '#dbeafe',
            strokeColor: '#4f46e5', rotation: 0,
            createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'text':
          data = {
            type: 'text', text: `Text ${i + 1}`, x, y,
            width: 200, height: 40, fontSize: 24,
            fontFamily: "'Inter', sans-serif", fontWeight: 'normal',
            fontStyle: 'normal', textAlign: 'left',
            color: '#1e293b', bgColor: 'transparent',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'sticker':
          data = {
            type: 'sticker', emoji: emojis[i % emojis.length], x, y,
            width: 150, height: 150,
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'frame':
          data = {
            type: 'frame', title: `Frame ${i + 1}`, x, y,
            width: 400, height: 300,
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
            sentToBack: true,
          };
          break;
        default:
          data = {
            type: 'sticky', text: '', x, y,
            width: 200, height: 200, color, textColor: '#1e293b',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
      }

      batch.set(docRef, data);
      objectsCreated.push(docRef.id);
    }

    await batch.commit();
  }

  const typeLabel = objectType === 'random' ? 'objects' : `${objectType}${count !== 1 ? 's' : ''}`;
  return `Done! Created ${count} ${typeLabel}.`;
}

async function executeSingleCreate(
  objectType: 'sticky' | 'shape' | 'text' | 'frame',
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
  label?: string,
  color?: string,
  shapeType?: string,
  posX?: number,
  posY?: number,
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const x = posX ?? (viewport ? Math.round(viewport.x - 100) : 200);
  const y = posY ?? (viewport ? Math.round(viewport.y - 100) : 200);
  const docRef = objectsRef.doc();

  let data: Record<string, unknown>;
  switch (objectType) {
    case 'sticky':
      data = {
        type: 'sticky', text: label ?? '', x, y,
        width: 200, height: 200, color: color ?? '#fef9c3', textColor: '#1e293b',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      };
      break;
    case 'shape':
      data = {
        type: 'shape', shapeType: shapeType ?? 'rect', x, y,
        width: 120, height: 120, color: color ?? '#dbeafe',
        strokeColor: '#4f46e5', rotation: 0,
        createdBy: userId, updatedAt: now, parentId: '',
      };
      break;
    case 'text':
      data = {
        type: 'text', text: label ?? 'Text', x, y,
        width: 300, height: 50, fontSize: 24,
        fontFamily: "'Inter', sans-serif", fontWeight: 'normal',
        fontStyle: 'normal', textAlign: 'left',
        color: '#1e293b', bgColor: 'transparent',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      };
      break;
    case 'frame':
      data = {
        type: 'frame', title: label ?? 'Frame', x, y,
        width: 400, height: 300,
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
        sentToBack: true,
      };
      break;
    default:
      data = {
        type: 'sticky', text: label ?? '', x, y,
        width: 200, height: 200, color: '#fef9c3', textColor: '#1e293b',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      };
  }

  await docRef.set(data);
  objectsCreated.push(docRef.id);

  const typeLabel = objectType === 'frame' ? `frame "${label || 'Frame'}"` : objectType;
  return `Done! Created ${typeLabel}${label && objectType !== 'frame' ? ` with text "${label}"` : ''}.`;
}

async function executeGridCreate(
  rows: number,
  cols: number,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
  labels?: string[],
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const cellW = 220;
  const cellH = 220;
  const totalW = cols * cellW;
  const totalH = rows * cellH;
  const baseX = viewport ? Math.round(viewport.x - viewport.width / 2 + (viewport.width - totalW) / 2) : 100;
  const baseY = viewport ? Math.round(viewport.y - viewport.height / 2 + (viewport.height - totalH) / 2) : 100;

  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const total = rows * cols;
  const batchSize = 450;

  for (let batchStart = 0; batchStart < total; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, total);
    const batch = db.batch();

    for (let i = batchStart; i < batchEnd; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = baseX + col * cellW;
      const y = baseY + row * cellH;

      // If labels provided, use column labels as header text
      const text = labels && labels[col] ? labels[col] : '';

      const docRef = objectsRef.doc();
      batch.set(docRef, {
        type: 'sticky', text, x, y,
        width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b',
        rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
      });
      objectsCreated.push(docRef.id);
    }

    await batch.commit();
  }

  return `Done! Created ${rows}x${cols} grid (${total} sticky notes).`;
}

async function executeClearBoard(
  boardId: string,
  objectsCreated: string[],
): Promise<string> {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  if (snapshot.empty) return 'Board is already empty.';

  const batchSize = 450;
  const docs = snapshot.docs;
  let deleted = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }

  return `Done! Cleared ${deleted} objects from the board.`;
}

async function executeNumberedFlowchart(
  stepCount: number,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
  topic?: string,
): Promise<string> {
  const nodes = Array.from({ length: stepCount }, (_, i) => `Step ${i + 1}`);
  return executeFlowchart(nodes, boardId, userId, objectsCreated, viewport);
}

async function executeArrangeGrid(
  boardId: string,
  objectsCreated: string[],
): Promise<string> {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  if (snapshot.empty) return 'Board is empty — nothing to arrange.';

  const docs = snapshot.docs
    .map(doc => ({ id: doc.id, ref: doc.ref, data: doc.data() }))
    .filter(d => d.data.type !== 'connector')
    .sort((a, b) => (a.data.updatedAt || 0) - (b.data.updatedAt || 0));

  if (docs.length === 0) return 'No objects to arrange.';

  const cols = Math.ceil(Math.sqrt(docs.length));
  const padding = 30;
  const cellW = 240;
  const cellH = 240;
  const startX = 100;
  const startY = 100;

  const batchSize = 450;
  let updated = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    for (let j = 0; j < chunk.length; j++) {
      const idx = i + j;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      batch.update(chunk[j].ref, {
        x: startX + col * (cellW + padding),
        y: startY + row * (cellH + padding),
        updatedAt: Date.now(),
      });
      updated++;
    }
    await batch.commit();
  }

  return `Done! Arranged ${updated} objects in a ${cols}-column grid.`;
}

async function executeSelectiveDelete(
  targetType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame' | 'connector',
  boardId: string,
  objectsCreated: string[],
): Promise<string> {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  const targets = snapshot.docs.filter(doc => doc.data().type === targetType);

  if (targets.length === 0) return `No ${targetType} objects found on the board.`;

  const batchSize = 450;
  let deleted = 0;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + batchSize);
    for (const doc of chunk) {
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }

  return `Done! Deleted ${deleted} ${targetType}${deleted !== 1 ? 's' : ''}.`;
}

async function executeBulkColor(
  targetType: 'sticky' | 'shape' | 'text' | 'frame' | 'all',
  color: string,
  boardId: string,
): Promise<string> {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  const targets = targetType === 'all'
    ? snapshot.docs.filter(doc => {
        const t = doc.data().type;
        return t === 'sticky' || t === 'shape' || t === 'text' || t === 'frame';
      })
    : snapshot.docs.filter(doc => doc.data().type === targetType);

  if (targets.length === 0) return `No ${targetType === 'all' ? '' : targetType + ' '}objects found to recolor.`;

  const batchSize = 450;
  let updated = 0;

  for (let i = 0; i < targets.length; i += batchSize) {
    const batch = db.batch();
    const chunk = targets.slice(i, i + batchSize);
    for (const doc of chunk) {
      const data = doc.data();
      const updateData: { [x: string]: any } = { updatedAt: Date.now() };
      if (data.type === 'sticky') {
        updateData.color = color;
      } else if (data.type === 'shape') {
        updateData.color = color;
      } else if (data.type === 'text') {
        updateData.color = color;
      } else if (data.type === 'frame') {
        // Frames don't have a color field the same way, skip
      }
      batch.update(doc.ref, updateData);
      updated++;
    }
    await batch.commit();
  }

  return `Done! Changed color of ${updated} ${targetType === 'all' ? 'object' : targetType}${updated !== 1 ? 's' : ''} to the new color.`;
}

async function executeRowCreate(
  count: number,
  direction: 'row' | 'column',
  objectType: 'sticky' | 'shape' | 'text' | 'sticker' | 'frame',
  boardId: string,
  userId: string,
  objectsCreated: string[],
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const colors = ['#fef9c3', '#dbeafe', '#dcfce7', '#fce7f3', '#f3e8ff', '#ffedd5'];
  const emojis = ['😊', '🎯', '💡', '🔥', '⭐', '🚀', '✨', '🎨', '📌', '🏆'];
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

  const batchSize = 450;
  for (let batchStart = 0; batchStart < count; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, count);
    const batch = db.batch();

    for (let i = batchStart; i < batchEnd; i++) {
      const x = direction === 'row' ? baseX + i * (objSize.w + padding) : baseX;
      const y = direction === 'column' ? baseY + i * (objSize.h + padding) : baseY;
      const docRef = objectsRef.doc();

      let data: Record<string, unknown>;
      switch (objectType) {
        case 'sticky':
          data = {
            type: 'sticky', text: '', x, y,
            width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'shape':
          data = {
            type: 'shape', shapeType: 'rect', x, y,
            width: 120, height: 120, color: '#dbeafe',
            strokeColor: '#4f46e5', rotation: 0,
            createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'text':
          data = {
            type: 'text', text: `Text ${i + 1}`, x, y,
            width: 200, height: 40, fontSize: 24,
            fontFamily: "'Inter', sans-serif", fontWeight: 'normal',
            fontStyle: 'normal', textAlign: 'left',
            color: '#1e293b', bgColor: 'transparent',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'sticker':
          data = {
            type: 'sticker', emoji: emojis[i % emojis.length], x, y,
            width: 150, height: 150,
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
          break;
        case 'frame':
          data = {
            type: 'frame', title: `Frame ${i + 1}`, x, y,
            width: 400, height: 300,
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
            sentToBack: true,
          };
          break;
        default:
          data = {
            type: 'sticky', text: '', x, y,
            width: 200, height: 200, color: colors[i % colors.length], textColor: '#1e293b',
            rotation: 0, createdBy: userId, updatedAt: now, parentId: '',
          };
      }

      batch.set(docRef, data);
      objectsCreated.push(docRef.id);
    }

    await batch.commit();
  }

  const typeLabel = `${objectType}${count !== 1 ? 's' : ''}`;
  return `Done! Created ${count} ${typeLabel} in a ${direction}.`;
}

function buildObjectData(
  op: string,
  params: ToolInput,
  userId: string,
  now: number,
  resolvedGroupId?: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    createdBy: userId,
    updatedAt: now,
    parentId: params.parentId ?? '',
    rotation: 0,
  };
  if (params.aiLabel) base.aiLabel = params.aiLabel;
  if (resolvedGroupId) base.aiGroupId = resolvedGroupId;

  switch (op) {
    case 'createStickyNote': {
      const data: Record<string, unknown> = {
        ...base,
        type: 'sticky',
        text: params.text ?? '',
        x: params.x ?? 0,
        y: params.y ?? 0,
        width: params.width ?? 200,
        height: params.height ?? 200,
        color: params.color ?? '#fef9c3',
        textColor: params.textColor ?? '#1e293b',
      };
      if (params.borderColor) data.borderColor = params.borderColor;
      if (params.fontSize) data.fontSize = params.fontSize;
      if (params.fontFamily) data.fontFamily = resolveFontFamily(params.fontFamily);
      if (params.fontWeight && params.fontWeight !== 'normal') data.fontWeight = params.fontWeight;
      if (params.fontStyle && params.fontStyle !== 'normal') data.fontStyle = params.fontStyle;
      if (params.textAlign && params.textAlign !== 'left') data.textAlign = params.textAlign;
      return data;
    }

    case 'createShape': {
      const isLine = params.shapeType === 'line';
      let shapeX = params.x ?? 0;
      let shapeY = params.y ?? 0;
      let shapeWidth = params.width ?? (isLine ? 200 : 120);
      let shapeHeight = isLine ? 4 : (params.height ?? 120);
      let shapeRotation = params.rotation ?? 0;

      if (isLine && params.fromX != null && params.fromY != null && params.toX != null && params.toY != null) {
        const dx = params.toX - params.fromX;
        const dy = params.toY - params.fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const centerX = (params.fromX + params.toX) / 2;
        const centerY = (params.fromY + params.toY) / 2;
        shapeWidth = length;
        shapeHeight = 4;
        shapeRotation = angleDeg;
        shapeX = centerX - length / 2;
        shapeY = centerY - 2;
      }

      const data: Record<string, unknown> = {
        ...base,
        type: 'shape',
        shapeType: params.shapeType ?? 'rect',
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        color: params.color ?? '#dbeafe',
        strokeColor: params.strokeColor ?? '#4f46e5',
        rotation: shapeRotation,
      };
      if (params.borderColor) data.borderColor = params.borderColor;
      return data;
    }

    case 'createFrame': {
      const data: Record<string, unknown> = {
        ...base,
        type: 'frame',
        title: params.title ?? 'Frame',
        x: params.x ?? 0,
        y: params.y ?? 0,
        width: params.width ?? 400,
        height: params.height ?? 300,
        borderless: params.borderless ?? false,
        sentToBack: true,
      };
      if (params.color) data.color = params.color;
      if (params.borderColor) data.borderColor = params.borderColor;
      if (params.textColor) data.textColor = params.textColor;
      if (params.fontSize) data.fontSize = params.fontSize;
      if (params.fontFamily) data.fontFamily = resolveFontFamily(params.fontFamily);
      if (params.fontWeight && params.fontWeight !== 'normal') data.fontWeight = params.fontWeight;
      if (params.fontStyle && params.fontStyle !== 'normal') data.fontStyle = params.fontStyle;
      return data;
    }

    case 'createSticker': {
      const size = params.size ?? 150;
      return {
        ...base,
        type: 'sticker',
        emoji: params.emoji ?? '😊',
        x: params.x ?? 0,
        y: params.y ?? 0,
        width: size,
        height: size,
      };
    }

    case 'createGifSticker': {
      const size = params.size ?? 150;
      return {
        ...base,
        type: 'sticker',
        emoji: '',
        gifSearchTerm: params.searchTerm ?? '',
        x: params.x ?? 0,
        y: params.y ?? 0,
        width: size,
        height: size,
      };
    }

    case 'createText': {
      const data: Record<string, unknown> = {
        ...base,
        type: 'text',
        text: params.text ?? '',
        x: params.x ?? 0,
        y: params.y ?? 0,
        width: params.width ?? 300,
        height: params.height ?? 50,
        fontSize: params.fontSize ?? 24,
        fontFamily: resolveFontFamily(params.fontFamily),
        fontWeight: params.fontWeight ?? 'normal',
        fontStyle: params.fontStyle ?? 'normal',
        textAlign: params.textAlign ?? 'left',
        color: params.color ?? '#1e293b',
        bgColor: params.bgColor ?? 'transparent',
      };
      if (params.borderColor) data.borderColor = params.borderColor;
      return data;
    }

    case 'createConnector': {
      return {
        ...base,
        type: 'connector',
        fromId: params.fromId,
        toId: params.toId,
        style: params.style ?? 'straight',
        lineType: params.lineType ?? 'solid',
        startArrow: params.startArrow ?? false,
        endArrow: params.endArrow ?? false,
        strokeWidth: params.strokeWidth ?? 2,
        color: params.color ?? '#6366f1',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        parentId: '',
      };
    }

    default:
      return { ...base, type: 'unknown' };
  }
}


/**
 * Execute a plan of creation operations in a single atomic batch write.
 * Supports tempIds for cross-referencing between operations (e.g. connector → sticky).
 */
async function executeExecutePlan(
  operations: Array<{ op: string; tempId?: string; params?: ToolInput }>,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  groupLabels: Record<number, string>,
  planAiGroupId?: string,
  planAiGroupLabel?: string,
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  console.log(`executePlan: ${operations.length} operations for board ${boardId}`);
  if (operations.length > 0) {
    console.log(`executePlan ops: ${operations.slice(0, 5).map(o => o.op).join(', ')}${operations.length > 5 ? ` ...+${operations.length - 5} more` : ''}`);
  }
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();
  const batch = db.batch();

  // Step 1: Allocate real Firestore IDs and build tempId map
  const tempIdMap = new Map<string, string>();
  const docRefs: FirebaseFirestore.DocumentReference[] = [];

  for (const item of operations) {
    const docRef = objectsRef.doc();
    docRefs.push(docRef);
    if (item.tempId) {
      tempIdMap.set(item.tempId, docRef.id);
    }
  }

  // Step 2: Resolve GIF URLs in parallel before building the batch
  const gifResults = new Map<number, string | null>();
  await Promise.all(
    operations.map(async (item, i) => {
      if (item.op === 'createGifSticker') {
        const term = (item.params ?? {}).searchTerm ?? '';
        gifResults.set(i, await searchGiphy(term));
      }
    }),
  );

  // Step 3: Build objects (deferred batch.set — auto-parent needs all objects first)
  const created: string[] = [];
  const failedGifs: string[] = [];
  const builtObjects: Array<{ docRef: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];
  for (let i = 0; i < operations.length; i++) {
    const item = operations[i];
    const params: ToolInput = item.params ?? {};
    const docRef = docRefs[i];

    // Skip GIF stickers that failed to resolve
    if (item.op === 'createGifSticker' && !gifResults.get(i)) {
      failedGifs.push(params.searchTerm ?? 'unknown');
      continue;
    }

    // Auto-position objects that lack explicit coordinates within the viewport
    if (viewport && item.op !== 'createConnector' && params.x == null && params.y == null) {
      const vx = viewport.x - viewport.width / 2;
      const vy = viewport.y - viewport.height / 2;
      params.x = Math.round(vx + 60 + (i % 5) * 170);
      params.y = Math.round(vy + 60 + Math.floor(i / 5) * 170);
      console.log(`Auto-positioned ${item.op} [${i}] to (${params.x}, ${params.y}) within viewport (${vx},${vy},${viewport.width}x${viewport.height})`);
    } else if (item.op !== 'createConnector') {
      console.log(`${item.op} [${i}] explicit pos (${params.x}, ${params.y}), viewport=${!!viewport}`);
    }

    // Resolve tempId references in params
    if (params.fromId && tempIdMap.has(params.fromId)) params.fromId = tempIdMap.get(params.fromId)!;
    if (params.toId && tempIdMap.has(params.toId)) params.toId = tempIdMap.get(params.toId)!;
    if (params.parentId && tempIdMap.has(params.parentId)) params.parentId = tempIdMap.get(params.parentId)!;

    // Resolve group labels
    if (params.aiGroupLabel && params.aiGroupId != null) {
      groupLabels[params.aiGroupId] = params.aiGroupLabel;
    }
    // Use plan-level group if operation doesn't specify its own
    const resolvedGroupId = params.aiGroupId != null
      ? (groupLabels[params.aiGroupId] ?? `group-${params.aiGroupId}`)
      : planAiGroupId;

    // Apply plan-level aiGroupLabel to first op's params if not already set
    if (planAiGroupLabel && !params.aiGroupLabel && params.aiGroupId == null && planAiGroupId) {
      // already resolved via planAiGroupId
    }

    const data = buildObjectData(item.op, params, userId, now, resolvedGroupId);
    // Inject resolved GIF URL for gif stickers
    if (item.op === 'createGifSticker' && gifResults.get(i)) {
      data.gifUrl = gifResults.get(i)!;
    }
    builtObjects.push({ docRef, data });
    objectsCreated.push(docRef.id);
    created.push(docRef.id);
  }

  // Step 4: Auto-parent — objects inside a frame get parentId if not already set
  const newFrames = builtObjects.filter(o => o.data.type === 'frame');
  if (newFrames.length > 0) {
    for (const obj of builtObjects) {
      if (obj.data.type === 'frame' || obj.data.type === 'connector') continue;
      if (obj.data.parentId) continue; // already has a parent
      const ox = obj.data.x as number;
      const oy = obj.data.y as number;
      const ow = (obj.data.width as number) || 0;
      const oh = (obj.data.height as number) || 0;
      for (const frame of newFrames) {
        const fx = frame.data.x as number;
        const fy = frame.data.y as number;
        const fw = frame.data.width as number;
        const fh = frame.data.height as number;
        if (ox >= fx && oy >= fy && ox + ow <= fx + fw && oy + oh <= fy + fh) {
          obj.data.parentId = frame.docRef.id;
          break;
        }
      }
    }
  }

  // Step 5: Add all to batch and commit atomically
  for (const { docRef, data } of builtObjects) {
    batch.set(docRef, data);
  }
  await batch.commit();

  const result: Record<string, unknown> = { success: true, created, count: created.length };
  if (failedGifs.length > 0) {
    result.gifSearchFailed = failedGifs;
    result.note = `No GIF results for: ${failedGifs.map(t => `"${t}"`).join(', ')}. Try different, simpler search terms with createGifSticker.`;
  }
  return JSON.stringify(result);
}

async function executeTool(
  toolName: string,
  input: ToolInput,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  groupLabels: Record<number, string>,
  selectedIds?: string[],
  viewport?: { x: number; y: number; width: number; height: number },
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();

  // Auto-position creation ops that lack explicit coordinates within the viewport
  const isCreateOp = toolName.startsWith('create') && toolName !== 'createConnector';
  if (viewport && isCreateOp && input.x == null && input.y == null) {
    input.x = Math.round(viewport.x);
    input.y = Math.round(viewport.y);
    console.log(`executeTool auto-positioned ${toolName} to (${input.x}, ${input.y})`);
  }

  // Resolve numeric aiGroupId → string label for Firestore storage
  if (input.aiGroupLabel && input.aiGroupId != null) {
    groupLabels[input.aiGroupId] = input.aiGroupLabel;
  }
  const resolvedGroupId = input.aiGroupId != null ? (groupLabels[input.aiGroupId] ?? `group-${input.aiGroupId}`) : undefined;

  switch (toolName) {
    case 'createStickyNote': {
      const docRef = objectsRef.doc();
      const data: Record<string, unknown> = {
        type: 'sticky',
        text: input.text ?? '',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 200,
        height: input.height ?? 200,
        color: input.color ?? '#fef9c3',
        textColor: input.textColor ?? '#1e293b',
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
      if (input.borderColor) data.borderColor = input.borderColor;
      if (input.fontSize) data.fontSize = input.fontSize;
      if (input.fontFamily) data.fontFamily = resolveFontFamily(input.fontFamily);
      if (input.fontWeight && input.fontWeight !== 'normal') data.fontWeight = input.fontWeight;
      if (input.fontStyle && input.fontStyle !== 'normal') data.fontStyle = input.fontStyle;
      if (input.textAlign && input.textAlign !== 'left') data.textAlign = input.textAlign;
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'sticky' });
    }

    case 'createShape': {
      const docRef = objectsRef.doc();
      const isLine = input.shapeType === 'line';

      let shapeX = input.x ?? 0;
      let shapeY = input.y ?? 0;
      let shapeWidth = input.width ?? (isLine ? 200 : 120);
      let shapeHeight = isLine ? 4 : (input.height ?? 120);
      let shapeRotation = input.rotation ?? 0;

      // For lines with endpoint coordinates, compute position/length/rotation
      if (isLine && input.fromX != null && input.fromY != null && input.toX != null && input.toY != null) {
        const dx = input.toX - input.fromX;
        const dy = input.toY - input.fromY;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
        const centerX = (input.fromX + input.toX) / 2;
        const centerY = (input.fromY + input.toY) / 2;
        shapeWidth = length;
        shapeHeight = 4;
        shapeRotation = angleDeg;
        shapeX = centerX - length / 2;
        shapeY = centerY - 2;
      }

      const data: Record<string, unknown> = {
        type: 'shape',
        shapeType: input.shapeType ?? 'rect',
        x: shapeX,
        y: shapeY,
        width: shapeWidth,
        height: shapeHeight,
        color: input.color ?? '#dbeafe',
        strokeColor: input.strokeColor ?? '#4f46e5',
        rotation: shapeRotation,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
      if (input.borderColor) data.borderColor = input.borderColor;
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'shape', shapeType: input.shapeType });
    }

    case 'createSticker': {
      const docRef = objectsRef.doc();
      const size = input.size ?? 150;
      const data: Record<string, unknown> = {
        type: 'sticker',
        emoji: input.emoji ?? '😊',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: size,
        height: size,
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'sticker', emoji: input.emoji });
    }

    case 'createGifSticker': {
      const searchTerm = input.searchTerm ?? '';
      const gifUrl = await searchGiphy(searchTerm);
      if (!gifUrl) {
        return JSON.stringify({ error: `No GIF results for "${searchTerm}". Try a different, simpler search term.` });
      }
      const docRef = objectsRef.doc();
      const size = input.size ?? 150;
      const data: Record<string, unknown> = {
        type: 'sticker',
        emoji: '',
        gifUrl,
        gifSearchTerm: searchTerm,
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: size,
        height: size,
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'sticker', gifUrl });
    }

    case 'createText': {
      const docRef = objectsRef.doc();
      const data: Record<string, unknown> = {
        type: 'text',
        text: input.text ?? '',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 300,
        height: input.height ?? 50,
        fontSize: input.fontSize ?? 24,
        fontFamily: resolveFontFamily(input.fontFamily),
        fontWeight: input.fontWeight ?? 'normal',
        fontStyle: input.fontStyle ?? 'normal',
        textAlign: input.textAlign ?? 'left',
        color: input.color ?? '#1e293b',
        bgColor: input.bgColor ?? 'transparent',
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
      if (input.borderColor) data.borderColor = input.borderColor;
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'text' });
    }

    case 'createFrame': {
      const docRef = objectsRef.doc();
      const data: Record<string, unknown> = {
        type: 'frame',
        title: input.title ?? 'Frame',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 400,
        height: input.height ?? 300,
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
        borderless: input.borderless ?? false,
        sentToBack: true,
      };
      if (input.color) data.color = input.color;
      if (input.borderColor) data.borderColor = input.borderColor;
      if (input.textColor) data.textColor = input.textColor;
      if (input.fontSize) data.fontSize = input.fontSize;
      if (input.fontFamily) data.fontFamily = resolveFontFamily(input.fontFamily);
      if (input.fontWeight && input.fontWeight !== 'normal') data.fontWeight = input.fontWeight;
      if (input.fontStyle && input.fontStyle !== 'normal') data.fontStyle = input.fontStyle;
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'frame' });
    }

    case 'createConnector': {
      const docRef = objectsRef.doc();
      const data: Record<string, unknown> = {
        type: 'connector',
        fromId: input.fromId,
        toId: input.toId,
        style: input.style ?? 'straight',
        lineType: input.lineType ?? 'solid',
        startArrow: input.startArrow ?? false,
        endArrow: input.endArrow ?? false,
        strokeWidth: input.strokeWidth ?? 2,
        color: input.color ?? '#6366f1',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
      };
      if (input.aiLabel) data.aiLabel = input.aiLabel;
      if (resolvedGroupId) data.aiGroupId = resolvedGroupId;
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'connector' });
    }

    case 'moveObject': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.update({
        x: input.x,
        y: input.y,
        updatedAt: now,
      });
      return JSON.stringify({ success: true });
    }

    case 'resizeObject': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.update({
        width: input.width,
        height: input.height,
        updatedAt: now,
      });
      return JSON.stringify({ success: true });
    }

    case 'updateText': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.update({
        text: input.newText,
        updatedAt: now,
      });
      return JSON.stringify({ success: true });
    }

    case 'changeColor': {
      const docRef = objectsRef.doc(input.objectId!);
      const colorUpdates: Record<string, unknown> = { updatedAt: now };
      if (input.newColor !== undefined) colorUpdates.color = input.newColor;
      if (input.textColor !== undefined) colorUpdates.textColor = input.textColor;
      if (input.strokeColor !== undefined) colorUpdates.strokeColor = input.strokeColor;
      if (input.bgColor !== undefined) colorUpdates.bgColor = input.bgColor;
      if (input.borderColor !== undefined) colorUpdates.borderColor = input.borderColor;
      await docRef.update(colorUpdates);
      return JSON.stringify({ success: true });
    }

    case 'deleteObject': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.delete();
      return JSON.stringify({ success: true });
    }

    case 'updateParent': {
      const docRef = objectsRef.doc(input.objectId!);
      const objSnap = await docRef.get();
      if (!objSnap.exists) return JSON.stringify({ error: 'Object not found' });
      const obj = objSnap.data() as any;
      const updates: Record<string, unknown> = { parentId: input.newParentId ?? '', updatedAt: now };

      // Auto-reposition into frame when attaching
      if (input.newParentId) {
        const frameSnap = await objectsRef.doc(input.newParentId).get();
        const frame = frameSnap.exists ? frameSnap.data() as any : null;
        if (frame && frame.type === 'frame') {
          // Title bar renders above frame.y, so content area starts at frame.y
          const margin = 20;
          const interiorX = frame.x + margin;
          const interiorY = frame.y + margin;
          const interiorRight = frame.x + frame.width - margin;
          const interiorBottom = frame.y + frame.height - margin;

          // Check if object is outside frame bounds
          const objRight = obj.x + (obj.width || 200);
          const objBottom = obj.y + (obj.height || 200);
          const isOutside = obj.x < frame.x || obj.y < frame.y || objRight > frame.x + frame.width || objBottom > frame.y + frame.height;

          if (isOutside) {
            // Find existing children to stack below them
            const allObjects = await readBoardState(boardId);
            const siblings = (allObjects as any[]).filter(
              (o: any) => o.parentId === input.newParentId && o.id !== input.objectId
            );
            let targetY = interiorY;
            for (const sib of siblings) {
              const sibBottom = sib.y + (sib.height || 200) + 10;
              if (sibBottom > targetY) targetY = sibBottom;
            }
            updates.x = interiorX;
            updates.y = targetY;

            // Scale down if object is wider/taller than frame interior
            const maxW = interiorRight - interiorX;
            const maxH = interiorBottom - targetY;
            if (obj.width > maxW) updates.width = maxW;
            if (obj.height > maxH && maxH > 50) updates.height = Math.max(maxH, 50);
          }
        }
      }

      await docRef.update(updates);
      return JSON.stringify({ success: true, objectId: input.objectId, newParentId: input.newParentId, repositioned: !!updates.x });
    }

    case 'embedInFrame': {
      const ids = input.objectIds ?? [];
      const frameId = input.frameId!;
      if (ids.length === 0) return JSON.stringify({ error: 'No object IDs provided' });

      const frameSnap = await objectsRef.doc(frameId).get();
      if (!frameSnap.exists) return JSON.stringify({ error: 'Frame not found' });
      const frame = frameSnap.data() as any;
      if (frame.type !== 'frame') return JSON.stringify({ error: 'Target is not a frame' });

      // Title bar renders above frame.y, so content area starts at frame.y
      const margin = 20;
      const interiorX = frame.x + margin;
      let nextY = frame.y + margin;
      const interiorRight = frame.x + frame.width - margin;
      const maxW = interiorRight - interiorX;

      // Find existing children to stack below them
      const allObjects = await readBoardState(boardId);
      const existingChildren = (allObjects as any[]).filter(
        (o: any) => o.parentId === frameId && !ids.includes(o.id)
      );
      for (const child of existingChildren) {
        const childBottom = child.y + (child.height || 200) + 10;
        if (childBottom > nextY) nextY = childBottom;
      }

      const embedResults: { id: string; repositioned: boolean }[] = [];
      const embedBatch = db.batch();
      // Pre-fetch all objects in parallel
      const embedDocs = await Promise.all(ids.map(id => objectsRef.doc(id).get()));
      for (let i = 0; i < ids.length; i++) {
        const docSnap = embedDocs[i];
        if (!docSnap.exists) {
          embedResults.push({ id: ids[i], repositioned: false });
          continue;
        }
        const obj = docSnap.data() as any;
        const updates: Record<string, unknown> = { parentId: frameId, updatedAt: now };

        updates.x = interiorX;
        updates.y = nextY;
        if (obj.width > maxW) updates.width = maxW;

        nextY += (obj.height || 200) + 10;

        embedBatch.update(objectsRef.doc(ids[i]), updates as FirebaseFirestore.UpdateData<any>);
        embedResults.push({ id: ids[i], repositioned: true });
      }
      await embedBatch.commit();

      return JSON.stringify({ success: true, frameId, embedded: embedResults.length, results: embedResults });
    }

    case 'alignObjects': {
      const ids = input.objectIds ?? [];
      if (ids.length === 0) return JSON.stringify({ error: 'No objects to align' });
      const spacing = input.spacing ?? 20;

      const docs = await Promise.all(ids.map(id => objectsRef.doc(id).get()));
      const objectData: LayoutObject[] = docs.map((doc, i) => {
        const d = doc.data() as any;
        return { id: ids[i], x: d.x ?? 0, y: d.y ?? 0, width: d.width || 200, height: d.height || 200 };
      });

      switch (input.alignment) {
        case 'left': {
          const target = Math.min(...objectData.map(o => o.x));
          objectData.forEach(o => { o.x = target; });
          nudgeOverlaps(objectData, 'y', spacing);
          break;
        }
        case 'right': {
          const target = Math.max(...objectData.map(o => o.x + o.width));
          objectData.forEach(o => { o.x = target - o.width; });
          nudgeOverlaps(objectData, 'y', spacing);
          break;
        }
        case 'top': {
          const target = Math.min(...objectData.map(o => o.y));
          objectData.forEach(o => { o.y = target; });
          nudgeOverlaps(objectData, 'x', spacing);
          break;
        }
        case 'bottom': {
          const target = Math.max(...objectData.map(o => o.y + o.height));
          objectData.forEach(o => { o.y = target - o.height; });
          nudgeOverlaps(objectData, 'x', spacing);
          break;
        }
        case 'center-x': {
          const avg = objectData.reduce((s, o) => s + o.x + o.width / 2, 0) / objectData.length;
          objectData.forEach(o => { o.x = avg - o.width / 2; });
          nudgeOverlaps(objectData, 'y', spacing);
          break;
        }
        case 'center-y': {
          const avg = objectData.reduce((s, o) => s + o.y + o.height / 2, 0) / objectData.length;
          objectData.forEach(o => { o.y = avg - o.height / 2; });
          nudgeOverlaps(objectData, 'x', spacing);
          break;
        }
        case 'distribute-horizontal': {
          objectData.sort((a, b) => a.x - b.x);
          const totalW = objectData.reduce((s, o) => s + o.width, 0);
          const minX = objectData[0].x;
          const maxRight = objectData[objectData.length - 1].x + objectData[objectData.length - 1].width;
          let gap = objectData.length > 1 ? (maxRight - minX - totalW) / (objectData.length - 1) : 0;
          if (gap < spacing) gap = spacing;
          let cursor = minX;
          objectData.forEach(o => { o.x = cursor; cursor += o.width + gap; });
          break;
        }
        case 'distribute-vertical': {
          objectData.sort((a, b) => a.y - b.y);
          const totalH = objectData.reduce((s, o) => s + o.height, 0);
          const minY = objectData[0].y;
          const maxBottom = objectData[objectData.length - 1].y + objectData[objectData.length - 1].height;
          let gap = objectData.length > 1 ? (maxBottom - minY - totalH) / (objectData.length - 1) : 0;
          if (gap < spacing) gap = spacing;
          let cursor = minY;
          objectData.forEach(o => { o.y = cursor; cursor += o.height + gap; });
          break;
        }
      }

      const alignBatch = db.batch();
      for (const o of objectData) {
        alignBatch.update(objectsRef.doc(o.id), { x: o.x, y: o.y, updatedAt: now });
      }
      await alignBatch.commit();
      return JSON.stringify({ success: true, aligned: ids.length, alignment: input.alignment });
    }

    case 'layoutObjects': {
      const ids = input.objectIds ?? [];
      if (ids.length === 0) return JSON.stringify({ error: 'No objects to arrange' });

      const docs = await Promise.all(ids.map(id => objectsRef.doc(id).get()));
      const objectData: LayoutObject[] = docs.map((doc, i) => {
        const d = doc.data() as any;
        return { id: ids[i], x: d.x ?? 0, y: d.y ?? 0, width: d.width || 200, height: d.height || 200 };
      });

      const spacing = input.spacing ?? 20;
      const origin = computeAutoOrigin(objectData);
      const sx = input.startX ?? origin.minX;
      const sy = input.startY ?? origin.minY;
      const crossAlign = (input.alignment as string) ?? 'center';

      let positions: LayoutPosition[];
      switch (input.mode) {
        case 'row':       positions = layoutRow(objectData, spacing, sx, sy, crossAlign); break;
        case 'column':    positions = layoutColumn(objectData, spacing, sx, sy, crossAlign); break;
        case 'grid':      positions = layoutGrid(objectData, input.columns ?? 3, spacing, sx, sy); break;
        case 'staggered': positions = layoutStaggered(objectData, input.columns ?? 3, spacing, sx, sy); break;
        case 'circular':  positions = layoutCircular(objectData, input.radius, spacing, origin.centerX, origin.centerY); break;
        case 'pack':      positions = layoutPack(objectData, spacing, sx, sy); break;
        case 'fan':       positions = layoutFan(objectData, input.radius, input.arcDegrees ?? 180, spacing, origin.centerX, origin.centerY); break;
        default:          return JSON.stringify({ error: `Unknown layout mode: ${input.mode}` });
      }

      const layoutBatch = db.batch();
      for (const p of positions) {
        layoutBatch.update(objectsRef.doc(p.id), { x: p.x, y: p.y, updatedAt: now });
      }
      await layoutBatch.commit();
      return JSON.stringify({ success: true, arranged: ids.length, mode: input.mode });
    }

    case 'duplicateObject': {
      const sourceDoc = await objectsRef.doc(input.objectId!).get();
      if (!sourceDoc.exists) return JSON.stringify({ error: 'Object not found' });

      const sourceData = sourceDoc.data() as any;
      const count = input.count ?? 1;
      const offsetX = input.offsetX ?? 20;
      const offsetY = input.offsetY ?? 20;

      const duplicates: string[] = [];
      const dupBatch = db.batch();
      for (let i = 1; i <= count; i++) {
        const docRef = objectsRef.doc();
        const duplicate = {
          ...sourceData,
          id: docRef.id,
          x: sourceData.x + (offsetX * i),
          y: sourceData.y + (offsetY * i),
          createdBy: userId,
          updatedAt: now,
        };
        dupBatch.set(docRef, duplicate);
        objectsCreated.push(docRef.id);
        duplicates.push(docRef.id);
      }
      await dupBatch.commit();

      return JSON.stringify({ success: true, duplicates });
    }

    case 'setZIndex': {
      const targetDoc = await objectsRef.doc(input.objectId!).get();
      if (!targetDoc.exists) return JSON.stringify({ error: 'Object not found' });

      const allObjects = await readBoardState(boardId);
      const targetData = targetDoc.data() as any;
      const currentZIndex = targetData.zIndex ?? 0;

      // Simple z-index manipulation (in real app, would need better strategy)
      let newZIndex: number;
      switch (input.operation) {
        case 'toFront':
          newZIndex = Math.max(...allObjects.map((o: any) => o.zIndex ?? 0)) + 1;
          break;
        case 'toBack':
          newZIndex = Math.min(...allObjects.map((o: any) => o.zIndex ?? 0)) - 1;
          break;
        case 'forward':
          newZIndex = currentZIndex + 1;
          break;
        case 'backward':
          newZIndex = currentZIndex - 1;
          break;
        default:
          newZIndex = currentZIndex;
      }

      await objectsRef.doc(input.objectId!).update({ zIndex: newZIndex, updatedAt: now });
      return JSON.stringify({ success: true, newZIndex });
    }

    case 'rotateObject': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.update({
        rotation: input.rotation ?? 0,
        updatedAt: now,
      });
      return JSON.stringify({ success: true, rotation: input.rotation });
    }

    case 'getObject': {
      const doc = await objectsRef.doc(input.objectId!).get();
      if (!doc.exists) return JSON.stringify({ error: 'Object not found' });
      return JSON.stringify({ id: doc.id, ...doc.data() });
    }

    case 'updateFrameTitle': {
      const docRef = objectsRef.doc(input.objectId!);
      const doc = await docRef.get();
      if (!doc.exists) return JSON.stringify({ error: 'Object not found' });
      const docData = doc.data() as any;
      if (docData.type !== 'frame') return JSON.stringify({ error: 'Object is not a frame' });
      await docRef.update({ title: input.title, updatedAt: now });
      return JSON.stringify({ success: true, objectId: input.objectId, title: input.title });
    }

    case 'searchObjects': {
      const allObjects = await readBoardState(boardId);
      let filtered = allObjects as any[];
      if (input.objectType) {
        filtered = filtered.filter((o: any) => o.type === input.objectType);
      }
      if (input.textContains) {
        const search = input.textContains.toLowerCase();
        filtered = filtered.filter((o: any) => {
          const text = (o.text ?? o.title ?? '').toLowerCase();
          return text.includes(search);
        });
      }
      if (input.parentId !== undefined) {
        filtered = filtered.filter((o: any) => o.parentId === input.parentId);
      }
      const selectedSet = selectedIds?.length ? new Set(selectedIds) : undefined;
      const summaries = filtered.map((o: any) => {
        const c = compactBoardObject(o);
        if (selectedSet?.has(o.id)) c.sel = true;
        return c;
      });
      return JSON.stringify({ results: summaries, count: summaries.length });
    }

    case 'getBoardSummary': {
      const allObjects = await readBoardState(boardId);
      const byType: Record<string, number> = {};
      const frames: { id: string; title: string; childCount: number; x: number; y: number; w: number; h: number }[] = [];
      const childCounts: Record<string, number> = {};
      for (const obj of allObjects as any[]) {
        byType[obj.type] = (byType[obj.type] || 0) + 1;
        if (obj.parentId) childCounts[obj.parentId] = (childCounts[obj.parentId] || 0) + 1;
      }
      for (const obj of allObjects as any[]) {
        if (obj.type === 'frame') {
          frames.push({ id: obj.id, title: obj.title ?? 'Untitled', childCount: childCounts[obj.id] || 0, x: obj.x, y: obj.y, w: obj.width, h: obj.height });
        }
      }
      return JSON.stringify({ totalCount: allObjects.length, byType, frames });
    }

    case 'deleteObjects': {
      const ids = input.objectIds ?? [];
      if (ids.length === 0) return JSON.stringify({ error: 'No object IDs provided' });
      const batch = db.batch();
      for (const id of ids) {
        batch.delete(objectsRef.doc(id));
      }
      await batch.commit();
      return JSON.stringify({ deleted: ids.length, ids });
    }

    case 'getBoardState': {
      const objects = await readBoardState(boardId);
      const selectedSet = selectedIds?.length ? new Set(selectedIds) : undefined;
      return JSON.stringify({ objects: objects.map((o: any) => {
        const c = compactBoardObject(o);
        if (selectedSet?.has(o.id)) c.sel = true;
        return c;
      }) });
    }

    case 'getSelectedObjects': {
      if (!selectedIds || selectedIds.length === 0) {
        return JSON.stringify({ objects: [], count: 0, note: 'No objects are currently selected.' });
      }
      const allObjects = await readBoardState(boardId);
      const selectedSet = new Set(selectedIds);
      const selected = (allObjects as any[]).filter((o: any) => selectedSet.has(o.id));
      return JSON.stringify({ objects: selected.map(compactBoardObject), count: selected.length });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---- Shared secrets config for both trigger and callable ----
const functionSecrets = [anthropicApiKey, giphyApiKey];

// Read-only tools that return data but don't modify the board
const READ_ONLY_TOOLS = new Set([
  'getBoardState', 'getBoardSummary', 'searchObjects', 'getObject', 'getSelectedObjects',
]);

// ---- Core AI processing (shared between onDocumentCreated and onCall) ----

interface ProcessAIParams {
  boardId: string;
  requestId: string;
  prompt: string;
  userId: string;
  selectedIds?: string[];
  viewport?: { x: number; y: number; width: number; height: number };
}

async function processAICore(
  params: ProcessAIParams,
): Promise<{ response: string; objectsCreated: string[] }> {
  const { boardId, requestId, prompt, userId, selectedIds, viewport } = params;
  const requestRef = db.doc(`boards/${boardId}/aiRequests/${requestId}`);

  // Mark as processing
  await requestRef.update({ status: 'processing', progress: 'Planning...' });

  const objectsCreated: string[] = [];
  const groupLabels: Record<number, string> = {};

  // Template engine: bypass LLM for known patterns
  const templateMatch = detectTemplate(prompt);
  if (templateMatch) {
    try {
      let responseText: string;
      if (templateMatch.type === 'flowchart') {
        responseText = await executeFlowchart(templateMatch.nodes, boardId, userId, objectsCreated, viewport);
      } else if (templateMatch.type === 'bulk-create') {
        responseText = await executeBulkCreate(templateMatch.count, templateMatch.objectType, boardId, userId, objectsCreated, viewport);
      } else if (templateMatch.type === 'single-create') {
        responseText = await executeSingleCreate(templateMatch.objectType, boardId, userId, objectsCreated, viewport, templateMatch.label, templateMatch.color, templateMatch.shapeType, templateMatch.x, templateMatch.y);
      } else if (templateMatch.type === 'grid-create') {
        responseText = await executeGridCreate(templateMatch.rows, templateMatch.cols, boardId, userId, objectsCreated, viewport, templateMatch.labels);
      } else if (templateMatch.type === 'clear-board') {
        responseText = await executeClearBoard(boardId, objectsCreated);
      } else if (templateMatch.type === 'numbered-flowchart') {
        responseText = await executeNumberedFlowchart(templateMatch.stepCount, boardId, userId, objectsCreated, viewport, templateMatch.topic);
      } else if (templateMatch.type === 'arrange-grid') {
        responseText = await executeArrangeGrid(boardId, objectsCreated);
      } else if (templateMatch.type === 'selective-delete') {
        responseText = await executeSelectiveDelete(templateMatch.targetType, boardId, objectsCreated);
      } else if (templateMatch.type === 'bulk-color') {
        responseText = await executeBulkColor(templateMatch.targetType ?? 'all', templateMatch.color, boardId);
      } else if (templateMatch.type === 'row-create') {
        responseText = await executeRowCreate(templateMatch.count, templateMatch.direction, templateMatch.objectType, boardId, userId, objectsCreated, viewport);
      } else if (templateMatch.type === 'canned-response') {
        responseText = templateMatch.response;
      } else if (templateMatch.type === 'template') {
        responseText = await executeTemplate(templateMatch.templateType, boardId, userId, objectsCreated, viewport);
      } else {
        throw new Error('unhandled-template');
      }
      await requestRef.update({
        status: 'completed',
        response: responseText,
        objectsCreated,
        completedAt: Date.now(),
      });
      return { response: responseText, objectsCreated };
    } catch (err: unknown) {
      console.error('Template engine error:', err);
      // Fall through to LLM as fallback
    }
  }

  // Anthropic SDK client (cached singleton, lazy import)
  const anthropic = await getAnthropicClient();

  try {
    // Build context — single board state read, reused for both context and selection
    const hasSelection = selectedIds && selectedIds.length > 0;
    const contextLevel = hasSelection ? 'summary' : requestNeedsContext(prompt);

    let boardState: any[] | null = null;
    if (contextLevel === 'summary' || hasSelection) {
      boardState = await readBoardState(boardId);
    }

    let userMessage: string;
    if (contextLevel === 'summary' && boardState) {
      if (boardState.length === 0) {
        userMessage = `Board is empty.\n\nUser request: ${prompt}`;
      } else {
        const compactObjects = boardState.map(compactBoardObject);
        userMessage = `Board state (${boardState.length} objects):\n${JSON.stringify(compactObjects)}\n\nUser request: ${prompt}`;
      }
    } else {
      userMessage = prompt;
    }

    // Inject viewport so LLM places objects in the user's visible area
    if (viewport) {
      const vx = Math.round(viewport.x - viewport.width / 2);
      const vy = Math.round(viewport.y - viewport.height / 2);
      const vw = Math.round(viewport.width);
      const vh = Math.round(viewport.height);
      userMessage += `\n\nUser viewport (visible area): x=${vx}, y=${vy}, width=${vw}, height=${vh}. Place new objects within this region.`;
    }

    if (hasSelection && boardState) {
      const selectedObjects = boardState.filter(obj => selectedIds!.includes(obj.id));
      if (selectedObjects.length > 0) {
        const compactSelected = selectedObjects.map(compactBoardObject);
        userMessage += `\n\nCurrently selected objects (${selectedIds!.length}):\n${JSON.stringify(compactSelected)}`;
      } else {
        userMessage += `\n\nCurrently selected object IDs (${selectedIds!.length}): ${selectedIds!.join(', ')}`;
      }
    }

    // Anthropic SDK tools (same definitions, cast for API compatibility)
    const anthropicTools: Anthropic.Tool[] = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: userMessage },
    ];

    await requestRef.update({ progress: 'Thinking...' });

    // Tool execution loop — max 3 rounds to keep latency bounded
    const allToolCalls: { name: string; args: ToolInput }[] = [];
    let lastResponse: Anthropic.Message | null = null;

    for (let round = 0; round < 3; round++) {
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: anthropicTools,
        messages,
      });
      lastResponse = response;

      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
      );
      if (toolUseBlocks.length === 0) break;

      await requestRef.update({
        progress: `Executing ${toolUseBlocks.length} action${toolUseBlocks.length > 1 ? 's' : ''}...`,
      });

      const allReadOnly = toolUseBlocks.every(tc => READ_ONLY_TOOLS.has(tc.name));

      const results = await Promise.all(
        toolUseBlocks.map(async (toolBlock) => {
          try {
            const args = (toolBlock.input && typeof toolBlock.input === 'object') ? toolBlock.input as ToolInput : {} as ToolInput;
            let result: string;
            if (toolBlock.name === 'executePlan') {
              const planArgs = toolBlock.input as any;
              console.log(`executePlan raw args keys: ${Object.keys(planArgs || {}).join(', ')}`);
              result = await executeExecutePlan(
                planArgs.operations ?? [],
                boardId,
                userId,
                objectsCreated,
                groupLabels,
                planArgs.aiGroupId != null ? String(planArgs.aiGroupId) : undefined,
                planArgs.aiGroupLabel,
                viewport,
              );
            } else {
              result = await executeTool(
                toolBlock.name,
                args,
                boardId,
                userId,
                objectsCreated,
                groupLabels,
                selectedIds,
                viewport,
              );
            }
            return { id: toolBlock.id, name: toolBlock.name, result };
          } catch (toolErr: unknown) {
            const errMsg = toolErr instanceof Error ? toolErr.message : 'Tool execution failed';
            console.error(`Tool ${toolBlock.name} error:`, toolErr);
            return { id: toolBlock.id, name: toolBlock.name, result: JSON.stringify({ error: errMsg }) };
          }
        }),
      );

      allToolCalls.push(...toolUseBlocks.map(tc => ({ name: tc.name, args: tc.input as ToolInput })));

      if (allReadOnly && round < 2) {
        // Feed assistant response + tool results back for next round
        messages.push({ role: 'assistant', content: response.content });
        messages.push({
          role: 'user',
          content: results.map(r => ({
            type: 'tool_result' as const,
            tool_use_id: r.id,
            content: r.result,
          })),
        });
        await requestRef.update({ progress: 'Planning actions...' });
        continue;
      }

      break;
    }

    // LLM count validation: if user requested N objects but fewer were created, ask for more
    const countMatch = prompt.match(/(?:create|add|make|generate)\s+(\d+)/i)
      || prompt.match(/(\d+)\s+(?:random|new)\b/i);
    if (countMatch && objectsCreated.length > 0) {
      const requestedCount = parseInt(countMatch[1], 10);
      const deficit = requestedCount - objectsCreated.length;
      if (deficit > 0 && deficit <= 500) {
        await requestRef.update({ progress: `Created ${objectsCreated.length}/${requestedCount}, creating ${deficit} more...` });
        const correctionMsg = `You created ${objectsCreated.length} objects but the user requested ${requestedCount}. Please create ${deficit} more to reach the exact count.`;
        if (lastResponse) {
          messages.push({ role: 'assistant', content: lastResponse.content });
        }
        messages.push({ role: 'user', content: correctionMsg });

        const correctionResponse = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
          tools: anthropicTools,
          messages,
        });

        const corrToolBlocks = correctionResponse.content.filter(
          (b): b is Anthropic.ContentBlock & { type: 'tool_use' } => b.type === 'tool_use',
        );
        if (corrToolBlocks.length > 0) {
          await Promise.all(
            corrToolBlocks.map(async (toolBlock) => {
              try {
                const args = (toolBlock.input && typeof toolBlock.input === 'object') ? toolBlock.input as ToolInput : {} as ToolInput;
                if (toolBlock.name === 'executePlan') {
                  const planArgs = toolBlock.input as any;
                  await executeExecutePlan(planArgs.operations ?? [], boardId, userId, objectsCreated, groupLabels, undefined, undefined, viewport);
                } else {
                  await executeTool(toolBlock.name, args, boardId, userId, objectsCreated, groupLabels, selectedIds, viewport);
                }
              } catch (toolErr: unknown) {
                console.error(`Correction tool ${toolBlock.name} error:`, toolErr);
              }
            }),
          );
          allToolCalls.push(...corrToolBlocks.map(tc => ({ name: tc.name, args: tc.input as ToolInput })));
        }
      }
    }

    // Build deterministic summary from executed tool names (skip read-only tools)
    const actionCalls = allToolCalls.filter(tc => !READ_ONLY_TOOLS.has(tc.name));
    let responseText: string;
    if (actionCalls.length > 0) {
      const counts: Record<string, number> = {};
      for (const tc of actionCalls) {
        const label = TOOL_LABELS[tc.name] || tc.name;
        counts[label] = (counts[label] || 0) + 1;
      }
      const parts = Object.entries(counts).map(([label, count]) =>
        count > 1 ? `${label} x${count}` : label,
      );
      responseText = `Done! ${parts.join(', ')}.`;
    } else if (lastResponse) {
      const textBlocks = lastResponse.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      responseText = textBlocks.map(b => b.text).join('\n') || 'Done!';
    } else {
      responseText = 'Done!';
    }

    await requestRef.update({
      status: 'completed',
      response: responseText,
      objectsCreated,
      completedAt: Date.now(),
    });

    return { response: responseText, objectsCreated };
  } catch (err: unknown) {
    console.error('AI command error:', err);
    const message = err instanceof Error ? err.message : 'Internal error';
    await requestRef.update({
      status: 'error',
      error: message,
      completedAt: Date.now(),
    });
    throw err;
  }
}

// ---- Firestore-triggered Cloud Function (legacy fallback) ----

export const processAIRequest = onDocumentCreated(
  {
    document: 'boards/{boardId}/aiRequests/{requestId}',
    secrets: functionSecrets,
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const data = snapshot.data();
    const boardId = event.params.boardId;
    const requestId = event.params.requestId;

    const { prompt, userId, selectedIds, viewport } = data as {
      prompt: string; userId: string; selectedIds?: string[];
      viewport?: { x: number; y: number; width: number; height: number };
    };

    if (!prompt || !userId) {
      await db.doc(`boards/${boardId}/aiRequests/${requestId}`).update({
        status: 'error',
        error: 'Missing prompt or userId',
        completedAt: Date.now(),
      });
      return;
    }

    // Re-read current status — the callable may have claimed this doc between creation and trigger delivery
    const currentSnap = await db.doc(`boards/${boardId}/aiRequests/${requestId}`).get();
    const currentStatus = currentSnap.data()?.status;
    if (currentStatus !== 'pending') return;

    try {
      await processAICore({ boardId, requestId, prompt, userId, selectedIds, viewport });
    } catch {
      // Error already written to Firestore by processAICore
    }
  },
);

// ---- Callable Cloud Function (preferred — lower latency, no trigger delay) ----

export const processAIRequestCallable = onCall(
  {
    secrets: functionSecrets,
    timeoutSeconds: 300,
    memory: '512MiB',
    maxInstances: 10,
    invoker: 'public',
  },
  async (request) => {
    const userId = request.auth?.uid;
    if (!userId) {
      throw new HttpsError('unauthenticated', 'Must be signed in to use AI commands.');
    }

    const { boardId, requestId, prompt, selectedIds, viewport } = request.data as {
      boardId: string;
      requestId: string;
      prompt: string;
      selectedIds?: string[];
      viewport?: { x: number; y: number; width: number; height: number };
    };

    if (!boardId || !requestId || !prompt) {
      throw new HttpsError('invalid-argument', 'Missing boardId, requestId, or prompt.');
    }

    try {
      const result = await processAICore({ boardId, requestId, prompt, userId, selectedIds, viewport });
      return result;
    } catch (err: unknown) {
      // processAICore already wrote the error to Firestore
      const message = err instanceof Error ? err.message : 'Internal error';
      throw new HttpsError('internal', message);
    }
  },
);

// ---- GIPHY proxy callable (lightweight, no auth required) ----

export const searchGiphyCallable = onCall(
  {
    secrets: [giphyApiKey],
    timeoutSeconds: 15,
    memory: '128MiB',
    maxInstances: 10,
    invoker: 'public',
  },
  async (request) => {
    const { query, limit } = request.data as { query?: string; limit?: number };
    const q = (query ?? '').trim();
    if (!q) {
      throw new HttpsError('invalid-argument', 'Missing search query.');
    }

    const key = giphyApiKey.value().trim();
    if (!key) {
      throw new HttpsError('unavailable', 'GIPHY API key not configured.');
    }

    const url = `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&limit=${limit ?? 18}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new HttpsError('internal', `GIPHY API returned ${res.status}`);
    }

    const json = await res.json();
    return {
      data: (json.data ?? []).map((gif: Record<string, unknown>) => ({
        id: gif.id,
        title: gif.title,
        images: gif.images,
      })),
    };
  },
);

// ---- GIPHY cache trigger (Firestore-based proxy, bypasses Cloud Run CORS) ----

export const resolveGiphySearch = onDocumentCreated(
  {
    document: 'giphyCache/{queryId}',
    secrets: [giphyApiKey],
    timeoutSeconds: 15,
    memory: '128MiB',
    maxInstances: 10,
  },
  async (event) => {
    const data = event.data?.data();
    if (!data || data.status !== 'pending') return;

    const query = (data.query as string || '').trim();
    const limit = (data.limit as number) || 18;
    if (!query) {
      await event.data!.ref.update({ status: 'error', error: 'Empty query' });
      return;
    }

    const key = giphyApiKey.value().trim();
    if (!key) {
      await event.data!.ref.update({ status: 'error', error: 'GIPHY API key not configured' });
      return;
    }

    try {
      const url = `https://api.giphy.com/v1/stickers/search?api_key=${encodeURIComponent(key)}&q=${encodeURIComponent(query)}&limit=${limit}`;
      const res = await fetch(url);
      if (!res.ok) {
        await event.data!.ref.update({ status: 'error', error: `GIPHY API ${res.status}` });
        return;
      }

      const json = await res.json();
      const results = (json.data ?? []).map((gif: Record<string, unknown>) => ({
        id: gif.id,
        title: gif.title,
        images: gif.images,
      }));

      await event.data!.ref.update({
        status: 'complete',
        results,
        cachedAt: Date.now(),
      });
    } catch (err) {
      await event.data!.ref.update({
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  },
);

// ---- Exports for testing ----
export { detectTemplate, buildObjectData, requestNeedsContext, resolveFontFamily, computeAutoOrigin, executeBulkCreate, executeSingleCreate, executeGridCreate, executeClearBoard, executeNumberedFlowchart, executeArrangeGrid, executeSelectiveDelete, executeBulkColor, executeRowCreate };
export type { TemplateMatch };
