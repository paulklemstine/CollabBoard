# CollabBoard Architecture Overview

A comprehensive technical overview of the CollabBoard real-time collaborative whiteboard application.

## Table of Contents
- [System Overview](#system-overview)
- [Architecture Principles](#architecture-principles)
- [Technology Stack](#technology-stack)
- [Data Architecture](#data-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Real-Time Synchronization](#real-time-synchronization)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)
- [Future Architecture](#future-architecture)

---

## System Overview

CollabBoard is a real-time collaborative whiteboard application that allows multiple users to work together on a shared canvas. The architecture is designed for low-latency updates, conflict-free collaboration, and horizontal scalability.

### Key Design Goals
- **Real-time sync**: Sub-100ms updates for objects, sub-50ms for cursors
- **Conflict resolution**: Last-write-wins at object-level granularity
- **Scalability**: Support 500+ objects and 5+ concurrent users per board
- **Performance**: Maintain 60 FPS during pan/zoom operations
- **Developer experience**: TypeScript strict mode, comprehensive testing, TDD workflow

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                       │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          React App (Vite + TypeScript)                 │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐   │ │
│  │  │ react-konva  │  │ Custom Hooks │  │  Components │   │ │
│  │  │  (Canvas)    │  │  (State Mgmt)│  │   (UI)      │   │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘   │ │
│  └─────────────┬──────────────────────────┬───────────────┘ │
│                │                          │                 │
└────────────────┼──────────────────────────┼─────────────────┘
                 │                          │
                 │ Firebase SDK             │ Firebase SDK
                 │ (WebSocket)              │ (WebSocket)
                 │                          │
    ┌────────────▼──────────┐   ┌──────────▼───────────────┐
    │   Firebase Firestore  │   │  Firebase Realtime DB    │
    │  (Board Objects)      │   │  (Cursors + Presence)    │
    │  • Sticky Notes       │   │  • Cursor positions      │
    │  • Shapes             │   │  • User presence         │
    │  • Frames             │   │  • onDisconnect() hooks  │
    │  • Stickers           │   │  • <50ms latency         │
    │  • Connectors         │   │                          │
    └───────────────────────┘   └──────────────────────────┘
                 │                          │
                 └────────────┬─────────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Firebase Auth     │
                    │  • Google Sign-In  │
                    │  • Anonymous Auth  │
                    └────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Cloud Functions v2 │
                    │  • AI Agent        │
                    │  • Claude API      │
                    │  • Tool Calling    │
                    └────────────────────┘
```

---

## Architecture Principles

### 1. Dual Database Strategy

**Decision**: Use both Firestore and Realtime Database (RTDB) instead of just one.

**Rationale**:
- **Firestore**: Excellent for structured data, complex queries, and automatic persistence
  - Stores board objects (sticky notes, shapes, frames, stickers, connectors)
  - ~100ms latency is acceptable for object updates
  - Strong consistency guarantees
  - Built-in offline support

- **RTDB**: Optimized for ephemeral, high-frequency updates
  - Stores cursor positions and user presence
  - <50ms latency for real-time feel
  - `onDisconnect()` API for automatic cleanup when users leave
  - Simpler data model (JSON tree)

**Trade-offs**:
- ✅ Optimal performance for each use case
- ✅ Automatic presence management with `onDisconnect()`
- ❌ Slightly increased complexity (two databases to manage)
- ❌ Two sets of security rules to maintain

### 2. Client-Side Writes (No REST API)

**Decision**: Clients write directly to Firestore/RTDB, not through a backend API.

**Rationale**:
- Reduces latency (no round-trip through backend server)
- Firebase SDK handles retry logic, offline queuing, and optimistic updates
- Security enforced via Firestore/RTDB security rules
- Simpler architecture (no API server to maintain)

**Security**: All writes are validated by database security rules (see [Security Model](#security-model))

### 3. Last-Write-Wins Conflict Resolution

**Decision**: No operational transforms or CRDTs—simple timestamp-based conflict resolution.

**Rationale**:
- Object-level granularity prevents most conflicts (users rarely edit the same object simultaneously)
- Simplicity over complex merge strategies
- Firestore's `updatedAt` timestamp determines winner
- Good enough for whiteboard use case (unlike text editing)

**Trade-offs**:
- ✅ Simple to implement and reason about
- ✅ Performant (no complex merge logic)
- ❌ Rare conflicts result in lost edits (acceptable for whiteboard)

### 4. Component Co-location

**Decision**: Tests, components, and types are co-located in the same directory.

**Rationale**:
- Easier to find related files
- Encourages TDD (test is right next to source)
- Better discoverability

**Example**:
```
src/components/Board/
  ├── StickyNote.tsx
  ├── StickyNote.test.tsx
  ├── ShapeComponent.tsx
  └── ShapeComponent.test.tsx
```

---

## Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2 | UI framework |
| **TypeScript** | 5.9 | Type safety, strict mode |
| **Vite** | 7.3 | Build tool, dev server, HMR |
| **react-konva** | 19.2 | Canvas rendering (HTML5 Canvas wrapper) |
| **Konva** | 10.2 | Low-level canvas library |
| **Tailwind CSS** | 4.1 | Utility-first styling |
| **Vitest** | 4.0 | Unit/integration testing |
| **@testing-library/react** | 16.3 | Component testing |
| **jest-canvas-mock** | 2.5 | Canvas mocking for tests |

### Backend (Firebase)
| Service | Purpose |
|---------|---------|
| **Firebase Firestore** | Store board objects (sticky notes, shapes, etc.) |
| **Firebase Realtime Database** | Store cursors and user presence |
| **Firebase Auth** | Google sign-in + anonymous auth |
| **Firebase Cloud Functions v2** | AI agent endpoint (Claude integration) |
| **Firebase Hosting** | Static site hosting (SPA deployment) |

### AI Integration
| Technology | Purpose |
|------------|---------|
| **Anthropic Claude Sonnet 4.5** | AI agent for natural language commands |
| **Function Calling** | Tool use for board operations |

---

## Data Architecture

### Firestore Structure

```
firestore/
└── boards/
    └── {boardId}/                    # e.g., "default-board"
        └── objects/                  # subcollection
            ├── {objectId}            # e.g., UUID
            │   ├── id: string
            │   ├── type: "sticky" | "shape" | "frame" | "sticker" | "connector"
            │   ├── x: number
            │   ├── y: number
            │   ├── width: number
            │   ├── height: number
            │   ├── rotation: number
            │   ├── createdBy: string (userId)
            │   ├── updatedAt: number (timestamp)
            │   ├── parentId?: string (for frame containment)
            │   └── ... (type-specific fields)
            └── ...
```

#### Object Types

**StickyNote** (`type: "sticky"`)
```typescript
{
  id: string
  type: "sticky"
  x, y, width, height, rotation: number
  createdBy: string
  updatedAt: number
  parentId?: string
  text: string
  color: string  // e.g., "#fef08a"
}
```

**Shape** (`type: "shape"`)
```typescript
{
  id: string
  type: "shape"
  x, y, width, height, rotation: number
  createdBy: string
  updatedAt: number
  parentId?: string
  shapeType: "rect" | "circle" | "line"
  color: string
}
```

**Frame** (`type: "frame"`)
```typescript
{
  id: string
  type: "frame"
  x, y, width, height, rotation: number
  createdBy: string
  updatedAt: number
  title: string
}
```
Note: Frames cannot be nested (no `parentId`).

**Sticker** (`type: "sticker"`)
```typescript
{
  id: string
  type: "sticker"
  x, y, width, height, rotation: number
  createdBy: string
  updatedAt: number
  parentId?: string
  emoji: string  // e.g., "🎉"
}
```

**Connector** (`type: "connector"`)
```typescript
{
  id: string
  type: "connector"
  x, y, width, height, rotation: number  // Computed, not used
  createdBy: string
  updatedAt: number
  fromId: string  // ID of source object
  toId: string    // ID of target object
  style: "straight" | "curved"
}
```

### Realtime Database Structure

```
rtdb/
└── boards/
    └── {boardId}/
        ├── cursors/
        │   └── {userId}/
        │       ├── userId: string
        │       ├── x: number
        │       ├── y: number
        │       ├── name: string
        │       ├── color: string
        │       └── timestamp: number
        └── presence/
            └── {userId}/
                ├── uid: string
                ├── displayName: string
                ├── email: string
                ├── color: string
                ├── online: boolean
                └── lastSeen: number
```

**Why separate cursors and presence?**
- **Cursors**: Updated ~10x/second (throttled), ephemeral
- **Presence**: Updated on connect/disconnect, persistent until cleanup

---

## Frontend Architecture

### Component Hierarchy

```
App.tsx
├── AuthPanel (top-left)
│   └── Google Sign-In / Anonymous Login
├── BoardView (main content)
│   ├── Board (Konva Stage wrapper)
│   │   ├── FrameComponent (z-index: bottom)
│   │   ├── ConnectorComponent
│   │   ├── ShapeComponent
│   │   ├── StickyNoteComponent
│   │   └── StickerComponent (z-index: top)
│   ├── CursorsOverlay (SVG overlay for cursors)
│   ├── PresencePanel (top-right, online users)
│   └── Toolbar (bottom-center, add objects)
```

### State Management Strategy

**No Redux or Zustand** — Custom hooks manage all state:

1. **useAuth** ([src/hooks/useAuth.ts](src/hooks/useAuth.ts))
   - Listens to Firebase Auth state
   - Returns `{ user, loading }`

2. **useBoard** ([src/hooks/useBoard.ts](src/hooks/useBoard.ts))
   - Subscribes to Firestore `boards/{boardId}/objects`
   - Manages object state (sticky notes, shapes, frames, etc.)
   - Provides CRUD operations: `addStickyNote`, `moveObject`, `updateText`, `removeObject`
   - Handles frame containment logic (parent-child relationships)
   - Manages connector mode state

3. **useCursors** ([src/hooks/useCursors.ts](src/hooks/useCursors.ts))
   - Subscribes to RTDB `boards/{boardId}/cursors`
   - Throttles cursor updates (100ms)
   - Returns `{ cursors, updateCursor }`

4. **usePresence** ([src/hooks/usePresence.ts](src/hooks/usePresence.ts))
   - Subscribes to RTDB `boards/{boardId}/presence`
   - Sets user online on mount, removes on unmount
   - Uses `onDisconnect()` for automatic cleanup
   - Returns `{ onlineUsers }`

### Data Flow Diagram

```
User Interaction
       │
       ▼
┌──────────────┐
│  Component   │ (e.g., StickyNote)
└──────┬───────┘
       │ onDragEnd(id, x, y)
       ▼
┌──────────────┐
│  useBoard    │ (custom hook)
└──────┬───────┘
       │ updateObject(boardId, id, {x, y})
       ▼
┌──────────────┐
│ boardService │ (Firebase wrapper)
└──────┬───────┘
       │ updateDoc(...)
       ▼
┌──────────────┐
│  Firestore   │
└──────┬───────┘
       │ onSnapshot() triggers
       ▼
┌──────────────┐
│  useBoard    │ (all connected clients)
└──────┬───────┘
       │ setObjects([...])
       ▼
┌──────────────┐
│  Component   │ re-renders
└──────────────┘
```

### Rendering Strategy

**react-konva** wraps HTML5 Canvas for high-performance rendering:

- **Stage**: Root canvas element (full viewport)
- **Layer**: Grouping for rendering optimization
- **Shapes**: Rect, Circle, Line, Text, Group, etc.

**Why Konva instead of SVG?**
- ✅ Better performance with 500+ objects
- ✅ Built-in drag-and-drop, transformations
- ✅ Event handling on canvas elements
- ❌ Less accessible than SVG (no DOM nodes)

### Frame Containment System

**Feature**: Objects can be "contained" by frames—when a frame moves, its children move too.

**Implementation** ([src/utils/containment.ts](src/utils/containment.ts)):
1. **findContainingFrame**: Check if object's center is inside a frame's bounding box
2. **getChildrenOfFrame**: Query all objects where `parentId === frameId`
3. **handleFrameDragMove**: Move frame + all children by same delta (dx, dy)
4. **handleDragEnd**: Set `parentId` if object dropped inside a frame

**Visual Feedback**:
- Frame highlights when object is dragged over it (`hoveredFrameId`)

---

## Backend Architecture

### Firebase Services

#### 1. Firestore (Board Objects)

**Service Layer**: [src/services/boardService.ts](src/services/boardService.ts)

```typescript
// CRUD operations
addObject(boardId, obj): Promise<void>
updateObject(boardId, objectId, updates): Promise<void>
deleteObject(boardId, objectId): Promise<void>

// Real-time subscription
subscribeToBoard(boardId, callback): Unsubscribe
```

**Real-time Listener**:
```typescript
onSnapshot(collection(db, 'boards', boardId, 'objects'), (snapshot) => {
  const objects = snapshot.docs.map(d => d.data())
  callback(objects)
})
```

#### 2. Realtime Database (Cursors + Presence)

**Direct Firebase SDK usage** in hooks:
- `onValue()`: Subscribe to cursor/presence updates
- `set()`: Write cursor position or presence data
- `onDisconnect().remove()`: Auto-cleanup when user disconnects

**Throttling**: Cursor updates throttled to 100ms (10 updates/sec) to reduce bandwidth

#### 3. Firebase Auth

**Service Layer**: [src/services/authService.ts](src/services/authService.ts)

```typescript
signInWithGoogle(): Promise<void>
signInAnonymously(): Promise<void>
signOut(): Promise<void>
```

**Anonymous Display Names**:
- Generated from adjective + animal (e.g., "Happy Penguin", "Brave Tiger")
- Ensures all users have a readable name for cursors/presence

#### 4. Cloud Functions (AI Agent)

**Status**: Planned, not yet implemented

**Architecture**:
```typescript
// functions/src/aiAgent.ts
export const aiAgent = onRequest(async (req, res) => {
  const { boardId, prompt } = req.body

  // 1. Call Claude API with function calling
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4.5",
    tools: [createStickyNoteTool, moveTool, deleteTool],
    messages: [{ role: "user", content: prompt }]
  })

  // 2. Execute tool calls (write to Firestore)
  for (const toolCall of response.toolCalls) {
    await executeToolCall(boardId, toolCall)
  }

  // 3. Return result
  res.json({ success: true, message: response.content })
})
```

**Configuration**:
- Cloud Functions v2 (gRPC-based)
- `minInstances: 1` (keeps function warm for low latency)
- Requires Blaze plan (pay-as-you-go)

---

## Real-Time Synchronization

### Firestore Real-Time Sync

**How it works**:
1. Client calls `onSnapshot()` on Firestore collection
2. Firebase maintains WebSocket connection
3. On data change, Firestore pushes update to all connected clients
4. React hook updates state → components re-render

**Latency**: ~50-100ms

**Offline Support**:
- Firestore SDK caches data locally
- Writes queued when offline, synced when back online
- `updatedAt` timestamp resolves conflicts

### RTDB Real-Time Sync

**How it works**:
1. Client calls `onValue()` on RTDB reference
2. Firebase maintains WebSocket connection
3. On data change, RTDB pushes update to all clients (typically <50ms)
4. React hook updates state → cursors/presence re-render

**Presence Management**:
```typescript
// On mount
set(userPresenceRef, { ...userData, online: true })
onDisconnect(userPresenceRef).remove()

// On unmount
set(userPresenceRef, { ...userData, online: false })
```

**Why onDisconnect() is critical**:
- Automatically removes presence when client disconnects (network failure, tab close, etc.)
- Prevents "ghost users" in presence list

### Cursor Throttling

**Problem**: Sending cursor position on every `mousemove` event (60+ times/sec) is wasteful.

**Solution** ([src/hooks/useCursors.ts:6](src/hooks/useCursors.ts#L6)):
```typescript
const THROTTLE_MS = 100

const updateCursor = useCallback((x, y) => {
  const now = Date.now()
  if (now - lastUpdateRef.current < THROTTLE_MS) return
  lastUpdateRef.current = now

  set(cursorRef, { x, y, timestamp: now })
}, [])
```

**Result**: 10 updates/sec per user (acceptable trade-off)

---

## Security Model

### Firestore Security Rules

**File**: [firestore.rules](firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId}/{document=**} {
      // Only authenticated users can read/write
      allow read, write: if request.auth != null;
    }
  }
}
```

**Current Model**: Simple authentication check

**Future Improvements**:
- Board-level permissions (owner, collaborators, viewers)
- Validate object schema (prevent malformed data)
- Rate limiting (prevent spam)

### Realtime Database Security Rules

**File**: [database.rules.json](database.rules.json)

```json
{
  "rules": {
    "boards": {
      "$boardId": {
        "cursors": {
          ".read": "auth != null",
          "$userId": {
            ".write": "auth != null && auth.uid === $userId"
          }
        },
        "presence": {
          ".read": "auth != null",
          "$userId": {
            ".write": "auth != null && auth.uid === $userId"
          }
        }
      }
    }
  }
}
```

**Key Rules**:
- Anyone can read cursors/presence (if authenticated)
- Users can only write their own cursor/presence data (`auth.uid === $userId`)
- Prevents users from impersonating others

### Authentication Flow

```
User clicks "Sign in with Google"
       │
       ▼
signInWithGoogle()
       │
       ▼
Firebase Auth popup
       │
       ▼
User authenticates
       │
       ▼
Firebase returns JWT token
       │
       ▼
Token automatically included in all Firestore/RTDB requests
       │
       ▼
Security rules validate token
       │
       ▼
Read/write allowed
```

**Anonymous Auth**:
- Users can sign in anonymously (no account required)
- Still get a unique `uid` and JWT token
- Display name auto-generated (e.g., "Happy Penguin")

---

## Performance Considerations

### Target Metrics
| Metric | Target | Rationale |
|--------|--------|-----------|
| **Frame rate** | 60 FPS | Smooth pan/zoom |
| **Object sync latency** | <100ms | Real-time feel |
| **Cursor sync latency** | <50ms | Natural collaboration |
| **Max objects per board** | 500+ | Large whiteboard support |
| **Max concurrent users** | 5+ | Small team collaboration |

### Optimization Techniques

#### 1. Canvas Rendering (react-konva)
- ✅ Hardware-accelerated (GPU)
- ✅ Batch rendering (single paint per frame)
- ✅ Dirty rectangle optimization (only redraw changed areas)

#### 2. React Optimization
- `useCallback` for event handlers (prevent re-renders)
- `useMemo` for derived state (e.g., filtering objects by type)
- `useRef` for values that shouldn't trigger re-renders (throttling, object lookups)

#### 3. Firestore Optimization
- **Subcollections**: `/boards/{boardId}/objects/{objectId}` instead of flat structure
  - Better scalability (each board is isolated)
  - Easier security rules
- **Selective updates**: `updateDoc()` only sends changed fields
- **Local cache**: Firestore SDK caches data locally (instant reads)

#### 4. RTDB Optimization
- **Throttling**: Cursor updates limited to 10/sec
- **No persistence**: Cursors/presence are ephemeral (no disk writes)
- **Small payloads**: Only essential data (x, y, name, color)

#### 5. Bundle Size
- **Tree shaking**: Vite only bundles used code
- **Code splitting**: Lazy load components (future improvement)
- **Firebase SDK**: Use modular imports (not compat SDK)

### Performance Testing

**Manual Testing** (recommended for real-time features):
1. Open 2+ browser windows
2. Use Chrome DevTools Performance tab
3. Monitor FPS while panning/zooming
4. Check network waterfall for sync latency

**Automated Testing** (future):
- Lighthouse CI for bundle size
- Playwright for E2E performance tests

---

## Future Architecture

### Planned Features

#### 1. AI Agent (Cloud Functions)
**Status**: Planned

**Architecture**:
- Cloud Function v2 endpoint: `POST /aiAgent`
- Claude Sonnet 4.5 with function calling
- Tools: `createStickyNote`, `moveObject`, `deleteObject`, `createDiagram`

**Example**:
```
User: "Create 3 sticky notes with TODO items"
AI: [calls createStickyNote 3 times]
Result: 3 sticky notes appear on board
```

#### 2. Advanced Collaboration
- **Operational Transforms** or **CRDTs** for text editing (replace last-write-wins)
- **Locking**: Prevent simultaneous edits on same object
- **Undo/Redo**: Collaborative history with conflict resolution

#### 3. Board Permissions
- **Roles**: Owner, Editor, Viewer
- **Invite System**: Share board link with permissions
- **Public/Private boards**

#### 4. Export/Import
- **Export**: JSON, PNG, SVG, PDF
- **Import**: JSON (from other boards), images (drag-and-drop)

#### 5. Infinite Canvas
- **Viewport management**: Load objects in visible area only
- **Spatial indexing**: R-tree for efficient collision detection
- **Lazy loading**: Fetch objects as user pans

#### 6. Enhanced Shapes
- **Custom shapes**: Pentagon, star, arrow, etc.
- **Drawing tool**: Freehand paths
- **Image upload**: Embed images on canvas

#### 7. Comments & Annotations
- **Threaded comments** on objects
- **Mentions**: `@username` notifications
- **Timestamps**: "Last edited by X at Y"

### Scalability Roadmap

**Current**: 1 board, 5 users, 500 objects

**Phase 1** (MVP+):
- Multiple boards per user
- Board list UI
- Board metadata (name, created date, owner)

**Phase 2** (Team Features):
- Workspaces (collections of boards)
- Team management
- Role-based permissions

**Phase 3** (Enterprise):
- SSO integration (SAML, OAuth)
- Audit logs
- Advanced analytics (usage metrics, active users)

### Technology Upgrade Path

**Potential Improvements**:
- **State Management**: Consider Zustand/Jotai if hooks become too complex
- **Rendering**: Evaluate WebGL (PixiJS) if Canvas performance degrades
- **Backend**: Add GraphQL API (Hasura/Apollo) for complex queries
- **Offline-First**: Implement full offline mode with sync queue

---

## Appendix

### File Structure Reference

```
CollabBoard/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── AuthPanel.tsx
│   │   │   └── AuthPanel.test.tsx
│   │   ├── Board/
│   │   │   ├── Board.tsx
│   │   │   ├── Board.test.tsx
│   │   │   ├── StickyNote.tsx
│   │   │   ├── StickyNote.test.tsx
│   │   │   ├── ShapeComponent.tsx
│   │   │   ├── ShapeComponent.test.tsx
│   │   │   ├── FrameComponent.tsx
│   │   │   ├── FrameComponent.test.tsx
│   │   │   ├── ConnectorComponent.tsx
│   │   │   ├── ConnectorComponent.test.tsx
│   │   │   ├── StickerComponent.tsx
│   │   │   └── StickerComponent.test.tsx
│   │   ├── Cursors/
│   │   │   ├── Cursor.tsx
│   │   │   ├── Cursor.test.tsx
│   │   │   ├── CursorsOverlay.tsx
│   │   │   └── CursorsOverlay.test.tsx
│   │   ├── Presence/
│   │   │   ├── PresencePanel.tsx
│   │   │   └── PresencePanel.test.tsx
│   │   └── Toolbar/
│   │       ├── Toolbar.tsx
│   │       ├── Toolbar.test.tsx
│   │       ├── ColorPicker.tsx
│   │       └── ColorPicker.test.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useAuth.test.ts
│   │   ├── useBoard.ts
│   │   ├── useBoard.test.ts
│   │   ├── useCursors.ts
│   │   ├── useCursors.test.ts
│   │   ├── usePresence.ts
│   │   └── usePresence.test.ts
│   ├── services/
│   │   ├── firebase.ts
│   │   ├── authService.ts
│   │   ├── authService.test.ts
│   │   ├── boardService.ts
│   │   └── boardService.test.ts
│   │
│   ├── types/
│   │   └── board.ts
│   ├── utils/
│   │   ├── containment.ts
│   │   └── containment.test.ts
│   ├── test/
│   │   └── setup.ts
│   ├── App.tsx
│   └── main.tsx
├── functions/                  # Cloud Functions (future)
│   ├── src/
│   │   └── aiAgent.ts
│   └── package.json
├── public/                     # Static assets
├── firebase.json
├── firestore.rules
├── database.rules.json
├── vite.config.ts
├── tsconfig.json
├── CLAUDE.md                   # Project instructions
├── SETUP.md                    # Setup guide
├── ARCHITECTURE.md             # This file
└── package.json
```

### Key Architectural Patterns

1. **Custom Hooks for State Management**
   - Encapsulate Firebase interactions
   - Provide clean API to components
   - Single source of truth for each data domain

2. **Service Layer Pattern**
   - Abstract Firebase SDK behind service functions
   - Easier to test (mock services)
   - Centralized error handling

3. **Component Composition**
   - Small, focused components
   - Props drilling avoided via hooks
   - Render props for flexibility (e.g., `Board` children)

4. **Test-Driven Development**
   - Write test first, then implementation
   - Co-located tests for discoverability
   - Comprehensive coverage (unit, integration, E2E)

---

## Glossary

- **RTDB**: Firebase Realtime Database
- **TDD**: Test-Driven Development
- **HMR**: Hot Module Replacement
- **LWW**: Last-Write-Wins (conflict resolution)
- **CRDT**: Conflict-free Replicated Data Type
- **OT**: Operational Transform
- **SPA**: Single-Page Application
- **SSO**: Single Sign-On

---

## Further Reading

- [Firebase Documentation](https://firebase.google.com/docs)
- [React Konva Documentation](https://konvajs.org/docs/react/)
- [Vitest Documentation](https://vitest.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [CLAUDE.md](CLAUDE.md) - Project conventions and TDD workflow
- [SETUP.md](SETUP.md) - Setup instructions

---

**Document Version**: 1.0
**Last Updated**: 2026-02-16
**Maintained By**: CollabBoard Team
