# Flow Space Development Diary

A chronological log of all development work on Flow Space, tracking features, fixes, decisions, and learnings.

---

## Development Entries

### [2026-02-17 00:30] Fix Display Name Race Condition During Email Sign-Up

**Task:** After email sign-up, the UI briefly showed the truncated email (e.g., "test") instead of the user's chosen display name, then corrected itself only after a page refresh.

**Approach:**
- Root cause: Firebase's `onAuthStateChanged` fires when the user account is created (with `displayName: null`), but `updateProfile` completes *after* that event. Since `updateProfile` mutates the User object in place without triggering another `onAuthStateChanged`, React never re-renders with the updated name.
- Added a `refreshUser` callback to `useAuth` that bumps a tick counter to force a re-render
- Added `onAuthChange` prop to `AuthPanel` that is called after successful sign-up
- App.tsx passes `refreshUser` as `onAuthChange` to AuthPanel on the login screen

**Changes:**
- `src/hooks/useAuth.ts` - Added `[, setTick] = useState(0)` and `refreshUser` callback that increments tick to force re-render after profile mutation
- `src/components/Auth/AuthPanel.tsx` - Added `onAuthChange?: () => void` prop, called after successful `signUpWithEmail`
- `src/App.tsx` - Destructured `refreshUser` from `useAuth()`, passed as `onAuthChange` to AuthPanel
- `src/services/authService.ts` - Added `user.reload()` after `updateProfile` in `signUpWithEmail`

**Challenges:**
- **Problem**: Firebase Auth's `User` object is mutable - `updateProfile` changes properties on the same reference, so React's identity-based diffing doesn't detect the change
- **Solution**: Force re-render via tick counter pattern; this is lightweight and avoids cloning the entire User object

**Testing:**
- Manual testing: Sign up with email, verify display name appears immediately without refresh
- Verified existing tests still pass

**Commit:** [5eb6de9] Fix display name race condition during email sign-up

---

### [2026-02-17 00:00] Show Display Name Instead of Email for Email Users

**Task:** Email-authenticated users saw their full email address in the header and dashboard instead of their display name.

**Approach:**
- Updated all display locations to use `displayName || email?.split('@')[0] || 'User'` fallback chain
- Updated avatar initial to use `(displayName?.[0] || email?.[0] || 'U').toUpperCase()`

**Changes:**
- `src/components/Auth/AuthPanel.tsx` - Fixed avatar initial and display name in signed-in view
- `src/components/Dashboard/BoardDashboard.tsx` - Fixed welcome message to prefer displayName

**Testing:**
- Manual testing: Logged in with email account, verified name displays correctly everywhere

**Commit:** [c1cb7e6] Show display name instead of email for email users

---

### [2026-02-17] Fix Cursor Freeze During Drag Operations

**Task:** When user 1 dragged an object, user 2 saw user 1's cursor freeze in place until the mouse was released. The cursor should track smoothly during drag.

**Approach:**
- Identified that Konva's Stage `onMouseMove` event does not fire while a child element is being dragged (Konva suppresses stage events during drag)
- Previous fix (wrapper functions calling `updateCursor` from drag handlers) passed the object's position instead of the mouse position, causing cursor to jump to the object's top-left corner
- Final solution: Replaced Konva's `onMouseMove` with a native DOM `mousemove` listener on the Stage container element, which fires regardless of Konva drag state

**Changes:**
- `src/components/Board/Board.tsx` - Removed Konva `onMouseMove` handler, added `useEffect` with native DOM `mousemove` listener on `stage.container()`. Converts client coordinates to world coordinates using stage transform.
- `src/App.tsx` - Removed `handleDragMoveWithCursor` and `handleFrameDragMoveWithCursor` wrapper functions (no longer needed)

**Challenges:**
- **Problem 1**: Initial approach called `updateCursor(x, y)` from drag handlers, but `x, y` was the object position, not the mouse position - causing cursor to jump to top-left of dragged object
- **Solution 1**: Removed `updateCursor` from drag handlers entirely
- **Problem 2**: Konva Stage `onMouseMove` is suppressed during child drags, so cursor updates stopped completely
- **Solution 2**: Used native DOM `mousemove` listener which is not suppressed by Konva's drag system

**Testing:**
- Manual testing: 2 browser windows, dragged objects in one window, verified smooth cursor movement visible in the other window throughout the entire drag operation

**Commits:**
- [482e277] Fix cursor positions across different pan/zoom viewports (includes this fix)

---

### [2026-02-17] Fix Cursor Positions Across Different Pan/Zoom Viewports

**Task:** When two users had different pan/zoom levels, cursors from other users appeared at wrong positions on screen.

**Approach:**
- Root cause: Cursors were stored in world coordinates (correct) but rendered directly as screen pixel positions (incorrect). When users had different viewport transforms, the same world coordinates mapped to different screen positions.
- Added `StageTransform` type to Board.tsx (`{ x, y, scale }`)
- Board.tsx now reports its current transform via `onTransformChange` callback after every pan/zoom operation
- CursorsOverlay converts world coordinates to screen coordinates: `screenX = worldX * scale + stageX`

**Changes:**
- `src/components/Board/Board.tsx` - Added `StageTransform` interface and `onTransformChange` prop. Reports transform after drag (pan), wheel (zoom), and zoom button operations.
- `src/components/Cursors/CursorsOverlay.tsx` - Added `stageTransform` prop, applies world-to-screen coordinate conversion when rendering cursor positions
- `src/components/Cursors/CursorsOverlay.test.tsx` - Updated tests to pass `stageTransform`, added test for coordinate transformation
- `src/App.tsx` - Added `stageTransform` state, passed to both Board and CursorsOverlay

**Challenges:**
- **Problem**: Cursor coordinates are in "world space" (the infinite canvas), but CSS rendering is in "screen space" (browser viewport pixels). With different pan/zoom, the mapping differs per user.
- **Solution**: Store cursors in world coordinates (shared across users), convert to screen coordinates locally using each user's viewport transform

**Testing:**
- Manual testing: 2 browser windows with different zoom levels and pan positions, verified cursors appear at correct locations relative to board objects

**Commit:** [482e277] Fix cursor positions across different pan/zoom viewports

---

### [2026-02-17] Force Navigation on Board Deletion

**Task:** When a user deletes a board from the dashboard, other users currently viewing that board should be forced back to the board selection screen.

**Approach:**
- Added `subscribeToBoardMetadata` function to `boardMetadataService.ts` that subscribes to a single board metadata document
- BoardView in App.tsx subscribes to the board metadata on mount; if the document becomes `null` (deleted), it calls `onNavigateBack` to return to the dashboard

**Changes:**
- `src/services/boardMetadataService.ts` - Added `subscribeToBoardMetadata(boardId, callback)` that uses Firestore `onSnapshot` on the board document, returns `null` when document doesn't exist
- `src/services/boardMetadataService.test.ts` - Added 4 tests covering subscription setup, existing doc, deleted doc, and unsubscribe
- `src/App.tsx` - BoardView subscribes to board metadata via `useEffect`, navigates back if board is deleted. Also displays board name in header.

**Challenges:**
- **Problem**: Need to distinguish between "board hasn't loaded yet" and "board was deleted" on initial load
- **Solution**: Track `isFirst` flag - on first snapshot, if board is null, navigate back (board doesn't exist). On subsequent snapshots, if board becomes null, it was deleted.

**Testing:**
- Unit tests for `subscribeToBoardMetadata`
- Manual testing: Open board in 2 browsers, delete board from dashboard in one, verify other browser navigates back

**Commit:** [bf57790] Force users back to dashboard when board is deleted

---

### [2026-02-16 Night] Multi-Board Feature with Dashboard

**Task:** Replace hardcoded single-board (`BOARD_ID = 'default-board'`) with a full multi-board system including dashboard, routing, and shareable URLs.

**Approach:**
- Implemented hash-based routing (`/#/board/{id}`) with zero dependencies
- Created board metadata service for Firestore CRUD on board documents
- Built dashboard UI with board list, create form, and delete functionality
- Any authenticated user with the URL can access any board; dashboard shows only boards created by the current user
- Guest-created boards can be deleted by any authenticated user

**Changes:**
- `src/types/board.ts` - Added `BoardMetadata` interface with `id`, `name`, `createdBy`, `createdByGuest`, `createdAt`, `updatedAt`
- `src/hooks/useRouter.ts` - Hash-based routing hook parsing `/#/board/{id}`, listens to `hashchange` events
- `src/hooks/useRouter.test.ts` - Tests for route parsing and navigation
- `src/hooks/useUserBoards.ts` - Hook for subscribing to user's boards, creating/deleting boards
- `src/hooks/useUserBoards.test.ts` - Tests for board CRUD operations
- `src/services/boardMetadataService.ts` - Firestore CRUD: `createBoard`, `deleteBoard`, `deleteBoardObjects`, `subscribeToUserBoards`
- `src/services/boardMetadataService.test.ts` - Tests for all service functions
- `src/components/Dashboard/BoardDashboard.tsx` - Main dashboard with board list, create form, sign-out
- `src/components/Dashboard/BoardDashboard.test.tsx` - Dashboard component tests
- `src/components/Dashboard/BoardCard.tsx` - Individual board card with name, date, delete button
- `src/components/Dashboard/BoardCard.test.tsx` - Board card tests
- `src/components/Dashboard/CreateBoardForm.tsx` - Board name input + submit
- `src/components/Dashboard/CreateBoardForm.test.tsx` - Form validation tests
- `src/App.tsx` - Complete rewrite: router integration, conditional rendering (loading → auth → dashboard → board), BoardView component with dynamic boardId
- `firestore.rules` - Owner-only board metadata rules, guest boards deletable by anyone

**Challenges:**
- **Problem**: Presence and cursor cleanup when navigating between boards
- **Solution**: BoardView unmounts when navigating away, which triggers cleanup effects in `usePresence` and `useCursors` automatically
- **Problem**: Anonymous users shouldn't own boards permanently
- **Solution**: Added `createdByGuest` flag; guest-created boards can be deleted by any authenticated user

**Testing:**
- 20+ unit tests across all new components, hooks, and services
- Manual testing: Create board → navigate → share URL → delete → verify presence cleanup

**Commits:**
- [4a6605f] Add multi-board feature with dashboard, routing, and owner-only delete
- [006164f] Allow any authenticated user to delete guest-created boards

---

### [2026-02-16 Night] Toolbar Refactor and Connector Enhancements

**Task:** Refactor toolbar into separate drawer components and add enhanced connector creation flow.

**Approach:**
- Extracted ColorDrawer and ShapeDrawer from monolithic Toolbar component
- Added connector preview line showing real-time connection while dragging between objects
- Improved visual feedback for connector mode (highlights, hover states)

**Changes:**
- `src/components/Toolbar/ColorDrawer.tsx` - Extracted color picker drawer for sticky note colors
- `src/components/Toolbar/ShapeDrawer.tsx` - Extracted shape selection drawer
- `src/components/Toolbar/Toolbar.tsx` - Simplified to use drawer sub-components
- `src/components/Board/PreviewConnector.tsx` - Live preview line during connector creation
- `src/components/Toolbar/Toolbar.test.tsx` - Rewritten to match refactored structure

**Commits:**
- [3c8b203] Refactor toolbar into ColorDrawer and ShapeDrawer components
- [12f4f86] Add connector preview and improve toolbar UI
- [c8cf91e] Add enhanced connector flow with visual feedback

---

### [2026-02-16 Night] Stress Tests for Performance Validation

**Task:** Add automated stress tests to validate performance targets (500+ objects, 5+ concurrent users).

**Changes:**
- `src/test/stress.test.ts` - Added stress tests verifying Firestore sync performance, RTDB cursor throughput, and object capacity targets

**Commit:** [dd12fbc] Add stress tests for performance metrics validation

---

### [2026-02-16 Night] Cursor Position Updates During Drag

**Task:** Fix cursor freezing during object drag operations - other users could see the object moving but not the cursor.

**Approach:**
- Identified that Konva drag events on Group components don't bubble to Stage's onMouseMove handler
- Created wrapper functions that call both the drag handler AND cursor update
- Applied wrappers to all draggable components (sticky notes, shapes, frames, stickers)

**Changes:**
- `src/App.tsx` - Added handleDragMoveWithCursor and handleFrameDragMoveWithCursor wrapper functions that update both object position and cursor position during drag operations

**Challenges:**
- **Problem**: During drag operations in Konva, mouse move events on the Stage don't fire because the drag is handled by the Group component
- **Solution**: Explicitly call updateCursor(x, y) within the drag move handlers to broadcast cursor position during drag

**Testing:**
- Manual testing: Open 2 browser windows, drag object in one window, verify cursor moves in real-time in the other window

**Commits:**
- [494e917] Fix cursor position updates during object dragging

---

### [2026-02-16 Late Evening] Sticker Menu Z-Index Fix

**Task:** Fix sticker emoji picker appearing hidden behind the toolbar.

**Approach:**
- Added z-index: 1001 to emoji picker (higher than toolbar's z-index: 1000)
- Increased vertical spacing from mb-3 to mb-6 for better visibility

**Changes:**
- `src/components/Toolbar/Toolbar.tsx` - Added inline style with z-index: 1001 to emoji picker div, increased margin-bottom from mb-3 to mb-6

**Challenges:**
- **Problem**: Emoji picker was rendering but invisible due to z-index stacking context
- **Solution**: Added explicit z-index higher than toolbar to ensure proper layering

**Testing:**
- Manual testing: Clicked sticker button and verified emoji picker appears above toolbar

**Commits:**
- [982405e] Fix sticker emoji picker z-index to appear above toolbar
- [e20d794] Increase sticker emoji picker vertical spacing above toolbar

---

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

### [2026-02-16 Afternoon] Initial Project Setup & Documentation

**Task:** Set up Flow Space project documentation and AI development planning.

**Approach:**
- Created AI development log template for tracking AI agent implementation
- Documented AI tool specifications (createStickyNote, deleteObject, moveObject, updateText)
- Established testing strategy (unit, integration, E2E)
- Defined performance targets and monitoring approach

**Changes:**
- `docs/AI_DEVELOPMENT_LOG.md` - Created comprehensive AI agent planning document
- `docs/AI_COST_ANALYSIS.md` - Created cost analysis for AI features
- `docs/ARCHITECTURE.md` - Documented system architecture

**Next Steps:**
- Set up Cloud Functions project structure
- Implement AI tools using TDD methodology
- Integrate Claude API with function calling

**Commits:**
- Initial documentation setup

---

**Last Updated**: 2026-02-17
**Format**: Append new entries to the top (reverse chronological)
