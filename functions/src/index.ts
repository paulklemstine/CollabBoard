import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const anthropicApiKey = defineSecret('ANTHROPIC_API_KEY');

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
        parentId: { type: 'string', description: 'CRITICAL: ID of a frame to attach this sticky note to. Without this, the note will NOT move with any frame. Get the frame ID from the createFrame response.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape (rectangle, circle, or line) on the whiteboard. For lines, use fromX/fromY/toX/toY to specify endpoints — the server computes position, length, and rotation automatically.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shapeType: { type: 'string', enum: ['rect', 'circle', 'line'], description: 'The type of shape' },
        x: { type: 'number', description: 'X position (for rect/circle). Not needed for lines if using fromX/fromY/toX/toY.' },
        y: { type: 'number', description: 'Y position (for rect/circle). Not needed for lines if using fromX/fromY/toX/toY.' },
        width: { type: 'number', description: 'Width in pixels (for rect/circle, default: 120). Not needed for lines.' },
        height: { type: 'number', description: 'Height in pixels (for rect/circle, default: 120). Not needed for lines.' },
        color: { type: 'string', description: 'Fill/stroke color as hex string (default: #dbeafe)' },
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
    description: 'Create a connector line between two existing objects on the board.',
    input_schema: {
      type: 'object' as const,
      properties: {
        fromId: { type: 'string', description: 'ID of the source object' },
        toId: { type: 'string', description: 'ID of the target object' },
        style: { type: 'string', enum: ['straight', 'curved'], description: 'Connector style (default: straight)' },
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
    description: 'Change the color of an existing object (sticky note or shape).',
    input_schema: {
      type: 'object' as const,
      properties: {
        objectId: { type: 'string', description: 'ID of the object to recolor' },
        newColor: { type: 'string', description: 'New color as hex string' },
      },
      required: ['objectId', 'newColor'],
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

const SYSTEM_PROMPT = `You are an AI assistant for CollabBoard, a collaborative whiteboard application.

You can create and manipulate objects on the whiteboard using the provided tools.

## Available Object Types
- **Sticky Notes**: Text notes with customizable colors. Default size: 200x200px.
- **Shapes**: Rectangles and circles. Default size: 120x120px.
- **Stickers**: Single emoji characters that can be placed and resized. Default size: 150x150px. Use any emoji like 🎉, ❤️, 👍, 🚀, etc.
- **Lines**: Created via createShape with shapeType "line". Use fromX/fromY/toX/toY to specify start and end points — the server automatically computes position, length, and rotation.
  - Example: Horizontal line from (100, 200) to (300, 200): fromX=100, fromY=200, toX=300, toY=200
  - Example: Vertical line from (200, 100) to (200, 300): fromX=200, fromY=100, toX=200, toY=300
  - Example: Diagonal line: fromX=100, fromY=100, toX=300, toY=300
- **Frames**: Grouping containers with titles. Default size: 400x300px.
- **Connectors**: Lines connecting two objects. Styles: straight or curved.

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
- Yellow sticky: #fef9c3
- Blue sticky: #dbeafe
- Green sticky: #dcfce7
- Pink sticky: #fce7f3
- Purple sticky: #f3e8ff
- Orange sticky: #ffedd5

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
  shapeType?: string;
  width?: number;
  height?: number;
  size?: number;
  emoji?: string;
  title?: string;
  fromId?: string;
  toId?: string;
  style?: string;
  objectId?: string;
  newText?: string;
  newColor?: string;
  parentId?: string;
  rotation?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
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
      const data = {
        type: 'connector',
        fromId: input.fromId,
        toId: input.toId,
        style: input.style ?? 'straight',
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
      await docRef.update({
        color: input.newColor,
        updatedAt: now,
      });
      return JSON.stringify({ success: true });
    }

    case 'deleteObject': {
      const docRef = objectsRef.doc(input.objectId!);
      await docRef.delete();
      return JSON.stringify({ success: true });
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
    secrets: [anthropicApiKey],
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

    try {
      // Read initial board state
      const boardState = await readBoardState(boardId);

      // Lazy-load Anthropic SDK
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: anthropicApiKey.value() });

      // Message types
      interface AnthropicMessage {
        role: 'user' | 'assistant';
        content: string | AnthropicContentBlock[];
      }

      interface AnthropicContentBlock {
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: unknown;
        tool_use_id?: string;
        content?: string;
      }

      const messages: AnthropicMessage[] = [
        {
          role: 'user',
          content: `Current board state:\n${JSON.stringify(boardState, null, 2)}\n\nUser request: ${prompt}`,
        },
      ];

      // Tool execution loop
      let response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        tools: tools as never,
        messages: messages as never,
      });

      while (response.stop_reason === 'tool_use') {
        const assistantContent: AnthropicContentBlock[] = response.content
          .filter((block: { type: string }) => block.type === 'text' || block.type === 'tool_use')
          .map((block: { type: string; text?: string; id?: string; name?: string; input?: unknown }) => {
            if (block.type === 'text') {
              return { type: 'text', text: block.text };
            }
            return {
              type: 'tool_use',
              id: block.id,
              name: block.name,
              input: block.input,
            };
          });

        messages.push({ role: 'assistant', content: assistantContent });

        const toolResults: AnthropicContentBlock[] = [];
        const toolUseBlocks = response.content.filter((b: { type: string }) => b.type === 'tool_use');
        for (const block of response.content) {
          if (block.type === 'tool_use') {
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
              getBoardState: 'Reading board',
            };
            const label = toolLabel[block.name] || block.name;
            const batchInfo = toolUseBlocks.length > 1 ? ` (${toolUseBlocks.indexOf(block) + 1}/${toolUseBlocks.length})` : '';
            await requestRef.update({
              progress: `Step ${stepCount}: ${label}${batchInfo}...`,
              objectsCreated,
            });

            const result = await executeTool(
              block.name,
              block.input as ToolInput,
              boardId,
              userId,
              objectsCreated,
            );
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            });
          }
        }

        messages.push({ role: 'user', content: toolResults });

        response = await client.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          tools: tools as never,
          messages: messages as never,
        });
      }

      // Extract final text response
      const textBlocks = response.content.filter((b: { type: string }) => b.type === 'text');
      const responseText = textBlocks.map((b: { type: string; text?: string }) => b.text ?? '').join('\n') || 'Done!';

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
    }
  },
);
