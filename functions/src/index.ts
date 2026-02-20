import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { BaseMessage } from '@langchain/core/messages';

initializeApp();
const db = getFirestore();

const opencodeApiKey = defineSecret('OPENCODE_API_KEY');
const langchainApiKey = defineSecret('LANGCHAIN_API_KEY');
const langfuseSecretKey = defineSecret('LANGFUSE_SECRET_KEY');
const langfusePublicKey = defineSecret('LANGFUSE_PUBLIC_KEY');
const langfuseHost = defineSecret('LANGFUSE_HOST');

// ---- Tool definitions for Claude ----

const tools = [
  {
    name: 'createStickyNote',
    description: 'Create a sticky note. Returns the created object ID.',
    schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text content of the sticky note' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        color: { type: 'string', description: 'Background color as hex string (default: #fef9c3)' },
        textColor: { type: 'string', description: 'Text color as hex string (default: #1e293b). Use for contrast against the background color.' },
        parentId: { type: 'string', description: 'Frame ID to attach to' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
        borderColor: { type: 'string', description: 'Border color as hex string (default: none)' },
        fontSize: { type: 'number', description: 'Font size: 16, 24, 36, or 48 (default: 16)' },
        fontFamily: { type: 'string', enum: ['sans', 'serif', 'mono', 'cursive'], description: 'Font family (default: sans). sans=Inter, serif=Georgia, mono=Fira Code, cursive=Caveat' },
        fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'Font weight (default: normal)' },
        fontStyle: { type: 'string', enum: ['normal', 'italic'], description: 'Font style (default: normal)' },
        textAlign: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment (default: left)' },
        width: { type: 'number', description: 'Width in pixels (default: 200)' },
        height: { type: 'number', description: 'Height in pixels (default: 200)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape on the whiteboard. Supports: rect, circle, line, triangle, diamond, pentagon, hexagon, octagon, star, arrow, cross. For lines, use fromX/fromY/toX/toY to specify endpoints — the server computes position, length, and rotation automatically.',
    schema: {
      type: 'object' as const,
      properties: {
        shapeType: { type: 'string', enum: ['rect', 'circle', 'line', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'arrow', 'cross'], description: 'The type of shape to create' },
        x: { type: 'number', description: 'X position (for all shapes except lines). Not needed for lines if using fromX/fromY/toX/toY.' },
        y: { type: 'number', description: 'Y position (for all shapes except lines). Not needed for lines if using fromX/fromY/toX/toY.' },
        width: { type: 'number', description: 'Width in pixels (default: 120). Not needed for lines.' },
        height: { type: 'number', description: 'Height in pixels (default: 120). Not needed for lines.' },
        color: { type: 'string', description: 'Fill color as hex string (default: #dbeafe)' },
        strokeColor: { type: 'string', description: 'Border/outline color as hex string (default: #4f46e5)' },
        fromX: { type: 'number', description: 'Line start X coordinate. Use this for lines instead of x/width/rotation.' },
        fromY: { type: 'number', description: 'Line start Y coordinate.' },
        toX: { type: 'number', description: 'Line end X coordinate.' },
        toY: { type: 'number', description: 'Line end Y coordinate.' },
        parentId: { type: 'string', description: 'Frame ID to attach to' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
        borderColor: { type: 'string', description: 'Additional border color (default: none). Separate from strokeColor.' },
      },
      required: ['shapeType'],
    },
  },
  {
    name: 'createFrame',
    description: 'Create a frame (grouping container). Returns the frame ID — use as parentId for children. Set borderless=true for invisible grouping.',
    schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title text displayed on the frame (ignored when borderless)' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 400)' },
        height: { type: 'number', description: 'Content area height in pixels (title bar renders above y, adding ~36px visually). Default: 300' },
        borderless: { type: 'boolean', description: 'If true, creates a transparent borderless frame — invisible grouping container with no border or title bar. Great for logical groupings without visual clutter. (default: false)' },
        color: { type: 'string', description: 'Background/fill color as hex string (default: none)' },
        borderColor: { type: 'string', description: 'Border stroke color as hex string (default: none)' },
        textColor: { type: 'string', description: 'Title text color as hex string (default: none)' },
        fontSize: { type: 'number', description: 'Title font size (default: 16)' },
        fontFamily: { type: 'string', enum: ['sans', 'serif', 'mono', 'cursive'], description: 'Title font family (default: sans)' },
        fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'Title font weight (default: normal)' },
        fontStyle: { type: 'string', enum: ['normal', 'italic'], description: 'Title font style (default: normal)' },
        parentId: { type: 'string', description: 'Parent frame ID for nesting' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
      },
      required: ['title'],
    },
  },
  {
    name: 'createSticker',
    description: 'Create an emoji sticker on the whiteboard. Stickers are single emoji that can be placed and resized. Returns the created object ID.',
    schema: {
      type: 'object' as const,
      properties: {
        emoji: { type: 'string', description: 'A single emoji character (e.g., "🎉", "❤️", "👍")' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        size: { type: 'number', description: 'Size in pixels (default: 100)' },
        parentId: { type: 'string', description: 'Frame ID to attach to' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
      },
      required: ['emoji'],
    },
  },
  {
    name: 'createGifSticker',
    description: 'Create an animated GIF sticker on the whiteboard. Provide a search term and the client will find the best matching GIF from GIPHY. Returns the created object ID.',
    schema: {
      type: 'object' as const,
      properties: {
        searchTerm: { type: 'string', description: 'Keywords to search for a GIF (e.g. "celebration", "thumbs up", "mind blown", "fish swimming")' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        size: { type: 'number', description: 'Size in pixels (default: 150)' },
        parentId: { type: 'string', description: 'Frame ID to attach to' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
      },
      required: ['searchTerm'],
    },
  },
  {
    name: 'createText',
    description: 'Create a standalone text element on the whiteboard (heading, label, paragraph). No background by default. Supports font styling. Returns the created object ID.',
    schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text content' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 300)' },
        height: { type: 'number', description: 'Height in pixels (default: 50)' },
        fontSize: { type: 'number', description: 'Font size: 16, 24, 36, or 48 (default: 24)' },
        fontWeight: { type: 'string', enum: ['normal', 'bold'], description: 'Font weight (default: normal)' },
        fontStyle: { type: 'string', enum: ['normal', 'italic'], description: 'Font style (default: normal)' },
        textAlign: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment (default: left)' },
        color: { type: 'string', description: 'Text color as hex string (default: #1e293b)' },
        bgColor: { type: 'string', description: 'Background color (default: transparent)' },
        fontFamily: { type: 'string', enum: ['sans', 'serif', 'mono', 'cursive'], description: 'Font family (default: sans). sans=Inter, serif=Georgia, mono=Fira Code, cursive=Caveat' },
        borderColor: { type: 'string', description: 'Border color as hex string (default: none)' },
        parentId: { type: 'string', description: 'Frame ID to attach to' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'createConnector',
    description: 'Create a connector line between two existing objects on the board. Supports line styles, arrows, and custom colors.',
    schema: {
      type: 'object' as const,
      properties: {
        fromId: { type: 'string', description: 'ID of the source object' },
        toId: { type: 'string', description: 'ID of the target object' },
        style: { type: 'string', enum: ['straight', 'curved'], description: 'Connector curve style (default: straight)' },
        lineType: { type: 'string', enum: ['solid', 'dashed', 'dotted'], description: 'Line dash style (default: solid)' },
        startArrow: { type: 'boolean', description: 'Show arrowhead at the start/source end (default: false)' },
        endArrow: { type: 'boolean', description: 'Show arrowhead at the end/target end (default: false)' },
        strokeWidth: { type: 'number', description: 'Line thickness in pixels (default: 2)' },
        color: { type: 'string', description: 'Connector color as hex string (default: #6366f1)' },
        aiLabel: { type: 'string', description: 'Object description' },
        aiGroupId: { type: 'number', description: 'Numeric group ID (reuse same number for related objects)' },
        aiGroupLabel: { type: 'string', description: 'Group name (provide once per aiGroupId)' },
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to move' },
        x: { type: 'number', description: 'New X position' },
        y: { type: 'number', description: 'New Y position' },
      },
      required: ['objectId', 'x', 'y'],
    },
  },
  {
    name: 'resizeObject',
    description: 'Resize an existing object.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to resize' },
        width: { type: 'number', description: 'New width in pixels' },
        height: { type: 'number', description: 'New height in pixels' },
      },
      required: ['objectId', 'width', 'height'],
    },
  },
  {
    name: 'updateText',
    description: 'Update the text content of a sticky note or text element.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the sticky note or text element to update' },
        newText: { type: 'string', description: 'New text content' },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description: 'Change colors of an existing object. For sticky notes: color (background), textColor, borderColor. For shapes: color (fill), strokeColor (border), borderColor. For text elements: color (text), bgColor (background), borderColor. For frames: color (background), borderColor, textColor. For connectors: color. Provide only the color properties you want to change.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to recolor' },
        newColor: { type: 'string', description: 'New background/fill color as hex string' },
        textColor: { type: 'string', description: 'New text color (sticky notes, text elements, frames)' },
        strokeColor: { type: 'string', description: 'New border/outline color (shapes only)' },
        bgColor: { type: 'string', description: 'New background color (text elements only)' },
        borderColor: { type: 'string', description: 'New border color (sticky notes, shapes, text elements, frames)' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete an existing object from the board.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to delete' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'updateParent',
    description: 'Change the parent of an existing object. Use this to attach/detach objects to/from frames or change frame nesting. Set newParentId to empty string to make object independent (no parent).',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object whose parent you want to change' },
        newParentId: { type: 'string', description: 'ID of the new parent frame, or empty string ("") to make object independent' },
      },
      required: ['objectId', 'newParentId'],
    },
  },
  {
    name: 'embedInFrame',
    description: 'Move one or more existing objects into a frame. Auto-repositions them inside the frame in a vertical stack. Use this instead of calling updateParent + moveObject separately for each object.',
    schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'IDs of existing objects to embed into the frame' },
        frameId: { type: 'string', description: 'ID of the target frame to embed objects into' },
      },
      required: ['objectIds', 'frameId'],
    },
  },
  {
    name: 'alignObjects',
    description: 'Align multiple objects along an axis or distribute them evenly. Alignment snaps objects to a shared edge/center. Distribution spaces them evenly. After alignment, overlapping objects are nudged apart automatically.',
    schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Array of object IDs to align' },
        alignment: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'center-x', 'center-y', 'distribute-horizontal', 'distribute-vertical'], description: 'Alignment mode. left/right/top/bottom snap edges. center-x: align centers along X axis (same center X → objects form a VERTICAL column). center-y: align centers along Y axis (same center Y → objects form a HORIZONTAL row). distribute-horizontal/vertical space objects evenly.' },
        spacing: { type: 'number', description: 'Minimum gap between objects in pixels (default: 20). Used for overlap nudging and distribute modes.' },
      },
      required: ['objectIds', 'alignment'],
    },
  },
  {
    name: 'layoutObjects',
    description: 'Arrange objects in a layout pattern. All modes prevent overlaps with configurable spacing. Use alignObjects for simple edge/center snapping or even distribution.',
    schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Array of object IDs to arrange' },
        mode: { type: 'string', enum: ['row', 'column', 'grid', 'staggered', 'circular', 'pack', 'fan'], description: 'Layout pattern: row (horizontal line), column (vertical stack), grid (N columns wrapping), staggered (brick pattern with offset rows), circular (around a circle), pack (tight bin-packing), fan (arc/semicircle)' },
        spacing: { type: 'number', description: 'Gap between objects in pixels (default: 20)' },
        startX: { type: 'number', description: 'X origin for layout (default: auto from current positions)' },
        startY: { type: 'number', description: 'Y origin for layout (default: auto from current positions)' },
        columns: { type: 'number', description: 'Number of columns for grid and staggered modes (default: 3)' },
        radius: { type: 'number', description: 'Radius for circular/fan modes (default: auto-computed from object count and sizes)' },
        arcDegrees: { type: 'number', description: 'Arc span in degrees for fan mode (default: 180 for semicircle). 360 = full circle.' },
        alignment: { type: 'string', enum: ['start', 'center', 'end'], description: 'Cross-axis alignment within rows/columns (default: center). start=top/left, center=middle, end=bottom/right.' },
      },
      required: ['objectIds', 'mode'],
    },
  },
  {
    name: 'duplicateObject',
    description: 'Duplicate an object one or more times with optional offset.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to duplicate' },
        count: { type: 'number', description: 'Number of copies to create (default: 1)' },
        offsetX: { type: 'number', description: 'X offset for each duplicate (default: 20)' },
        offsetY: { type: 'number', description: 'Y offset for each duplicate (default: 20)' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'setZIndex',
    description: 'Control the layering order of an object (send to back, bring to front).',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to reorder' },
        operation: { type: 'string', enum: ['toFront', 'toBack', 'forward', 'backward'], description: 'Layering operation' },
      },
      required: ['objectId', 'operation'],
    },
  },
  {
    name: 'rotateObject',
    description: 'Rotate an object to a specific angle (in degrees).',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to rotate' },
        rotation: { type: 'number', description: 'Rotation angle in degrees (0-360)' },
      },
      required: ['objectId', 'rotation'],
    },
  },
  {
    name: 'generateFromTemplate',
    description: 'Generate common whiteboard templates (SWOT, Kanban, retrospective, etc.).',
    schema: {
      type: 'object' as const,
      properties: {
        templateType: { type: 'string', enum: ['swot', 'kanban', 'retrospective', 'eisenhower', 'mind-map'], description: 'Template type to generate' },
        x: { type: 'number', description: 'Starting X position (default: 0)' },
        y: { type: 'number', description: 'Starting Y position (default: 0)' },
        title: { type: 'string', description: 'Optional title for the template' },
      },
      required: ['templateType'],
    },
  },
  {
    name: 'getObject',
    description: 'Get full details of a single object by its ID. Returns all fields including type, position, text, colors, parentId, etc.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to retrieve' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'updateFrameTitle',
    description: 'Update the title of an existing frame.',
    schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the frame to update' },
        title: { type: 'string', description: 'New title for the frame' },
      },
      required: ['objectId', 'title'],
    },
  },
  {
    name: 'searchObjects',
    description: 'Search for objects on the board by type, text content, or parent frame. Returns lightweight summaries. All filters are optional and combined with AND logic.',
    schema: {
      type: 'object' as const,
      properties: {
        objectType: { type: 'string', description: 'Filter by object type (sticky, shape, frame, sticker, connector, text)' },
        textContains: { type: 'string', description: 'Filter objects whose text/title contains this substring (case-insensitive)' },
        parentId: { type: 'string', description: 'Filter objects that are children of this frame ID' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'getBoardSummary',
    description: 'Get a high-level summary of the board: total count, count by type, and list of frames with their IDs and titles. Cheaper than getBoardState for understanding board structure.',
    schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'deleteObjects',
    description: 'Delete multiple objects at once by their IDs. More efficient than calling deleteObject repeatedly.',
    schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Array of object IDs to delete' },
      },
      required: ['objectIds'],
    },
  },
  {
    name: 'getBoardState',
    description: 'Get the current state of all objects on the board. Use this to understand what is already on the board before manipulating existing objects.',
    schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: 'getSelectedObjects',
    description: 'Get details of the objects the user currently has selected. Returns compact object data for selected items only. Use when the user asks about their selection or says "these", "selected", etc.',
    schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
];

// Human-readable labels for deterministic summaries (C1)
const TOOL_LABELS: Record<string, string> = {
  createStickyNote: 'Created sticky note',
  createShape: 'Created shape',
  createFrame: 'Created frame',
  createSticker: 'Created sticker',
  createGifSticker: 'Created GIF sticker',
  createText: 'Created text element',
  createConnector: 'Created connector',
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
  generateFromTemplate: 'Generated template',
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

Compact board state keys: w=width, h=height, pid=parentId, rot=rotation, sel=selected.

Canvas: infinite, X→right, Y→down. (0,0)=top-left of ~1200x800 viewport.

Frames: set parentId to attach children. Coords are ABSOLUTE. Title bar renders ABOVE frame.y. Position children at frameX+20, frameY+20. Use embedInFrame for bulk. updateParent auto-repositions.

Layout: layoutObjects (row/column/grid/staggered/circular/pack/fan). alignObjects (left/right/top/bottom/center-x/center-y/distribute-horizontal/distribute-vertical). "Align horizontally"=same Y (row). "Align vertically"=same X (column). Auto spacing 20px.

Colors — Yellow:#fef9c3 Blue:#dbeafe Green:#dcfce7 Pink:#fce7f3 Purple:#f3e8ff Orange:#ffedd5
Fonts — sans(Inter) serif(Georgia) mono(Fira Code) cursive(Caveat)

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

async function executeTool(
  toolName: string,
  input: ToolInput,
  boardId: string,
  userId: string,
  objectsCreated: string[],
  groupLabels: Record<number, string>,
  selectedIds?: string[],
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();

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
      const docRef = objectsRef.doc();
      const size = input.size ?? 150;
      const data: Record<string, unknown> = {
        type: 'sticker',
        emoji: '',
        gifSearchTerm: input.searchTerm ?? '',
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
      return JSON.stringify({ id: docRef.id, type: 'sticker', searchTerm: input.searchTerm });
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

      const results: { id: string; repositioned: boolean }[] = [];
      for (const id of ids) {
        const docSnap = await objectsRef.doc(id).get();
        if (!docSnap.exists) {
          results.push({ id, repositioned: false });
          continue;
        }
        const obj = docSnap.data() as any;
        const updates: Record<string, unknown> = { parentId: frameId, updatedAt: now };

        updates.x = interiorX;
        updates.y = nextY;
        if (obj.width > maxW) updates.width = maxW;

        nextY += (obj.height || 200) + 10;

        await objectsRef.doc(id).update(updates);
        results.push({ id, repositioned: true });
      }

      return JSON.stringify({ success: true, frameId, embedded: results.length, results });
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

      await Promise.all(objectData.map(o =>
        objectsRef.doc(o.id).update({ x: o.x, y: o.y, updatedAt: now })
      ));
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

      await Promise.all(positions.map(p =>
        objectsRef.doc(p.id).update({ x: p.x, y: p.y, updatedAt: now })
      ));
      return JSON.stringify({ success: true, arranged: ids.length, mode: input.mode });
    }

    case 'duplicateObject': {
      const sourceDoc = await objectsRef.doc(input.objectId!).get();
      if (!sourceDoc.exists) return JSON.stringify({ error: 'Object not found' });

      const sourceData = sourceDoc.data() as any;
      const count = input.count ?? 1;
      const offsetX = input.offsetX ?? 20;
      const offsetY = input.offsetY ?? 20;

      const duplicates = [];
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
        await docRef.set(duplicate);
        objectsCreated.push(docRef.id);
        duplicates.push(docRef.id);
      }

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

    case 'generateFromTemplate': {
      const templateType = input.templateType!;
      const startX = input.x ?? 0;
      const startY = input.y ?? 0;
      const created: string[] = [];

      switch (templateType) {
        case 'swot': {
          // Create 2x2 grid of frames with starter stickies
          const frameWidth = 400;
          const frameHeight = 300;
          const gap = 20;
          const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
          const colors = ['#dcfce7', '#fce7f3', '#dbeafe', '#ffedd5'];
          const prompts = ['What are we good at?', 'Where can we improve?', 'What trends can we leverage?', 'What risks do we face?'];

          for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const frameRef = objectsRef.doc();
            const fx = startX + col * (frameWidth + gap);
            const fy = startY + row * (frameHeight + gap);
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: fx,
              y: fy,
              width: frameWidth,
              height: frameHeight,
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: '',
            };
            await frameRef.set(frameData);
            objectsCreated.push(frameRef.id);
            created.push(frameRef.id);

            // Starter sticky inside frame
            const stickyRef = objectsRef.doc();
            await stickyRef.set({
              type: 'sticky',
              text: prompts[i],
              x: fx + 20,
              y: fy + 20,
              width: 180,
              height: 180,
              color: colors[i],
              textColor: '#1e293b',
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: frameRef.id,
            });
            objectsCreated.push(stickyRef.id);
            created.push(stickyRef.id);
          }
          break;
        }

        case 'kanban': {
          // Create 3 columns with starter stickies
          const frameWidth = 350;
          const frameHeight = 600;
          const gap = 20;
          const titles = ['To Do', 'In Progress', 'Done'];
          const kanbanColors = ['#fef9c3', '#dbeafe', '#dcfce7'];
          const kanbanPrompts = ['Add tasks here', 'Work in progress', 'Completed tasks'];

          for (let i = 0; i < 3; i++) {
            const frameRef = objectsRef.doc();
            const fx = startX + i * (frameWidth + gap);
            const fy = startY;
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: fx,
              y: fy,
              width: frameWidth,
              height: frameHeight,
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: '',
            };
            await frameRef.set(frameData);
            objectsCreated.push(frameRef.id);
            created.push(frameRef.id);

            // Starter sticky inside frame
            const stickyRef = objectsRef.doc();
            await stickyRef.set({
              type: 'sticky',
              text: kanbanPrompts[i],
              x: fx + 20,
              y: fy + 20,
              width: 180,
              height: 180,
              color: kanbanColors[i],
              textColor: '#1e293b',
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: frameRef.id,
            });
            objectsCreated.push(stickyRef.id);
            created.push(stickyRef.id);
          }
          break;
        }

        case 'retrospective': {
          // What went well, What didn't, Action items — with starter stickies
          const retroFrameWidth = 400;
          const retroFrameHeight = 500;
          const retroGap = 20;
          const retroTitles = ['What Went Well \u{1F60A}', 'What Didn\'t Go Well \u{1F61E}', 'Action Items \u{1F3AF}'];
          const retroColors = ['#dcfce7', '#fce7f3', '#dbeafe'];
          const retroPrompts = ['Add your wins here', 'What could be better?', 'Next steps to take'];

          for (let i = 0; i < 3; i++) {
            const frameRef = objectsRef.doc();
            const fx = startX + i * (retroFrameWidth + retroGap);
            const fy = startY;
            const frameData = {
              type: 'frame',
              title: retroTitles[i],
              x: fx,
              y: fy,
              width: retroFrameWidth,
              height: retroFrameHeight,
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: '',
            };
            await frameRef.set(frameData);
            objectsCreated.push(frameRef.id);
            created.push(frameRef.id);

            // Starter sticky inside frame
            const stickyRef = objectsRef.doc();
            await stickyRef.set({
              type: 'sticky',
              text: retroPrompts[i],
              x: fx + 20,
              y: fy + 20,
              width: 180,
              height: 180,
              color: retroColors[i],
              textColor: '#1e293b',
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: frameRef.id,
            });
            objectsCreated.push(stickyRef.id);
            created.push(stickyRef.id);
          }
          break;
        }

        case 'eisenhower': {
          // Urgent/Important matrix with starter stickies
          const eiFrameWidth = 400;
          const eiFrameHeight = 300;
          const eiGap = 20;
          const eiTitles = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Neither'];
          const eiColors = ['#fce7f3', '#dbeafe', '#ffedd5', '#f3e8ff'];
          const eiPrompts = ['Do it now', 'Schedule it', 'Delegate it', 'Drop it'];

          for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const frameRef = objectsRef.doc();
            const fx = startX + col * (eiFrameWidth + eiGap);
            const fy = startY + row * (eiFrameHeight + eiGap);
            const frameData = {
              type: 'frame',
              title: eiTitles[i],
              x: fx,
              y: fy,
              width: eiFrameWidth,
              height: eiFrameHeight,
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: '',
            };
            await frameRef.set(frameData);
            objectsCreated.push(frameRef.id);
            created.push(frameRef.id);

            // Starter sticky inside frame
            const stickyRef = objectsRef.doc();
            await stickyRef.set({
              type: 'sticky',
              text: eiPrompts[i],
              x: fx + 20,
              y: fy + 20,
              width: 180,
              height: 180,
              color: eiColors[i],
              textColor: '#1e293b',
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: frameRef.id,
            });
            objectsCreated.push(stickyRef.id);
            created.push(stickyRef.id);
          }
          break;
        }

        case 'mind-map': {
          // Central node + 4 branches
          const centerRef = objectsRef.doc();
          const centerData = {
            type: 'sticky',
            text: input.title ?? 'Central Idea',
            x: startX + 400,
            y: startY + 300,
            width: 200,
            height: 200,
            color: '#fef9c3',
            rotation: 0,
            createdBy: userId,
            updatedAt: now,
            parentId: '',
          };
          await centerRef.set(centerData);
          objectsCreated.push(centerRef.id);
          created.push(centerRef.id);

          // Create 4 branches around it
          const positions = [
            { x: startX, y: startY + 300 },
            { x: startX + 800, y: startY + 300 },
            { x: startX + 400, y: startY },
            { x: startX + 400, y: startY + 600 },
          ];

          for (let i = 0; i < 4; i++) {
            const branchRef = objectsRef.doc();
            const branchData = {
              type: 'sticky',
              text: `Branch ${i + 1}`,
              x: positions[i].x,
              y: positions[i].y,
              width: 200,
              height: 200,
              color: '#dbeafe',
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
              parentId: '',
            };
            await branchRef.set(branchData);
            objectsCreated.push(branchRef.id);
            created.push(branchRef.id);

            // Create connector
            const connectorRef = objectsRef.doc();
            const connectorData = {
              type: 'connector',
              fromId: centerRef.id,
              toId: branchRef.id,
              style: 'curved',
              x: 0,
              y: 0,
              width: 0,
              height: 0,
              rotation: 0,
              createdBy: userId,
              updatedAt: now,
            };
            await connectorRef.set(connectorData);
            objectsCreated.push(connectorRef.id);
            created.push(connectorRef.id);
          }
          break;
        }
      }

      return JSON.stringify({ success: true, template: templateType, created });
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

// ---- Firestore-triggered Cloud Function (v2) ----
// Client writes to boards/{boardId}/aiRequests/{requestId}
// Optimized: single LLM call (no second round), parallel tool execution, trimmed prompt.
// Full LangChain + Langfuse observability preserved.

export const processAIRequest = onDocumentCreated(
  {
    document: 'boards/{boardId}/aiRequests/{requestId}',
    secrets: [opencodeApiKey, langchainApiKey, langfuseSecretKey, langfusePublicKey, langfuseHost],
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
    const requestRef = db.doc(`boards/${boardId}/aiRequests/${requestId}`);

    const { prompt, userId, selectedIds } = data as { prompt: string; userId: string; selectedIds?: string[] };

    if (!prompt || !userId) {
      await requestRef.update({
        status: 'error',
        error: 'Missing prompt or userId',
        completedAt: Date.now(),
      });
      return;
    }

    // Mark as processing
    await requestRef.update({ status: 'processing', progress: 'Planning...' });

    const objectsCreated: string[] = [];
    const groupLabels: Record<number, string> = {};

    // Set LangSmith tracing env vars
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_API_KEY = langchainApiKey.value();
    process.env.LANGCHAIN_PROJECT = 'FlowSpace';
    process.env.LANGCHAIN_CALLBACKS_BACKGROUND = 'false';

    // Set Langfuse env vars BEFORE importing @langfuse packages
    process.env.LANGFUSE_SECRET_KEY = langfuseSecretKey.value();
    process.env.LANGFUSE_PUBLIC_KEY = langfusePublicKey.value();
    process.env.LANGFUSE_BASE_URL = langfuseHost.value();

    // Lazy-load LangChain and Langfuse
    const { ChatOpenAI } = await import('@langchain/openai');
    const { HumanMessage, SystemMessage } = await import('@langchain/core/messages');
    const { CallbackHandler } = await import('@langfuse/langchain');

    // Set up OpenTelemetry with Langfuse exporter
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { LangfuseSpanProcessor } = await import('@langfuse/otel');
    const otelSdk = new NodeSDK({
      spanProcessors: [new LangfuseSpanProcessor()],
    });
    otelSdk.start();

    const langfuseHandler = new CallbackHandler({
      sessionId: requestId,
      userId: userId,
    });

    try {
      // Build context — provide full compact board state when the LLM needs to act on existing objects
      const hasSelection = selectedIds && selectedIds.length > 0;
      const contextLevel = hasSelection ? 'summary' : requestNeedsContext(prompt);

      let userMessage: string;
      if (contextLevel === 'summary') {
        const boardState = await readBoardState(boardId);
        if (boardState.length === 0) {
          userMessage = `Board is empty.\n\nUser request: ${prompt}`;
        } else {
          // Provide compact board state with IDs so the LLM can act in a single call
          const compactObjects = boardState.map(compactBoardObject);
          userMessage = `Board state (${boardState.length} objects):\n${JSON.stringify(compactObjects)}\n\nUser request: ${prompt}`;
        }
      } else {
        userMessage = prompt;
      }

      if (selectedIds && selectedIds.length > 0) {
        // Also provide selected object details so LLM can act on them directly
        const boardState = await readBoardState(boardId);
        const selectedObjects = boardState.filter(obj => selectedIds.includes(obj.id));
        if (selectedObjects.length > 0) {
          const compactSelected = selectedObjects.map(compactBoardObject);
          userMessage += `\n\nCurrently selected objects (${selectedIds.length}):\n${JSON.stringify(compactSelected)}`;
        } else {
          userMessage += `\n\nCurrently selected object IDs (${selectedIds.length}): ${selectedIds.join(', ')}`;
        }
      }

      // LangChain ChatOpenAI with tools
      const model = new ChatOpenAI({
        model: 'minimax-m2.5-free',
        maxTokens: 4096,
        maxRetries: 2,
        apiKey: opencodeApiKey.value(),
        configuration: {
          baseURL: 'https://opencode.ai/zen/v1',
        },
      });
      const modelWithTools = model.bindTools(tools as never);

      const messages: BaseMessage[] = [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userMessage),
      ];

      await requestRef.update({ progress: 'Thinking...' });

      // Read-only tools that return data but don't modify the board
      const READ_ONLY_TOOLS = new Set([
        'getBoardState', 'getBoardSummary', 'searchObjects', 'getObject', 'getSelectedObjects',
      ]);

      // Tool execution loop — max 3 rounds to keep latency bounded
      // Most commands complete in 1 round (context provided upfront).
      // Commands needing read-then-act get a second round.
      const allToolCalls: { name: string; args: ToolInput }[] = [];
      let lastResponse: BaseMessage | null = null;

      for (let round = 0; round < 3; round++) {
        const response = await modelWithTools.invoke(messages, {
          callbacks: [langfuseHandler],
        });
        lastResponse = response;

        const toolCalls = response.tool_calls ?? [];
        if (toolCalls.length === 0) break; // No tools requested — done

        await requestRef.update({
          progress: `Executing ${toolCalls.length} action${toolCalls.length > 1 ? 's' : ''}...`,
        });

        // Check if this round is all read-only tools
        const allReadOnly = toolCalls.every(tc => READ_ONLY_TOOLS.has(tc.name));

        // C3: Parallelize tool executions
        const results = await Promise.all(
          toolCalls.map(async (toolCall) => {
            const result = await executeTool(
              toolCall.name,
              toolCall.args as ToolInput,
              boardId,
              userId,
              objectsCreated,
              groupLabels,
              selectedIds,
            );
            return { id: toolCall.id, name: toolCall.name, result };
          }),
        );

        allToolCalls.push(...toolCalls.map(tc => ({ name: tc.name, args: tc.args as ToolInput })));

        // If all tools were read-only, feed results back for another round
        if (allReadOnly && round < 2) {
          const { AIMessage, ToolMessage } = await import('@langchain/core/messages');
          messages.push(response); // AI message with tool_calls
          for (const r of results) {
            messages.push(new ToolMessage({ content: r.result, tool_call_id: r.id ?? r.name }));
          }
          await requestRef.update({ progress: 'Planning actions...' });
          continue;
        }

        break; // Had write tools or max rounds — stop
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
        // No action tools — use the model's text response
        const content = lastResponse.content;
        responseText = typeof content === 'string'
          ? (content || 'Done!')
          : Array.isArray(content)
            ? content
                .filter((b): b is { type: 'text'; text: string } =>
                  typeof b === 'object' && 'type' in b && b.type === 'text')
                .map((b) => b.text)
                .join('\n') || 'Done!'
            : 'Done!';
      } else {
        responseText = 'Done!';
      }

      // Update request document with response
      await requestRef.update({
        status: 'completed',
        response: responseText,
        objectsCreated,
        completedAt: Date.now(),
      });
    } catch (err: unknown) {
      console.error('AI command error:', err);
      const message = err instanceof Error ? err.message : 'Internal error';
      await requestRef.update({
        status: 'error',
        error: message,
        completedAt: Date.now(),
      });
    } finally {
      // Flush all pending OTEL spans to Langfuse
      try { await otelSdk.shutdown(); } catch (e) { console.warn('OTEL shutdown error (non-fatal):', e); }
    }
  },
);
