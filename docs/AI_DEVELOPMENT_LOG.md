# AI Development Log

A living document tracking the development, testing, and refinement of the CollabBoard AI agent powered by Claude Sonnet 4.5.

---

## Overview

**AI Model**: Anthropic Claude Sonnet 4.5
**Integration**: Firebase Cloud Functions v2
**Primary Use Case**: Natural language commands for board manipulation
**Status**: 🔴 Not Started

---

## Development Timeline

### Phase 1: Foundation (Not Started)
**Goal**: Basic AI agent infrastructure and simple commands

**Planned Features**:
- [ ] Cloud Function endpoint setup (`POST /aiAgent`)
- [ ] Claude API integration with function calling
- [ ] Basic tool: `createStickyNote`
- [ ] Basic tool: `deleteObject`
- [ ] Error handling and validation
- [ ] Authentication integration

**Target Date**: TBD

---

### Phase 2: Enhanced Commands (Not Started)
**Goal**: Multi-step operations and advanced object manipulation

**Planned Features**:
- [ ] Tool: `moveObject`
- [ ] Tool: `updateText`
- [ ] Tool: `createShape`
- [ ] Tool: `createConnector`
- [ ] Multi-step command support (e.g., "Create 3 sticky notes in a row")
- [ ] Context awareness (e.g., "Move the yellow sticky note to the right")

**Target Date**: TBD

---

### Phase 3: Intelligent Assistance (Not Started)
**Goal**: AI understands board context and suggests improvements

**Planned Features**:
- [ ] Tool: `createDiagram` (auto-layout)
- [ ] Tool: `organizeBoard` (auto-arrange objects)
- [ ] Tool: `summarizeBoard` (generate summary of board contents)
- [ ] Vision integration (analyze board screenshots)
- [ ] Proactive suggestions

**Target Date**: TBD

---

## Tool Definitions

### Tool: createStickyNote

**Status**: 🔴 Not Implemented

**Purpose**: Create a sticky note with specified text, color, and position.

**Schema**:
```json
{
  "name": "createStickyNote",
  "description": "Creates a new sticky note on the whiteboard",
  "input_schema": {
    "type": "object",
    "properties": {
      "text": {
        "type": "string",
        "description": "The text content of the sticky note"
      },
      "x": {
        "type": "number",
        "description": "X coordinate (0-1000, default: 200)"
      },
      "y": {
        "type": "number",
        "description": "Y coordinate (0-1000, default: 200)"
      },
      "color": {
        "type": "string",
        "enum": ["#fef08a", "#fde68a", "#bbf7d0", "#bfdbfe", "#e9d5ff", "#fecaca"],
        "description": "Sticky note color (default: random)"
      }
    },
    "required": ["text"]
  }
}
```

**Implementation**:
```typescript
// functions/src/tools/createStickyNote.ts
async function createStickyNote(boardId: string, params: {
  text: string
  x?: number
  y?: number
  color?: string
}) {
  const note: StickyNote = {
    id: crypto.randomUUID(),
    type: 'sticky',
    x: params.x ?? 200,
    y: params.y ?? 200,
    width: 200,
    height: 200,
    rotation: 0,
    createdBy: 'ai-agent',
    updatedAt: Date.now(),
    text: params.text,
    color: params.color ?? getRandomColor()
  }

  await admin.firestore()
    .collection('boards')
    .doc(boardId)
    .collection('objects')
    .doc(note.id)
    .set(note)

  return { success: true, objectId: note.id }
}
```

**Test Cases**:
- [ ] Create sticky note with text only (defaults for position/color)
- [ ] Create sticky note with custom position
- [ ] Create sticky note with custom color
- [ ] Handle invalid color value
- [ ] Handle missing required `text` parameter

**Example Prompts**:
- "Create a sticky note that says 'TODO: Review designs'"
- "Add a yellow sticky note at position 300, 400 with text 'Meeting notes'"
- "Make 3 sticky notes with the action items from our discussion"

---

### Tool: deleteObject

**Status**: 🔴 Not Implemented

**Purpose**: Delete an object from the board by ID or description.

**Schema**:
```json
{
  "name": "deleteObject",
  "description": "Deletes an object from the whiteboard",
  "input_schema": {
    "type": "object",
    "properties": {
      "objectId": {
        "type": "string",
        "description": "The unique ID of the object to delete"
      }
    },
    "required": ["objectId"]
  }
}
```

**Implementation**:
```typescript
// functions/src/tools/deleteObject.ts
async function deleteObject(boardId: string, params: { objectId: string }) {
  await admin.firestore()
    .collection('boards')
    .doc(boardId)
    .collection('objects')
    .doc(params.objectId)
    .delete()

  return { success: true, objectId: params.objectId }
}
```

**Test Cases**:
- [ ] Delete existing object by ID
- [ ] Handle non-existent object ID gracefully
- [ ] Auto-delete connected connectors
- [ ] Verify deletion triggers real-time update

**Example Prompts**:
- "Delete the sticky note with ID abc-123"
- "Remove all empty sticky notes"
- "Clear the board" (requires multi-step: fetch all objects → delete each)

---

### Tool: moveObject

**Status**: 🔴 Not Implemented

**Purpose**: Move an object to a new position.

**Schema**:
```json
{
  "name": "moveObject",
  "description": "Moves an object to a new position on the whiteboard",
  "input_schema": {
    "type": "object",
    "properties": {
      "objectId": {
        "type": "string",
        "description": "The unique ID of the object to move"
      },
      "x": {
        "type": "number",
        "description": "New X coordinate"
      },
      "y": {
        "type": "number",
        "description": "New Y coordinate"
      }
    },
    "required": ["objectId", "x", "y"]
  }
}
```

**Test Cases**:
- [ ] Move object to new position
- [ ] Handle out-of-bounds coordinates
- [ ] Verify real-time sync to all clients

**Example Prompts**:
- "Move the yellow sticky note to the top left"
- "Arrange the sticky notes in a grid"

---

### Tool: updateText

**Status**: 🔴 Not Implemented

**Purpose**: Update the text content of a sticky note or frame title.

**Schema**:
```json
{
  "name": "updateText",
  "description": "Updates the text content of a sticky note or frame title",
  "input_schema": {
    "type": "object",
    "properties": {
      "objectId": {
        "type": "string",
        "description": "The unique ID of the object to update"
      },
      "text": {
        "type": "string",
        "description": "The new text content"
      }
    },
    "required": ["objectId", "text"]
  }
}
```

**Test Cases**:
- [ ] Update sticky note text
- [ ] Update frame title
- [ ] Handle non-text objects gracefully

**Example Prompts**:
- "Change the sticky note text to 'Updated task'"
- "Add 'COMPLETED' to the beginning of this note"

---

### Tool: createDiagram (Future)

**Status**: 🔴 Not Planned Yet

**Purpose**: Generate complex diagrams from natural language descriptions.

**Example Prompts**:
- "Create a flowchart showing our deployment process"
- "Make a Kanban board with TODO, In Progress, and Done columns"
- "Draw a system architecture diagram with frontend, backend, and database"

**Implementation Notes**:
- Requires multi-step orchestration (create frames, sticky notes, connectors)
- May need layout algorithm (force-directed graph, hierarchical, etc.)
- Consider using Claude's chain-of-thought for complex layouts

---

## AI Prompt Engineering

### System Prompt (v1.0)

```
You are an AI assistant integrated into CollabBoard, a collaborative whiteboard application.
You help users create, organize, and manipulate objects on the whiteboard using natural language commands.

Available objects:
- Sticky notes: Small text boxes with color backgrounds
- Shapes: Rectangles, circles, and lines
- Frames: Containers that group other objects
- Stickers: Emoji decorations
- Connectors: Lines that connect two objects

When the user gives a command, use the available tools to execute it. If a command requires multiple steps, break it down and execute each tool call sequentially.

If the user's request is ambiguous, ask clarifying questions before executing.

Always confirm successful operations with a brief, friendly message.
```

**Version History**:
- v1.0 (TBD): Initial system prompt

---

### Prompt Examples & Expected Behavior

#### Example 1: Simple Creation
**User**: "Create a sticky note that says 'Meeting at 3pm'"

**Expected Tool Calls**:
```json
{
  "tool": "createStickyNote",
  "input": {
    "text": "Meeting at 3pm"
  }
}
```

**Expected Response**: "I've created a sticky note with 'Meeting at 3pm'."

---

#### Example 2: Multi-Step Operation
**User**: "Create 3 sticky notes with TODO, IN PROGRESS, and DONE"

**Expected Tool Calls**:
```json
[
  {
    "tool": "createStickyNote",
    "input": { "text": "TODO", "x": 100, "y": 200 }
  },
  {
    "tool": "createStickyNote",
    "input": { "text": "IN PROGRESS", "x": 350, "y": 200 }
  },
  {
    "tool": "createStickyNote",
    "input": { "text": "DONE", "x": 600, "y": 200 }
  }
]
```

**Expected Response**: "I've created 3 sticky notes arranged horizontally: TODO, IN PROGRESS, and DONE."

---

#### Example 3: Context-Aware Operation
**User**: "Move the yellow sticky note to the right"

**Expected Behavior**:
1. AI needs to query board state (fetch all objects)
2. Identify yellow sticky notes
3. If multiple, ask for clarification or pick the first
4. Calculate new position (current x + offset)
5. Call `moveObject` tool

**Expected Response**: "I've moved the yellow sticky note to the right."

**Challenge**: How does AI query board state? Options:
- **Option A**: Add `getBoardState` tool that returns all objects
- **Option B**: Pass current board state in request payload
- **Option C**: AI requests board state via special tool, then proceeds

**Decision**: TBD

---

## Testing Strategy

### Unit Tests

**Location**: `functions/src/tools/*.test.ts`

**Test Framework**: Vitest + firebase-functions-test

**Example**:
```typescript
// functions/src/tools/createStickyNote.test.ts
import { createStickyNote } from './createStickyNote'
import { initializeTestEnvironment } from '@firebase/rules-unit-testing'

describe('createStickyNote', () => {
  it('creates sticky note with text only', async () => {
    const result = await createStickyNote('test-board', {
      text: 'Hello world'
    })

    expect(result.success).toBe(true)
    expect(result.objectId).toBeDefined()

    // Verify Firestore write
    const doc = await firestore
      .collection('boards/test-board/objects')
      .doc(result.objectId)
      .get()

    expect(doc.exists).toBe(true)
    expect(doc.data().text).toBe('Hello world')
  })
})
```

---

### Integration Tests

**Test Cloud Function end-to-end with mock Claude API**:

```typescript
// functions/src/aiAgent.test.ts
describe('aiAgent', () => {
  it('creates sticky note from natural language', async () => {
    // Mock Claude API response
    mockClaude.mockReturnValue({
      content: "I've created a sticky note.",
      tool_calls: [{
        name: 'createStickyNote',
        input: { text: 'TODO: Review PR' }
      }]
    })

    const response = await request(app)
      .post('/aiAgent')
      .send({
        boardId: 'test-board',
        prompt: 'Create a sticky note that says TODO: Review PR'
      })

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })
})
```

---

### E2E Tests (Manual)

**Test with real Claude API and Firestore Emulators**:

1. Start Firebase Emulators: `firebase emulators:start`
2. Deploy function locally: `npm run serve` (in functions/)
3. Send test request:
   ```bash
   curl -X POST http://localhost:5001/PROJECT_ID/us-central1/aiAgent \
     -H "Content-Type: application/json" \
     -d '{
       "boardId": "test-board",
       "prompt": "Create a sticky note that says Hello AI"
     }'
   ```
4. Verify sticky note appears in Emulator UI
5. Open frontend connected to emulators, verify real-time sync

---

## Performance & Monitoring

### Latency Targets

| Operation | Target | Notes |
|-----------|--------|-------|
| **AI response time** | <3s | Cold start excluded |
| **Tool execution** | <500ms | Per tool call |
| **End-to-end** | <5s | Prompt → visible on board |

### Monitoring Metrics (Firebase Console)

- **Invocations**: Total AI agent calls
- **Execution time**: P50, P95, P99
- **Errors**: 4xx (client), 5xx (server)
- **Cold starts**: Function initialization time

### Logging Strategy

**Structured logs with Google Cloud Logging**:

```typescript
import { logger } from 'firebase-functions/v2'

logger.info('AI agent invoked', {
  boardId,
  prompt: prompt.substring(0, 100), // Truncate for privacy
  userId
})

logger.info('Tool executed', {
  tool: 'createStickyNote',
  params: { text: '...' },
  duration: 123 // ms
})

logger.error('Tool execution failed', {
  tool: 'deleteObject',
  error: error.message
})
```

---

## Known Issues & Limitations

### Issue 1: No Board State Query (Not Implemented)
**Problem**: AI cannot query current board state (e.g., "Move the yellow sticky note to the right").

**Workaround**: Pass board state in request payload (increases payload size).

**Long-term Fix**: Implement `getBoardState` tool.

---

### Issue 2: Rate Limiting (Not Implemented)
**Problem**: Users could spam AI agent, incurring high costs.

**Mitigation**:
- Implement rate limiting (e.g., 10 requests/min per user)
- Firebase App Check for bot prevention
- Cost alerts in GCP

---

### Issue 3: Authentication (Not Implemented)
**Problem**: AI agent needs to verify user is authenticated.

**Solution**: Validate Firebase Auth token in Cloud Function:
```typescript
const token = req.headers.authorization?.split('Bearer ')[1]
const decodedToken = await admin.auth().verifyIdToken(token)
const userId = decodedToken.uid
```

---

## Changelog

### [Unreleased]
- Initial template created

---

## Notes & Learnings

### [2026-02-16 Evening] Presence & Cursor Timeout Systems

**Task:** Fix issue where inactive users and their cursors remained visible after closing tabs or navigating away.

**Approach:**
- Implemented heartbeat system for presence tracking (5s interval, 15s timeout)
- Implemented timestamp-based filtering for cursor timeout (3s timeout)
- Added client-side stale data filtering instead of relying solely on Firebase onDisconnect
- Created comprehensive test coverage for both systems

**Changes:**
- `src/hooks/usePresence.ts` - Added HEARTBEAT_INTERVAL (5s) and PRESENCE_TIMEOUT (15s) constants, implemented heartbeat with setInterval, added client-side filtering of stale users
- `src/hooks/usePresence.test.ts` - Added tests for heartbeat, timeout, and stale user filtering
- `src/hooks/useCursors.ts` - Added CURSOR_TIMEOUT (3s), implemented timestamp-based filtering, added onDisconnect handler, cleanup on unmount
- `src/hooks/useCursors.test.ts` - Added tests for cursor timeout and stale cursor filtering
- `docs/PRESENCE_HEARTBEAT.md` - Created comprehensive documentation explaining both systems
- `src/utils/authErrors.ts` - Created Firebase auth error translation utility
- `src/utils/authErrors.test.ts` - Added test coverage for error message translation
- `src/components/Auth/AuthPanel.tsx` - Updated to use user-friendly error messages
- `CLAUDE.md` - Added documentation requirements section

**Challenges:**
- **Problem**: Firebase onDisconnect() is not reliable for all exit scenarios (tab close, browser crash, network loss)
- **Solution**: Implemented dual approach - onDisconnect for graceful exits + client-side timeout filtering for ungraceful exits
- **Problem**: Different timeout requirements for presence (15s) vs cursors (3s)
- **Solution**: Presence uses longer timeout (tolerates network hiccups), cursors use shorter timeout (better UX when users stop moving)

**Testing:**
- Unit tests with vitest fake timers to verify heartbeat intervals and timeout logic
- Manual testing: Opened 2+ browser windows, verified users disappear within timeout periods after closing tabs

**Commits:**
- [95af9a0] Add user-friendly Firebase auth error messages
- [4b5b2c0] Add heartbeat system for presence tracking to remove inactive users
- [8e7b27e] Add cursor timeout system to remove stale cursors from inactive users
- [eaacac0] Add playful UI styling and improve visual design

**Cost Impact:**
- Presence heartbeat: ~12 RTDB writes/min per user (~$0.037 per 100 users per hour)
- Cursors: Movement-based, no additional writes (already had timestamps)
- Very cost-efficient for real-time presence tracking

### 2026-02-16: Template Creation
- Created AI development log structure
- Defined initial tool set (createStickyNote, deleteObject, moveObject, updateText)
- Established testing strategy (unit, integration, E2E)
- Set performance targets (<3s response, <5s end-to-end)
- Identified key challenges (board state query, rate limiting, auth)

---

## Next Steps

1. Set up Cloud Functions project structure
2. Implement `createStickyNote` tool with tests (TDD)
3. Integrate Claude API with function calling
4. Deploy to Firebase and test with emulators
5. Add authentication validation
6. Implement rate limiting
7. Monitor costs and optimize

---

**Last Updated**: 2026-02-16
**Document Owner**: Development Team
**Status**: Living Document - Update after each AI development session
