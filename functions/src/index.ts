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
    description: 'Create a sticky note on the whiteboard. Returns the created object ID.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The text content of the sticky note' },
        x: { type: 'number', description: 'X position on the canvas (default: 0)' },
        y: { type: 'number', description: 'Y position on the canvas (default: 0)' },
        color: { type: 'string', description: 'Background color as hex string (default: #fef9c3)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'createShape',
    description: 'Create a shape (rectangle, circle, or line) on the whiteboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        shapeType: { type: 'string', enum: ['rect', 'circle', 'line'], description: 'The type of shape' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 120)' },
        height: { type: 'number', description: 'Height in pixels (default: 120)' },
        color: { type: 'string', description: 'Fill color as hex string (default: #dbeafe)' },
      },
      required: ['shapeType'],
    },
  },
  {
    name: 'createFrame',
    description: 'Create a frame (grouping container) on the whiteboard. Frames visually group objects.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title text displayed on the frame' },
        x: { type: 'number', description: 'X position (default: 0)' },
        y: { type: 'number', description: 'Y position (default: 0)' },
        width: { type: 'number', description: 'Width in pixels (default: 400)' },
        height: { type: 'number', description: 'Height in pixels (default: 300)' },
      },
      required: ['title'],
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
- **Shapes**: Rectangles, circles, and lines. Default size: 120x120px.
- **Frames**: Grouping containers with titles. Default size: 400x300px.
- **Connectors**: Lines connecting two objects. Styles: straight or curved.

## Coordinate System
- The canvas is infinite and scrollable.
- X increases to the right, Y increases downward.
- (0, 0) is approximately the top-left of the initial viewport.
- The visible viewport is roughly 1200x800px centered around the origin.

## Layout Guidelines
- When creating multiple objects, space them with 20-40px gaps.
- For templates (e.g., SWOT analysis, retrospective boards):
  - Create frames as quadrants/sections first
  - Then add sticky notes inside each frame at appropriate positions
  - Use consistent spacing and alignment
- For grids, use consistent row/column spacing (e.g., 220px for sticky notes, 140px for shapes).

## Color Palette (suggested defaults)
- Yellow sticky: #fef9c3
- Blue sticky: #dbeafe
- Green sticky: #dcfce7
- Pink sticky: #fce7f3
- Purple sticky: #f3e8ff
- Orange sticky: #ffedd5

## Important
- Always use getBoardState() first if you need to know what's already on the board before manipulating existing objects.
- When asked to arrange or move existing objects, first call getBoardState() to see current positions and IDs.
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
  title?: string;
  fromId?: string;
  toId?: string;
  style?: string;
  objectId?: string;
  newText?: string;
  newColor?: string;
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
      const data = {
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
      };
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'sticky' });
    }

    case 'createShape': {
      const docRef = objectsRef.doc();
      const data = {
        type: 'shape',
        shapeType: input.shapeType ?? 'rect',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 120,
        height: input.height ?? 120,
        color: input.color ?? '#dbeafe',
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
      };
      await docRef.set(data);
      objectsCreated.push(docRef.id);
      return JSON.stringify({ id: docRef.id, type: 'shape' });
    }

    case 'createFrame': {
      const docRef = objectsRef.doc();
      const data = {
        type: 'frame',
        title: input.title ?? 'Frame',
        x: input.x ?? 0,
        y: input.y ?? 0,
        width: input.width ?? 400,
        height: input.height ?? 300,
        rotation: 0,
        createdBy: userId,
        updatedAt: now,
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
    await requestRef.update({ status: 'processing' });

    const objectsCreated: string[] = [];

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
        model: 'claude-sonnet-4-5-20250929',
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
        for (const block of response.content) {
          if (block.type === 'tool_use') {
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
          model: 'claude-sonnet-4-5-20250929',
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
