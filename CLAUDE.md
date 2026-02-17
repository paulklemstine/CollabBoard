# CollabBoard - Project Instructions

## Project
Real-time collaborative whiteboard with AI agent. Firebase backend, React frontend.

## Tech Stack
- **Frontend:** React 18 + Vite + TypeScript + react-konva + Tailwind CSS
- **Board Objects:** Firestore (real-time listeners)
- **Cursors/Presence:** Firebase Realtime Database (RTDB)
- **Auth:** Firebase Auth (Google sign-in + anonymous with auto-generated display names)
- **AI Agent:** Firebase Cloud Functions v2 (minInstances=1) + Anthropic Claude Sonnet 4.5 with function calling
- **Deployment:** Firebase Hosting

## Key Architecture Decisions
- Dual database: Firestore for board objects, RTDB for cursors/presence (RTDB gives onDisconnect() and <50ms latency)
- Client writes directly to Firestore (no REST API); security enforced via Firestore rules
- Last-write-wins conflict resolution (object-level granularity)
- AI endpoint is a single Cloud Function v2 that calls Claude and writes results to Firestore

## File Structure
- `src/components/` - React components (Board, Toolbar, Cursors, Presence, AIChat, Auth)
- `src/hooks/` - Custom hooks (useBoard, useCursors, usePresence, useAI)
- `src/services/` - Firebase config, board CRUD, AI client
- `src/types/` - TypeScript interfaces for board objects
- `functions/src/` - Cloud Functions (AI agent endpoint)
- `docs/` - Project documentation and development logs

## Conventions
- TypeScript strict mode
- Components: PascalCase (`StickyNote.tsx`)
- Hooks: `use` prefix (`useBoard.ts`)
- Tailwind CSS for styling
- ESLint + Prettier

## Build Priority
1. Cursor sync (RTDB)
2. Object sync (Firestore)
3. Conflict handling
4. State persistence
5. Board features (shapes, frames, connectors)
6. AI commands (basic)
7. AI commands (complex)

## Testing — Test-Driven Development (TDD)

TDD is the **primary development methodology** for this project. Always write the test first, watch it fail, then write the minimal code to make it pass.

### TDD Workflow (Red-Green-Refactor)
1. **Red:** Write a failing test that defines the expected behavior
2. **Green:** Write the minimal code to make the test pass
3. **Refactor:** Clean up the code while keeping tests green

### Tools
- **Unit/Integration tests:** Vitest + React Testing Library
- **Component tests:** Vitest + @testing-library/react + jest-canvas-mock (for Konva)
- **Cloud Functions tests:** Vitest + firebase-functions-test
- **E2E tests:** Playwright (multi-browser collaboration scenarios)
- **Local backend:** Firebase Emulator Suite (Firestore, RTDB, Auth, Functions)

### Test File Conventions
- Co-locate tests next to source: `Component.tsx` → `Component.test.tsx`
- Hooks: `useBoard.ts` → `useBoard.test.ts`
- Services: `boardService.ts` → `boardService.test.ts`
- Cloud Functions: `aiAgent.ts` → `aiAgent.test.ts`
- E2E tests: `e2e/` directory at project root

### TDD Rules by Component Type

#### React Components
1. Write test first: render, verify DOM output, simulate user interactions
2. Test props, state changes, conditional rendering, event handlers
3. Mock Firebase hooks — never hit real database in component tests
```
// Example: write this FIRST
describe('StickyNote', () => {
  it('renders text content', () => { ... })
  it('enters edit mode on double-click', () => { ... })
  it('calls onUpdate when text changes', () => { ... })
})
// THEN create StickyNote.tsx
```

#### Custom Hooks (useBoard, useCursors, usePresence, useAI)
1. Write test first using `renderHook` from @testing-library/react
2. Mock Firebase SDK calls (Firestore listeners, RTDB refs)
3. Test state transitions, subscription setup/teardown, error handling
```
// Example: write this FIRST
describe('usePresence', () => {
  it('registers user on mount', () => { ... })
  it('removes user on unmount', () => { ... })
  it('returns list of online users', () => { ... })
})
// THEN create usePresence.ts
```

#### Firebase Services (boardService, aiService)
1. Write test first against Firebase Emulator Suite
2. Test CRUD operations, real-time listener callbacks, error cases
3. Use emulator for integration tests — no mocks for service layer
```
// Example: write this FIRST
describe('boardService', () => {
  it('creates a sticky note in Firestore', () => { ... })
  it('notifies listeners on object update', () => { ... })
  it('deletes object by ID', () => { ... })
})
// THEN create boardService.ts
```

#### Cloud Functions (AI Agent)
1. Write test first using firebase-functions-test
2. Mock the Claude API response (never call real LLM in tests)
3. Test: input parsing, tool call generation, Firestore writes, error responses
```
// Example: write this FIRST
describe('aiAgent', () => {
  it('creates sticky note from natural language', () => { ... })
  it('returns error for invalid command', () => { ... })
  it('handles multi-step commands sequentially', () => { ... })
})
// THEN create aiAgent.ts
```

#### Firestore Security Rules
1. Write test first using @firebase/rules-unit-testing
2. Test: authenticated access, unauthenticated rejection, board-scoped writes
```
// Example: write this FIRST
describe('Firestore Rules', () => {
  it('allows authenticated user to write board objects', () => { ... })
  it('denies unauthenticated writes', () => { ... })
  it('denies writes to other boards', () => { ... })
})
// THEN write firestore.rules
```

#### Real-Time Collaboration (E2E)
1. Write Playwright test first for multi-user scenarios
2. Use two browser contexts to simulate two users
3. Test: cursor sync, object creation visibility, presence updates
```
// Example: write this FIRST
describe('collaboration', () => {
  it('shows cursor movement to other user', () => { ... })
  it('syncs new sticky note to second browser', () => { ... })
  it('updates presence when user joins/leaves', () => { ... })
})
```

### What NOT to TDD
- Tailwind CSS styling (visual, not behavioral)
- Firebase config/initialization boilerplate
- Vite/build configuration
- Static type definitions (`src/types/`)

### Enforcement
- **Never create a new source file without its test file first**
- **Never implement a function/component before its test exists**
- Run `npx vitest --watch` during development for continuous feedback
- All tests must pass before committing (pre-commit hook)

### Performance Testing
- Manual testing with 2+ browser windows remains critical for real-time sync validation
- Performance targets: 60 FPS, <100ms object sync, <50ms cursor sync, 500+ objects, 5+ concurrent users
- Use Chrome DevTools Performance tab to profile FPS during pan/zoom

## Documentation Requirements

**IMPORTANT:** Always maintain up-to-date documentation as you develop features.

### Documentation Workflow
1. **During Development:** Create/update technical documentation for new features in `docs/`
2. **After Implementation:** Update the engineering diary in `docs/AI_DEVELOPMENT_LOG.md`
3. **Before Committing:** Ensure all related docs are included in the commit

### Required Documentation

#### Feature Documentation (`docs/`)
When implementing significant features, create dedicated markdown files in `docs/`:
- **Architecture decisions** - Explain why you chose a particular approach
- **System design** - Document how components interact (e.g., `PRESENCE_HEARTBEAT.md`)
- **Configuration** - Document tuneable parameters and their rationale
- **Trade-offs** - Explain costs, performance implications, edge cases
- **Testing guide** - How to manually test the feature

Examples:
- `docs/PRESENCE_HEARTBEAT.md` - Presence and cursor timeout systems
- `docs/AI_COST_ANALYSIS.md` - AI feature cost analysis
- `docs/ARCHITECTURE.md` - Overall system architecture

#### Engineering Diary (`docs/AI_DEVELOPMENT_LOG.md`)
**ALWAYS update the development log after completing work.** This is a chronological record of all development activities.

For each work session, add an entry with:
- **Date & Time** - When the work was done
- **Task/Feature** - What was implemented or fixed
- **Approach** - High-level description of how you solved it
- **Key Changes** - Files modified, new patterns introduced
- **Challenges** - Problems encountered and how you solved them
- **Testing** - How you verified it works
- **Commit Hash** - Link to the commit for traceability

Entry Format:
```markdown
### [YYYY-MM-DD HH:MM] Feature/Fix Name

**Task:** Brief description of what needed to be done

**Approach:**
- Key decision 1
- Key decision 2

**Changes:**
- `file/path.ts` - What changed and why
- `file/path2.ts` - What changed and why

**Challenges:**
- Problem encountered and solution

**Testing:**
- How it was tested (unit tests, manual testing, etc.)

**Commit:** [abc1234] Commit message
```

### Documentation Best Practices
- **Write docs as you code** - Don't wait until the end
- **Be specific** - Include code snippets, configuration values, file paths
- **Explain "why"** - Not just "what" but "why did we choose this approach"
- **Update existing docs** - When changing behavior, update related documentation
- **Link between docs** - Cross-reference related documentation files
- **Include examples** - Real-world usage examples and common patterns
