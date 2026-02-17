# CollabBoard Development Diary

A chronological log of all development work on CollabBoard, tracking features, fixes, decisions, and learnings.

---

## Development Entries

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

**Task:** Set up CollabBoard project documentation and AI development planning.

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

**Last Updated**: 2026-02-16
**Format**: Append new entries to the top (reverse chronological)
