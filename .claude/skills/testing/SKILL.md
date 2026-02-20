---
name: testing
description: TDD patterns and test rules by component type. Use when writing tests, creating new components/hooks/services, or debugging test failures.
---

# Testing — TDD Rules by Component Type

## TDD Workflow (Red-Green-Refactor)

1. **Red:** Write a failing test that defines the expected behavior
2. **Green:** Write the minimal code to make the test pass
3. **Refactor:** Clean up the code while keeping tests green

## React Components

1. Write test first: render, verify DOM output, simulate user interactions
2. Test props, state changes, conditional rendering, event handlers
3. Mock Firebase hooks — never hit real database in component tests

```typescript
// Write this FIRST
describe('StickyNote', () => {
  it('renders text content', () => { ... })
  it('enters edit mode on double-click', () => { ... })
  it('calls onUpdate when text changes', () => { ... })
})
// THEN create StickyNote.tsx
```

## Custom Hooks (useBoard, useCursors, usePresence, useAI)

1. Write test first using `renderHook` from @testing-library/react
2. Mock Firebase SDK calls (Firestore listeners, RTDB refs)
3. Test state transitions, subscription setup/teardown, error handling

```typescript
describe('usePresence', () => {
  it('registers user on mount', () => { ... })
  it('removes user on unmount', () => { ... })
  it('returns list of online users', () => { ... })
})
```

## Firebase Services (boardService, aiService)

1. Write test first against Firebase Emulator Suite
2. Test CRUD operations, real-time listener callbacks, error cases
3. Use emulator for integration tests — no mocks for service layer

```typescript
describe('boardService', () => {
  it('creates a sticky note in Firestore', () => { ... })
  it('notifies listeners on object update', () => { ... })
  it('deletes object by ID', () => { ... })
})
```

## Cloud Functions (AI Agent)

1. Write test first using firebase-functions-test
2. Mock the Claude API response — never call real LLM in tests
3. Test: input parsing, tool call generation, Firestore writes, error responses

```typescript
describe('aiAgent', () => {
  it('creates sticky note from natural language', () => { ... })
  it('returns error for invalid command', () => { ... })
  it('handles multi-step commands sequentially', () => { ... })
})
```

## Firestore Security Rules

1. Write test first using @firebase/rules-unit-testing
2. Test: authenticated access, unauthenticated rejection, board-scoped writes

```typescript
describe('Firestore Rules', () => {
  it('allows authenticated user to write board objects', () => { ... })
  it('denies unauthenticated writes', () => { ... })
  it('denies writes to other boards', () => { ... })
})
```

## Real-Time Collaboration (E2E / Playwright)

1. Write Playwright test first for multi-user scenarios
2. Use two browser contexts to simulate two users
3. Test: cursor sync, object creation visibility, presence updates

```typescript
describe('collaboration', () => {
  it('shows cursor movement to other user', () => { ... })
  it('syncs new sticky note to second browser', () => { ... })
  it('updates presence when user joins/leaves', () => { ... })
})
```

## What NOT to TDD

- Tailwind CSS styling (visual, not behavioral)
- Firebase config/initialization boilerplate
- Vite/build configuration
- Static type definitions (`src/types/`)

## Enforcement

- **Never create a new source file without its test file first**
- **Never implement a function/component before its test exists**
- Run `npx vitest --watch` during development for continuous feedback
- All tests must pass before committing
