import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import type { BaseMessage } from '@langchain/core/messages';

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');
const langchainApiKey = defineSecret('LANGCHAIN_API_KEY');
const langfuseSecretKey = defineSecret('LANGFUSE_SECRET_KEY');
const langfusePublicKey = defineSecret('LANGFUSE_PUBLIC_KEY');
const langfuseHost = defineSecret('LANGFUSE_HOST');

// ---- Tool definitions for Claude ----

const tools = [
  {
    name: 'createStickyNote',
    description: 'Create a sticky note on the whiteboard. Returns the created object ID. IMPORTANT: Set parentId to attach it to a frame - without parentId, it will be independent and not move with any frame.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text content of the sticky note' },
        x: { type: 'number', description: 'X position on the canvas in ABSOLUTE coordinates (default: 0)' },
        y: { type: 'number', description: 'Y position on the canvas in ABSOLUTE coordinates (default: 0)' },
        color: { type: 'string', description: 'Background color as hex string (default: #fef9c3)' },
        textColor: { type: 'string', description: 'Text color as hex string (default: #1e293b). Use for contrast against the background color.' },
        borderColor: { type: 'string', description: 'Border color as hex string (default: transparent). Use "transparent" for no border.' },
        parentId: { type: 'string', description: 'CRITICAL: ID of a frame to attach this sticky note to. Without this, the note will NOT move with any frame. Get the frame ID from the createFrame response.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape on the whiteboard. Supports: rect, circle, line, triangle, diamond, pentagon, hexagon, octagon, star, arrow, cross. For lines, use fromX/fromY/toX/toY to specify endpoints — the server computes position, length, and rotation automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shapeType: { type: 'string', enum: ['rect', 'circle', 'line', 'triangle', 'diamond', 'pentagon', 'hexagon', 'octagon', 'star', 'arrow', 'cross'], description: 'The type of shape to create' },
        x: { type: 'number', description: 'X position (for all shapes except lines). Not needed for lines if using fromX/fromY/toX/toY.' },
        y: { type: 'number', description: 'Y position (for all shapes except lines). Not needed for lines if using fromX/fromY/toX/toY.' },
        width: { type: 'number', description: 'Width in pixels (default: 120). Not needed for lines.' },
        height: { type: 'number', description: 'Height in pixels (default: 120). Not needed for lines.' },
        color: { type: 'string', description: 'Fill color as hex string (default: #dbeafe)' },
        strokeColor: { type: 'string', description: 'Stroke/outline color as hex string (default: #4f46e5)' },
        borderColor: { type: 'string', description: 'Border color as hex string (default: transparent)' },
        fromX: { type: 'number', description: 'Line start X coordinate. Use this for lines instead of x/width/rotation.' },
        fromY: { type: 'number', description: 'Line start Y coordinate.' },
        toX: { type: 'number', description: 'Line end X coordinate.' },
        toY: { type: 'number', description: 'Line end Y coordinate.' },
        parentId: { type: 'string', description: 'ID of a frame to attach this shape to.' },
      },
      required: ['shapeType'],
    },
  },
  {
    name: 'createFrame',
    description: 'Create a frame (grouping container) on the whiteboard. Returns the frame ID - save this to use as parentId when creating children. Frames visually group objects and can be nested inside other frames.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title text displayed on the frame' },
        x: { type: 'number', description: 'X position in ABSOLUTE coordinates (default: 0)' },
        y: { type: 'number', description: 'Y position in ABSOLUTE coordinates (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 400)' },
        height: { type: 'number', description: 'Height in pixels (default: 300)' },
        parentId: { type: 'string', description: 'ID of a parent frame to nest this frame inside.' },
      },
      required: ['title'],
    },
  },
  {
    name: 'createSticker',
    description: 'Create an emoji sticker on the whiteboard. Stickers are single emoji that can be placed and resized. Returns the created object ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        emoji: { type: 'string', description: 'A single emoji character (e.g., "🎉", "❤️", "👍")' },
        x: { type: 'number', description: 'X position on the canvas in ABSOLUTE coordinates (default: 0)' },
        y: { type: 'number', description: 'Y position on the canvas in ABSOLUTE coordinates (default: 0)' },
        size: { type: 'number', description: 'Size in pixels (default: 100)' },
        parentId: { type: 'string', description: 'ID of a frame to attach this sticker to.' },
      },
      required: ['emoji'],
    },
  },
  {
    name: 'createConnector',
    description: 'Create a connector line between two existing objects on the board. Supports line styles, arrows, and custom colors.',
    input_schema: {
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
      },
      required: ['fromId', 'toId'],
    },
  },
  {
    name: 'moveObject',
    description: 'Move an existing object to a new position.',
    input_schema: {
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
    input_schema: {
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
    description: 'Update the text content of a sticky note.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the sticky note to update' },
        newText: { type: 'string', description: 'New text content' },
      },
      required: ['objectId', 'newText'],
    },
  },
  {
    name: 'changeColor',
    description: 'Change colors of an existing object. For sticky notes: color (background), textColor, borderColor. For shapes: color (fill), strokeColor, borderColor. For connectors: color. Provide only the color properties you want to change.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to recolor' },
        newColor: { type: 'string', description: 'New background/fill color as hex string' },
        textColor: { type: 'string', description: 'New text color (sticky notes only)' },
        strokeColor: { type: 'string', description: 'New stroke/outline color (shapes only)' },
        borderColor: { type: 'string', description: 'New border color (sticky notes and shapes)' },
      },
      required: ['objectId'],
    },
  },
  {
    name: 'deleteObject',
    description: 'Delete an existing object from the board.',
    input_schema: {
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
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object whose parent you want to change' },
        newParentId: { type: 'string', description: 'ID of the new parent frame, or empty string ("") to make object independent' },
      },
      required: ['objectId', 'newParentId'],
    },
  },
  {
    name: 'alignObjects',
    description: 'Align multiple objects along a specified axis. Useful for organizing layouts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Array of object IDs to align' },
        alignment: { type: 'string', enum: ['left', 'right', 'top', 'bottom', 'center-horizontal', 'center-vertical'], description: 'Alignment direction' },
      },
      required: ['objectIds', 'alignment'],
    },
  },
  {
    name: 'arrangeInGrid',
    description: 'Arrange objects in a grid pattern with specified columns and spacing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectIds: { type: 'array', items: { type: 'string' }, description: 'Array of object IDs to arrange' },
        columns: { type: 'number', description: 'Number of columns in the grid' },
        spacing: { type: 'number', description: 'Spacing between objects in pixels (default: 20)' },
        startX: { type: 'number', description: 'Starting X position (default: 0)' },
        startY: { type: 'number', description: 'Starting Y position (default: 0)' },
      },
      required: ['objectIds', 'columns'],
    },
  },
  {
    name: 'duplicateObject',
    description: 'Duplicate an object one or more times with optional offset.',
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    input_schema: {
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
    name: 'getBoardState',
    description: 'Get the current state of all objects on the board. Use this to understand what is already on the board before manipulating existing objects.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
  },
];

// ---- System prompt ----

const SYSTEM_PROMPT = `You are an AI assistant for Flow Space, a collaborative whiteboard application.

You can create and manipulate objects on the whiteboard using the provided tools.

## Available Object Types
- **Sticky Notes**: Text notes with customizable background color, text color, and border color. Default size: 200x200px.
  - color: background color (default: #fef9c3)
  - textColor: text color (default: #1e293b) — use for contrast against background
  - borderColor: border color (default: transparent)
- **Shapes**: Many shape types available. Default size: 120x120px.
  - shapeType options: rect, circle, triangle, diamond, pentagon, hexagon, octagon, star, arrow, cross, line
  - color: fill color (default: #dbeafe)
  - strokeColor: stroke/outline color (default: #4f46e5)
  - borderColor: border color (default: transparent)
- **Stickers**: Single emoji characters that can be placed and resized. Default size: 150x150px. Use any emoji like 🎉, ❤️, 👍, 🚀, etc.
- **Lines**: Created via createShape with shapeType "line". Use fromX/fromY/toX/toY to specify start and end points — the server automatically computes position, length, and rotation.
  - Example: Horizontal line from (100, 200) to (300, 200): fromX=100, fromY=200, toX=300, toY=200
  - Example: Vertical line from (200, 100) to (200, 300): fromX=200, fromY=100, toX=200, toY=300
  - Example: Diagonal line: fromX=100, fromY=100, toX=300, toY=300
- **Frames**: Grouping containers with titles. Default size: 400x300px.
- **Connectors**: Lines connecting two objects with full styling options.
  - style: "straight" or "curved" (connector path shape)
  - lineType: "solid", "dashed", or "dotted" (default: solid)
  - startArrow: true/false — show arrowhead at source end (default: false)
  - endArrow: true/false — show arrowhead at target end (default: false)
  - strokeWidth: line thickness in pixels (default: 2)
  - color: connector color as hex string (default: #6366f1)

## Coordinate System
- The canvas is infinite and scrollable.
- X increases to the right, Y increases downward.
- (0, 0) is approximately the top-left of the initial viewport.
- The visible viewport is roughly 1200x800px centered around the origin.

## Frame Containment (Parent-Child Relationships)
- **CRITICAL: Objects MUST have parentId set to attach to frames.**
  - Without parentId, objects are independent and won't move with the frame!
  - To make a sticky note or shape a child of a frame, you MUST set the \`parentId\` parameter to the frame's ID.
- When an object has a parentId, it becomes a child of that frame — it moves with the frame when dragged, and inherits the frame's rotation.
- **Workflow: ALWAYS create the frame first, get its ID from the tool response, then create children with that ID as parentId.**
  - Step 1: Call createFrame, receive { "id": "frame-abc123", "type": "frame" }
  - Step 2: Call createStickyNote with parentId: "frame-abc123"
  - Step 3: Call createStickyNote again with parentId: "frame-abc123" for more children
- **CRITICAL: All coordinates are ABSOLUTE canvas positions, NOT relative to the parent frame.**
  - To position a child inside a frame at (frameX, frameY) with size (frameW, frameH):
    - Child x must be: frameX + margin (e.g., frameX + 20)
    - Child y must be: frameY + margin + titleBarHeight (e.g., frameY + 60, accounting for 36px title bar)
    - Ensure: frameX ≤ childX ≤ frameX + frameW - childWidth
    - Ensure: frameY + titleBarHeight ≤ childY ≤ frameY + frameH - childHeight
  - Example: Frame at (100, 100, 400×300) → child at (120, 160, parentId: frameId) places it inside
  - Example: Frame at (0, 0, 400×300) → children at (20, 60, parentId: frameId), (240, 60, parentId: frameId)
- Frames can also be nested inside other frames using parentId.

**Example: Creating a frame with children**
  1. createFrame(title: "Ideas", x: 0, y: 0, width: 400, height: 300) → returns {"id": "frame-xyz"}
  2. createStickyNote(text: "Idea 1", x: 20, y: 60, parentId: "frame-xyz")
  3. createStickyNote(text: "Idea 2", x: 240, y: 60, parentId: "frame-xyz")
  Result: Two sticky notes that move with the "Ideas" frame when dragged.

## Layout Guidelines
- When creating multiple objects, space them with 20-40px gaps.
- For templates (e.g., SWOT analysis, retrospective boards):
  - Create frames as quadrants/sections first
  - Then add sticky notes inside each frame at appropriate positions, using parentId to make them children of the frame
  - Use consistent spacing and alignment
- For grids, use consistent row/column spacing (e.g., 220px for sticky notes, 140px for shapes).

## Color Palette (suggested defaults)
Background colors for sticky notes:
- Yellow: #fef9c3, Blue: #dbeafe, Green: #dcfce7
- Pink: #fce7f3, Purple: #f3e8ff, Orange: #ffedd5

Available preset colors (for any color property):
- Black: #000000, Slate: #475569, White: #ffffff
- Red: #ef4444, Orange: #f97316, Yellow: #eab308
- Green: #22c55e, Cyan: #06b6d4, Blue: #3b82f6
- Purple: #8b5cf6, Pink: #ec4899, Brown: #9a3412
- Dark green: #166534, Light blue: #93c5fd

Text colors for sticky notes: default #1e293b (dark), use #ffffff for white text on dark backgrounds.
Shape stroke colors: default #4f46e5 (indigo).
Connector colors: default #6366f1 (indigo).

## Multi-Step Planning
For complex requests (templates, layouts, diagrams), plan your approach before executing:
1. **Analyze**: Break the request into logical steps (e.g., "create 4 frames, then populate each with sticky notes")
2. **Execute sequentially**: Create parent objects (frames) first, then children (sticky notes with parentId), then connectors
3. **Use IDs from prior steps**: When creating children, reference the frame IDs returned from createFrame calls
4. **Verify if needed**: Call getBoardState() after complex operations to confirm the result

Example multi-step flow for "Create a SWOT analysis":
  Step 1: Create 4 frames (Strengths, Weaknesses, Opportunities, Threats) in a 2x2 grid
  Step 2: For each frame, create 2-3 starter sticky notes inside it using the frame's ID as parentId
  Result: 4 frames with children that move together when dragged

## Important
- Always use getBoardState() first if you need to know what's already on the board before manipulating existing objects.
- When asked to arrange or move existing objects, first call getBoardState() to see current positions and IDs.
- You can delete objects with deleteObject() when asked to clear, remove, or clean up.
- Return a brief, helpful text response describing what you did.`;

// ---- Helper: read board state ----

async function readBoardState(boardId: string) {
  const snapshot = await db.collection(`boards/${boardId}/objects`).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
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
  objectId?: string;
  newText?: string;
  newColor?: string;
  parentId?: string;
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
  count?: number;
  offsetX?: number;
  offsetY?: number;
  operation?: string;
  templateType?: string;
}

async function executeTool(
  toolName: string,
  input: ToolInput,
  boardId: string,
  userId: string,
  objectsCreated: string[],
): Promise<string> {
  const objectsRef = db.collection(`boards/${boardId}/objects`);
  const now = Date.now();

  switch (toolName) {
    case 'createStickyNote': {
      const docRef = objectsRef.doc();
      const data: Record<string, unknown> = {
        type: 'sticky',
        text: input.text ?? '',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: 200,
        height: 200,
        color: input.color ?? '#fef9c3',
        textColor: input.textColor ?? '#1e293b',
        borderColor: input.borderColor ?? 'transparent',
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
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
        borderColor: input.borderColor ?? 'transparent',
        rotation: shapeRotation,
        createdBy: userId,
        updatedAt: now,
        parentId: input.parentId ?? '',
      };
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
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'sticker', emoji: input.emoji });
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
      };
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
      await docRef.update({
        parentId: input.newParentId ?? '',
        updatedAt: now,
      });
      return JSON.stringify({ success: true, objectId: input.objectId, newParentId: input.newParentId });
    }

    case 'alignObjects': {
      const ids = input.objectIds ?? [];
      if (ids.length === 0) return JSON.stringify({ error: 'No objects to align' });

      // Fetch all objects
      const objects = await Promise.all(ids.map(id => objectsRef.doc(id).get()));
      const objectData = objects.map((doc, i) => ({ id: ids[i], ...doc.data() as any }));

      // Calculate alignment position
      let targetValue: number;
      switch (input.alignment) {
        case 'left':
          targetValue = Math.min(...objectData.map(o => o.x));
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ x: targetValue, updatedAt: now })));
          break;
        case 'right':
          targetValue = Math.max(...objectData.map(o => o.x + (o.width || 0)));
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ x: targetValue - (o.width || 0), updatedAt: now })));
          break;
        case 'top':
          targetValue = Math.min(...objectData.map(o => o.y));
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ y: targetValue, updatedAt: now })));
          break;
        case 'bottom':
          targetValue = Math.max(...objectData.map(o => o.y + (o.height || 0)));
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ y: targetValue - (o.height || 0), updatedAt: now })));
          break;
        case 'center-horizontal':
          const avgX = objectData.reduce((sum, o) => sum + o.x + (o.width || 0) / 2, 0) / objectData.length;
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ x: avgX - (o.width || 0) / 2, updatedAt: now })));
          break;
        case 'center-vertical':
          const avgY = objectData.reduce((sum, o) => sum + o.y + (o.height || 0) / 2, 0) / objectData.length;
          await Promise.all(objectData.map(o => objectsRef.doc(o.id).update({ y: avgY - (o.height || 0) / 2, updatedAt: now })));
          break;
      }
      return JSON.stringify({ success: true, aligned: ids.length });
    }

    case 'arrangeInGrid': {
      const ids = input.objectIds ?? [];
      const columns = input.columns ?? 3;
      const spacing = input.spacing ?? 20;
      const startX = input.startX ?? 0;
      const startY = input.startY ?? 0;

      if (ids.length === 0) return JSON.stringify({ error: 'No objects to arrange' });

      // Fetch all objects to get their dimensions
      const objects = await Promise.all(ids.map(id => objectsRef.doc(id).get()));
      const objectData = objects.map((doc, i) => ({ id: ids[i], ...doc.data() as any }));

      // Arrange in grid
      const updates = objectData.map((obj, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + col * (spacing + (obj.width || 200));
        const y = startY + row * (spacing + (obj.height || 200));
        return objectsRef.doc(obj.id).update({ x, y, updatedAt: now });
      });

      await Promise.all(updates);
      return JSON.stringify({ success: true, arranged: ids.length });
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
          // Create 2x2 grid of frames
          const frameWidth = 400;
          const frameHeight = 300;
          const gap = 20;
          const titles = ['Strengths', 'Weaknesses', 'Opportunities', 'Threats'];
          const colors = ['#dcfce7', '#fce7f3', '#dbeafe', '#ffedd5'];

          for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const frameRef = objectsRef.doc();
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: startX + col * (frameWidth + gap),
              y: startY + row * (frameHeight + gap),
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
          }
          break;
        }

        case 'kanban': {
          // Create 3 columns
          const frameWidth = 350;
          const frameHeight = 600;
          const gap = 20;
          const titles = ['To Do', 'In Progress', 'Done'];

          for (let i = 0; i < 3; i++) {
            const frameRef = objectsRef.doc();
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: startX + i * (frameWidth + gap),
              y: startY,
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
          }
          break;
        }

        case 'retrospective': {
          // What went well, What didn't, Action items
          const frameWidth = 400;
          const frameHeight = 500;
          const gap = 20;
          const titles = ['What Went Well 😊', 'What Didn\'t Go Well 😞', 'Action Items 🎯'];

          for (let i = 0; i < 3; i++) {
            const frameRef = objectsRef.doc();
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: startX + i * (frameWidth + gap),
              y: startY,
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
          }
          break;
        }

        case 'eisenhower': {
          // Urgent/Important matrix
          const frameWidth = 400;
          const frameHeight = 300;
          const gap = 20;
          const titles = ['Urgent & Important', 'Not Urgent & Important', 'Urgent & Not Important', 'Neither'];

          for (let i = 0; i < 4; i++) {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const frameRef = objectsRef.doc();
            const frameData = {
              type: 'frame',
              title: titles[i],
              x: startX + col * (frameWidth + gap),
              y: startY + row * (frameHeight + gap),
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

    case 'getBoardState': {
      const objects = await readBoardState(boardId);
      return JSON.stringify({ objects });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ---- Firestore-triggered Cloud Function ----
// Client writes to boards/{boardId}/aiRequests/{requestId}
// Function processes the prompt and updates the document with the response

export const processAIRequest = onDocumentCreated(
  {
    document: 'boards/{boardId}/aiRequests/{requestId}',
    secrets: [anthropicApiKey, langchainApiKey, langfuseSecretKey, langfusePublicKey, langfuseHost],
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

    const { prompt, userId } = data as { prompt: string; userId: string };

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
    let stepCount = 0;

    // Set LangSmith tracing env vars
    process.env.LANGCHAIN_TRACING_V2 = 'true';
    process.env.LANGCHAIN_API_KEY = langchainApiKey.value();
    process.env.LANGCHAIN_PROJECT = 'FlowSpace';

    // Lazy-load LangChain and Langfuse to avoid deployment timeouts
    const { ChatAnthropic } = await import('@langchain/anthropic');
    const { HumanMessage, SystemMessage, ToolMessage } = await import('@langchain/core/messages');
    const { CallbackHandler } = await import('langfuse-langchain');

    // Create Langfuse callback handler for observability
    const langfuseHandler = new CallbackHandler({
      secretKey: langfuseSecretKey.value(),
      publicKey: langfusePublicKey.value(),
      baseUrl: langfuseHost.value(),
      sessionId: requestId,
      userId: userId,
    });

    try {
      // Read initial board state
      const boardState = await readBoardState(boardId);

      // Create LangChain ChatAnthropic model with tools
      const model = new ChatAnthropic({
        model: 'claude-haiku-4-5-20251001',
        maxTokens: 4096,
        anthropicApiKey: anthropicApiKey.value(),
      });
      const modelWithTools = model.bindTools(tools as never);

      // Build LangChain message array
      const messages: BaseMessage[] = [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(
          `Current board state:\n${JSON.stringify(boardState, null, 2)}\n\nUser request: ${prompt}`,
        ),
      ];

      // Tool execution loop
      let response = await modelWithTools.invoke(messages, {
        callbacks: [langfuseHandler],
      });
      messages.push(response);

      while (response.tool_calls && response.tool_calls.length > 0) {
        const toolCalls = response.tool_calls;

        for (let i = 0; i < toolCalls.length; i++) {
          const toolCall = toolCalls[i];
          stepCount++;

          // Build a human-readable progress label
          const toolLabel: Record<string, string> = {
            createStickyNote: 'Creating sticky note',
            createShape: 'Creating shape',
            createFrame: 'Creating frame',
            createSticker: 'Creating sticker',
            createConnector: 'Creating connector',
            moveObject: 'Moving object',
            resizeObject: 'Resizing object',
            updateText: 'Updating text',
            changeColor: 'Changing color',
            deleteObject: 'Deleting object',
            updateParent: 'Changing parent relationship',
            alignObjects: 'Aligning objects',
            arrangeInGrid: 'Arranging in grid',
            duplicateObject: 'Duplicating object',
            setZIndex: 'Changing layer order',
            rotateObject: 'Rotating object',
            generateFromTemplate: 'Generating template',
            getBoardState: 'Reading board',
          };
          const label = toolLabel[toolCall.name] || toolCall.name;
          const batchInfo =
            toolCalls.length > 1
              ? ` (${i + 1}/${toolCalls.length})`
              : '';
          await requestRef.update({
            progress: `Step ${stepCount}: ${label}${batchInfo}...`,
            objectsCreated,
          });

          const result = await executeTool(
            toolCall.name,
            toolCall.args as ToolInput,
            boardId,
            userId,
            objectsCreated,
          );

          messages.push(
            new ToolMessage({
              content: result,
              tool_call_id: toolCall.id ?? '',
            }),
          );
        }

        response = await modelWithTools.invoke(messages, {
          callbacks: [langfuseHandler],
        });
        messages.push(response);
      }

      // Extract final text response
      const responseText =
        typeof response.content === 'string'
          ? response.content
          : Array.isArray(response.content)
            ? response.content
                .filter(
                  (b): b is { type: 'text'; text: string } =>
                    typeof b === 'object' && 'type' in b && b.type === 'text',
                )
                .map((b) => b.text)
                .join('\n') || 'Done!'
            : 'Done!';

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
      await langfuseHandler.flushAsync();
    }
  },
);
