# 📊 Semantic Code Architecture - CollabBoard

**Generated**: 2026-02-18
**Tool**: MCP Semantic Navigator
**Total Files Analyzed**: 93 TypeScript/JavaScript files
**Conceptual Areas**: 11 distinct groups

---

## Overview

This document provides a semantic (meaning-based) view of the CollabBoard codebase, organized by **purpose** rather than file structure. Generated using the MCP Semantic Navigator tool.

---

## 🎨 UI Components (40 files - 43%)

The largest group! All your visual components:

### Board Components
- `StickyNote.tsx` - Draggable sticky notes with text editing
- `ShapeComponent.tsx` - Rectangles, circles, and lines
- `FrameComponent.tsx` - Grouping containers with frames
- `StickerComponent.tsx` - Emoji stickers
- `ConnectorComponent.tsx` - Arrows connecting objects
- `Board.tsx` - Main Konva canvas stage
- `ZoomControls.tsx` - Zoom in/out/reset buttons
- `SelectionOverlay.tsx` - Multi-select bounding box with handles
- `PreviewConnector.tsx` - Live connector preview during creation

### Toolbar Components
- `Toolbar.tsx` - Main toolbar at bottom
- `ColorPicker.tsx` - Color selection
- `ColorDrawer.tsx` - Color palette drawer
- `ShapeDrawer.tsx` - Shape selection drawer
- `StickerDrawer.tsx` - Emoji sticker picker (500+ emojis)

### Cursor & Presence
- `CursorsOverlay.tsx` - Real-time cursor display
- `Cursor.tsx` - Individual cursor component
- `PresencePanel.tsx` - Online users list

### AI & Authentication
- `AIChat.tsx` - AI assistant chat interface
- `AuthPanel.tsx` - Google sign-in + anonymous auth

### Dashboard
- `BoardDashboard.tsx` - Board list view
- `BoardCard.tsx` - Individual board preview
- `CreateBoardForm.tsx` - New board creation

**Purpose**: This is your UI layer - everything users see and interact with. All components use react-konva for canvas rendering except the toolbar/panels which use standard React + Tailwind CSS.

---

## 🔧 React Hooks (16 files - 17%)

Custom hooks powering the application:

### Core Hooks
- `useBoard.ts` - Board state management, CRUD operations, real-time listeners
- `useAuth.ts` - Authentication state, user profile, sign-in/out
- `useCursors.ts` - Real-time cursor tracking (RTDB)
- `usePresence.ts` - User presence detection, online/offline status
- `useAI.ts` - AI assistant integration, request/response handling
- `useUserBoards.ts` - Board list management per user

### UI Interaction Hooks
- `useMultiSelect.ts` - Multi-object selection, marquee selection
- `useRouter.ts` - Navigation between dashboard and board views

### Animation Hooks
- `useSmoothedPosition.ts` - Smooth cursor movement
- `useSmoothedObjectPosition.ts` - Smooth object animations

**Purpose**: Your business logic and state management layer. These hooks encapsulate all Firebase interactions, real-time sync, and complex UI state.

---

## ⚙️ Services & APIs (8 files - 9%)

Backend integration layer:

### Firebase Services
- `boardService.ts` - Firestore CRUD for board objects
  - Create/read/update/delete sticky notes, shapes, frames, stickers, connectors
  - Real-time listeners with `onSnapshot`
  - Batch operations for performance

- `authService.ts` - Firebase Authentication
  - Google OAuth sign-in
  - Anonymous authentication with auto-generated display names
  - User profile management

- `boardMetadataService.ts` - Board metadata (title, owner, created date)
  - User board list
  - Board permissions

- `aiService.ts` - AI assistant API calls
  - Submit prompts to Cloud Function
  - Stream responses
  - Handle AI-created objects

- `firebase.ts` - Firebase SDK configuration
  - Firestore initialization
  - Realtime Database setup
  - Authentication setup

**Purpose**: Your data access layer - abstracts Firebase operations into clean APIs. No components directly call Firebase; they go through these services.

---

## 🛠️ Utilities & Helpers (13 files - 14%)

Reusable utility functions:

### Math & Geometry
- `coordinates.ts` - Screen-to-world coordinate transformations
- `selectionMath.ts` - Multi-select bounding box calculations
- `groupTransform.ts` - Group rotation/scaling math
- `interpolation.ts` - Linear interpolation for smooth animations
- `containment.ts` - Frame containment logic (parent-child relationships)

### Visual Utilities
- `colors.ts` - Color manipulation, hex conversion, gradients

### Error Handling
- `authErrors.ts` - Firebase auth error messages, user-friendly formatting

**Purpose**: Your shared logic layer. These pure functions have no side effects and are extensively tested.

---

## 🧪 Tests (6 files)

Testing infrastructure:

### Test Files
- `src/test/setup.ts` - Vitest configuration, mock setup
- `src/test/stress.test.ts` - Performance tests (500+ objects, 5+ users)
- `functions/src/aiAgent.test.ts` - AI agent function tests
- `functions/src/parentIdTest.test.ts` - Parent-child relationship tests
- `scripts/generate-test-board.ts` - Test data generator
- Component/hook/service `.test.ts` files (co-located with source)

**Test Framework**: Vitest + React Testing Library + Firebase Emulator Suite

**Coverage Areas**:
- Unit tests for hooks, services, utilities
- Component tests with react-konva mocking
- Integration tests with Firebase Emulator
- E2E tests with Playwright (planned)

---

## ☁️ Cloud Functions (3 files)

Firebase Cloud Functions for AI backend:

### Main Function
- `functions/src/index.ts` - **The AI Agent!**
  - **Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
  - **Pricing**: $1 input / $5 output per million tokens
  - **17 AI Tools**:
    1. `createStickyNote` - Create sticky notes
    2. `createShape` - Create rectangles, circles, lines
    3. `createFrame` - Create grouping frames
    4. `createSticker` - Create emoji stickers
    5. `createConnector` - Connect objects with arrows
    6. `moveObject` - Reposition objects
    7. `resizeObject` - Resize objects
    8. `updateText` - Change sticky note text
    9. `changeColor` - Change object colors
    10. `deleteObject` - Delete objects
    11. `updateParent` - Change parent-child relationships
    12. `alignObjects` - Align multiple objects
    13. `arrangeInGrid` - Arrange objects in grids
    14. `duplicateObject` - Clone objects with offset
    15. `setZIndex` - Control layering order
    16. `rotateObject` - Rotate objects
    17. `generateFromTemplate` - Generate templates (SWOT, Kanban, etc.)
    18. `getBoardState` - Read current board state

### Templates Available
- **SWOT**: 2x2 Strengths, Weaknesses, Opportunities, Threats
- **Kanban**: 3-column To Do, In Progress, Done
- **Retrospective**: What Went Well, What Didn't, Action Items
- **Eisenhower Matrix**: Urgent/Important 2x2
- **Mind Map**: Central node with 4 connected branches

**Deployment**: Firebase Cloud Functions v2, minInstances=1 (keeps warm), 512MB memory, 300s timeout

---

## 🔧 Configuration (2 files)

Build and tooling configuration:

- `vite.config.ts` - Vite bundler configuration
  - TypeScript compilation
  - Tailwind CSS processing
  - Development server setup
  - Production build optimization

- `eslint.config.js` - Code linting rules
  - TypeScript strict mode
  - React best practices
  - Import ordering

---

## 🤖 MCP Semantic Navigator (2 files)

The tool that generated this analysis!

- `mcp-semantic-navigator/server.py` - MCP protocol server
  - Scans codebase for TypeScript/JavaScript files
  - Groups files by semantic meaning
  - Exposes tools for Claude Code integration
  - 100% free, no API keys needed

- `mcp-semantic-navigator/demo.py` - Demo script

**How It Works**:
1. Scans repository for code files
2. Groups by directory patterns and naming conventions
3. Can be upgraded to ML embeddings (sentence-transformers)
4. Exposes via MCP protocol for Claude Code

---

## 📐 Type Definitions (1 file)

- `src/types/board.ts` - All TypeScript interfaces
  - `BoardObject` - Base interface for all objects
  - `StickyNote` - Text notes with color
  - `Shape` - Rectangles, circles, lines
  - `Frame` - Grouping containers
  - `Sticker` - Emoji stickers
  - `Connector` - Arrows between objects
  - `StageTransform` - Canvas pan/zoom state
  - `User` - User profile interface

**Purpose**: Single source of truth for all data structures. Enforces type safety across the application.

---

## 🚀 Entry Points (2 files)

- `src/App.tsx` - Main application component
  - Router logic (Dashboard vs Board view)
  - Board state initialization
  - Multi-select handling
  - Real-time sync coordination

- `src/main.tsx` - React app initialization
  - ReactDOM rendering
  - Global styles import
  - Error boundary setup

---

## 🎯 Architecture Insights

### Frontend Architecture (React + TypeScript + Vite)

**Layers**:
1. **UI Layer** (40 components)
   - react-konva for canvas rendering
   - Tailwind CSS for toolbar/panels
   - Real-time cursor overlay

2. **State Layer** (16 hooks)
   - Board state (objects, selection, multi-select)
   - Authentication state
   - Cursor/presence state
   - AI chat state

3. **Data Layer** (8 services)
   - Firestore operations
   - RTDB operations
   - Authentication
   - AI requests

4. **Utility Layer** (13 helpers)
   - Pure functions
   - Math/geometry calculations
   - Color utilities

### Backend Architecture (Firebase)

**Dual Database Strategy**:
- **Firestore**: Board objects (persistent, ACID)
  - Path: `boards/{boardId}/objects/{objectId}`
  - Real-time listeners with `onSnapshot`
  - Last-write-wins conflict resolution

- **Realtime Database**: Cursors/presence (ephemeral, <50ms latency)
  - Path: `cursors/{boardId}/{userId}`, `presence/{boardId}/{userId}`
  - `onDisconnect()` cleanup
  - Heartbeat system (5s interval, 15s timeout)

**Cloud Functions**:
- Firestore-triggered function on `boards/{boardId}/aiRequests/{requestId}`
- Claude Haiku 4.5 with function calling
- Writes results back to Firestore
- Cost: ~$0.00175 per AI request

**Security**:
- Firestore rules: authenticated writes only, board-scoped
- RTDB rules: authenticated writes only
- Cloud Function: server-side validation

### Key Design Patterns

✅ **Direct Client Writes**: No REST API, clients write directly to Firestore
✅ **Real-time First**: All changes sync via Firestore/RTDB listeners
✅ **Optimistic UI**: Immediate local updates, server validates
✅ **Eventual Consistency**: Last-write-wins, object-level granularity
✅ **Component Co-location**: Tests and components in same directory
✅ **Service Abstraction**: Components never call Firebase directly
✅ **Type Safety**: Strict TypeScript, runtime validation

### Technology Stack

**Frontend**:
- React 18 (functional components, hooks)
- TypeScript (strict mode)
- Vite (build tool, HMR)
- Tailwind CSS (utility-first styling)
- react-konva (canvas rendering)

**Backend**:
- Firebase Firestore (board objects)
- Firebase Realtime Database (cursors/presence)
- Firebase Cloud Functions v2 (AI agent)
- Firebase Authentication (Google + anonymous)
- Firebase Hosting (static hosting)

**AI**:
- Claude Haiku 4.5 (Anthropic)
- Function calling (17 tools)
- Cost: $1/$5 per million tokens

**Development**:
- Vitest (unit/integration tests)
- React Testing Library (component tests)
- Firebase Emulator Suite (local backend)
- Playwright (E2E tests, planned)
- Git worktrees (parallel development)

---

## 📊 Code Distribution

| Category | Files | Percentage | Purpose |
|----------|-------|------------|---------|
| UI Components | 40 | 43% | Visual layer |
| React Hooks | 16 | 17% | State management |
| Utilities | 13 | 14% | Shared logic |
| Services | 8 | 9% | Data access |
| Tests | 6 | 6% | Quality assurance |
| Cloud Functions | 3 | 3% | AI backend |
| Configuration | 2 | 2% | Build tools |
| Types | 1 | 1% | Type definitions |
| Entry Points | 2 | 2% | App initialization |
| MCP Tools | 2 | 2% | Dev tooling |

**Total**: 93 files

---

## 🔍 Key Insights

### Most Active Development Areas

1. **UI Components** (40 files) - The visual layer is comprehensive
2. **React Hooks** (16 files) - Complex state management for real-time collaboration
3. **Utilities** (13 files) - Rich math/geometry library for canvas operations

### Well-Organized Codebase

✅ **Clear separation of concerns**: UI → Hooks → Services → Firebase
✅ **Type-safe throughout**: Strict TypeScript with runtime validation
✅ **Testable architecture**: Pure functions, dependency injection
✅ **Real-time optimized**: Dual database for different latency requirements
✅ **AI-powered**: 17 tools for natural language board manipulation

### Performance Considerations

- **60 FPS target**: Optimized Konva rendering
- **<100ms object sync**: Firestore real-time listeners
- **<50ms cursor sync**: RTDB with minimal payload
- **500+ objects supported**: Tested with stress tests
- **5+ concurrent users**: Real-time collaboration tested

---

## 🚀 Future Expansion Areas

Based on the semantic analysis, potential areas for growth:

1. **E2E Tests** - Only 6 test files currently, could expand coverage
2. **Documentation** - Could add more inline docs for complex utilities
3. **Type Refinement** - Single types file could be split by domain
4. **Component Library** - 40 components could be organized into sub-packages
5. **Performance Monitoring** - Add telemetry for real-time metrics

---

**Generated with**: MCP Semantic Navigator v0.1.0
**Analysis Date**: 2026-02-18
**Codebase Version**: Latest main branch

---

## Appendix: File Listing by Category

### UI Components (40)
```
src/components/AIChat/AIChat.tsx
src/components/Auth/AuthPanel.tsx
src/components/Board/Board.tsx
src/components/Board/ConnectorComponent.tsx
src/components/Board/FrameComponent.tsx
src/components/Board/PreviewConnector.tsx
src/components/Board/SelectionOverlay.tsx
src/components/Board/ShapeComponent.tsx
src/components/Board/StickerComponent.tsx
src/components/Board/StickyNote.tsx
src/components/Board/ZoomControls.tsx
src/components/Cursors/Cursor.tsx
src/components/Cursors/CursorsOverlay.tsx
src/components/Dashboard/BoardCard.tsx
src/components/Dashboard/BoardDashboard.tsx
src/components/Dashboard/CreateBoardForm.tsx
src/components/Presence/PresencePanel.tsx
src/components/Toolbar/ColorDrawer.tsx
src/components/Toolbar/ColorPicker.tsx
src/components/Toolbar/FancyColorPicker.tsx
src/components/Toolbar/ShapeDrawer.tsx
src/components/Toolbar/StickerDrawer.tsx
src/components/Toolbar/Toolbar.tsx
+ tests for all components
```

### React Hooks (16)
```
src/hooks/useAI.ts
src/hooks/useAuth.ts
src/hooks/useBoard.ts
src/hooks/useCursors.ts
src/hooks/useMultiSelect.ts
src/hooks/usePresence.ts
src/hooks/useRouter.ts
src/hooks/useSmoothedObjectPosition.ts
src/hooks/useSmoothedPosition.ts
src/hooks/useUserBoards.ts
+ tests for all hooks
```

### Services & APIs (8)
```
src/services/aiService.ts
src/services/authService.ts
src/services/boardMetadataService.ts
src/services/boardService.ts
src/services/firebase.ts
+ tests for all services
```

### Utilities & Helpers (13)
```
src/utils/authErrors.ts
src/utils/colors.ts
src/utils/containment.ts
src/utils/coordinates.ts
src/utils/groupTransform.ts
src/utils/interpolation.ts
src/utils/selectionMath.ts
+ tests for all utilities
```

### Cloud Functions (3)
```
functions/src/index.ts (AI Agent - 1000+ lines)
functions/lib/index.js (compiled)
functions/lib/index.d.ts (types)
```

### Entry Points (2)
```
src/App.tsx
src/main.tsx
```

### Type Definitions (1)
```
src/types/board.ts
```

### Configuration (2)
```
vite.config.ts
eslint.config.js
```

### MCP Tools (2)
```
mcp-semantic-navigator/server.py
mcp-semantic-navigator/demo.py
```

### Tests (6)
```
src/test/setup.ts
src/test/stress.test.ts
scripts/generate-test-board.ts
functions/src/aiAgent.test.ts
functions/src/parentIdTest.test.ts
+ inline .test.ts files
```
