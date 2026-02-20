# Flow Space

Real-time visual collaboration board. Firebase backend, React + react-konva frontend, AI agent via Cloud Functions.

## Quick Facts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build (Vite) |
| `npx vitest run` | Run unit tests |
| `npx vitest --watch` | Watch mode tests |
| `npx tsc --noEmit` | Type check |
| `FUNCTIONS_DISCOVERY_TIMEOUT=60000 firebase deploy` | Deploy (WSL2 needs the env var) |

## Tech Stack

React 18 + Vite + TypeScript + react-konva + Tailwind CSS. Firebase Auth (Google + anonymous), Firestore (board objects), RTDB (cursors/presence), Cloud Functions v2 (AI agent, Anthropic Claude Sonnet 4.5).

## Architecture

- **Dual database**: Firestore for board objects, RTDB for cursors/presence (onDisconnect + <50ms latency)
- **Client writes directly to Firestore** — security via Firestore rules, no REST API layer
- **Last-write-wins** conflict resolution at object-level granularity
- **AI endpoint**: single Cloud Function v2 that calls Claude and writes results to Firestore
- **Lazy imports in Cloud Functions**: heavy deps (LangChain, Langfuse) use `await import(...)` to avoid deployment timeouts; only firebase-admin and firebase-functions at top level

## File Structure

- `src/components/` — React components (Board, Toolbar, Cursors, Presence, AIChat, Auth)
- `src/hooks/` — Custom hooks (useBoard, useCursors, usePresence, useAI)
- `src/services/` — Firebase config, board CRUD, AI client
- `src/types/` — TypeScript interfaces for board objects
- `functions/src/` — Cloud Functions (AI agent endpoint)
- `docs/` — Project documentation and dev logs

## Code Style

- TypeScript strict mode
- Components: PascalCase files (`StickyNote.tsx`), hooks: `use` prefix (`useBoard.ts`)
- Tailwind CSS for styling — no CSS modules, no styled-components
- Use ES modules (`import`/`export`), never CommonJS (`require`)
- `import type` for type-only imports (erased at compile time, safe at top level)
- Prefer small, focused components over large monolithic ones

## Gold Standard Files

When creating new code, follow the patterns established in these files:
- **React component**: `src/components/StickyNote.tsx`
- **Custom hook**: `src/hooks/useBoard.ts`
- **Service**: `src/services/boardService.ts`
- **Cloud Function**: `functions/src/index.ts`

## Gotchas

- **WSL2 + Firebase**: deploy needs `FUNCTIONS_DISCOVERY_TIMEOUT=60000` due to slow I/O on heavy node_modules
- **react-konva**: Canvas elements don't have DOM — use jest-canvas-mock in tests, not @testing-library queries
- **Firestore listeners**: always unsubscribe in useEffect cleanup to prevent memory leaks
- **RTDB presence**: uses `onDisconnect()` which is server-side — don't rely on client-side cleanup alone
- **Cloud Functions cold start**: lazy imports are intentional — do not refactor to top-level imports

## Git Workflow

**MANDATORY: Use git worktrees** for all feature work. Never switch branches in the main worktree.

```bash
# Create worktree for a feature
git worktree add ../CollabBoard-feature-name -b feature-name
cd ../CollabBoard-feature-name && npm install

# After merge, clean up
git worktree remove ../CollabBoard-feature-name
git branch -d feature-name
```

For the full worktree workflow, see `.claude/skills/git-workflow/SKILL.md`.

## Testing

**TDD is the primary methodology.** Red-Green-Refactor: write failing test first, minimal code to pass, then refactor.

- **Unit/Integration**: Vitest + React Testing Library
- **Canvas components**: Vitest + jest-canvas-mock (for Konva)
- **Cloud Functions**: Vitest + firebase-functions-test (mock Claude API, never call real LLM)
- **E2E**: Playwright (multi-browser collaboration)
- **Co-locate tests**: `Component.tsx` -> `Component.test.tsx`

For detailed TDD rules by component type, see `.claude/skills/testing/SKILL.md`.

### Performance Targets

60 FPS, <100ms object sync, <50ms cursor sync, 500+ objects, 5+ concurrent users.

## Documentation

Update `docs/AI_DEVELOPMENT_LOG.md` after completing significant work. Create dedicated docs in `docs/` for architecture decisions and system design. See `.claude/skills/documentation/SKILL.md` for the full format.

## Tracking

After significant work, append an entry to `.claude/tracking/key-prompts/YYYY-MM-DD.md`:

```
## [date] — [short title]
**Category**: breakthrough | bug-resolution | architecture | feature
**Context**: What problem was being solved?
**The Prompt**: (exact or close paraphrase)
**Why It Worked**: (what made the phrasing/framing effective)
**Prior Attempts That Failed**: (for bugs: what didn't work; otherwise: N/A)
```

## Context Management

- Use `/clear` between unrelated tasks to prevent context pollution
- Use subagents (Task tool) for heavy investigation — protects main context window
- If Claude ignores instructions after extended sessions, `/clear` and restart with a focused prompt
- When compacting, preserve: list of modified files, current task, and test commands
