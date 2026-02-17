# CollabBoard - Product Requirements Document

## 1. Product Overview

**Product Name:** CollabBoard
**Type:** Real-time collaborative whiteboard with AI agent integration
**Timeline:** 7-day sprint (MVP in 24 hours)
**Goal:** Build a production-scale collaborative whiteboard with real-time multiplayer sync and an AI agent that manipulates the board via natural language commands.

---

## 2. Project Milestones

| Checkpoint | Deadline | Focus |
|---|---|---|
| Pre-Search | Monday (hour 1) | Architecture decisions, stack selection |
| MVP | Tuesday (24 hours) | Core collaborative infrastructure |
| Early Submission | Friday (4 days) | Full feature set |
| Final | Sunday (7 days) | Polish, documentation, deployment |

---

## 3. MVP Requirements (24-Hour Hard Gate)

All items are **required** to pass the MVP checkpoint:

- [ ] Infinite board with pan/zoom
- [ ] Sticky notes with editable text
- [ ] At least one shape type (rectangle, circle, or line)
- [ ] Create, move, and edit objects
- [ ] Real-time sync between 2+ users
- [ ] Multiplayer cursors with name labels
- [ ] Presence awareness (who's online)
- [ ] User authentication
- [ ] Deployed and publicly accessible

> *"A simple whiteboard with bulletproof multiplayer beats a feature-rich board with broken sync."*

---

## 4. Core Features

### 4.1 Board Features

| Feature | Requirements | Priority |
|---|---|---|
| Workspace | Infinite board with smooth pan/zoom | MVP |
| Sticky Notes | Create, edit text, change colors | MVP |
| Shapes | Rectangles, circles, lines with solid colors | MVP (1 shape), Full (all) |
| Connectors | Lines/arrows connecting objects | Full |
| Text | Standalone text elements | Full |
| Frames | Group and organize content areas | Full |
| Transforms | Move, resize, rotate objects | MVP (move), Full (all) |
| Selection | Single and multi-select (shift-click, drag-to-select) | Full |
| Operations | Delete, duplicate, copy/paste | Full |

### 4.2 Real-Time Collaboration

| Feature | Requirements | Priority |
|---|---|---|
| Cursors | Multiplayer cursors with names, real-time movement | MVP |
| Sync | Object creation/modification appears instantly for all users | MVP |
| Presence | Clear indication of who's currently on the board | MVP |
| Conflicts | Handle simultaneous edits (last-write-wins acceptable) | MVP |
| Resilience | Graceful disconnect/reconnect handling | Full |
| Persistence | Board state survives all users leaving and returning | Full |

### 4.3 AI Board Agent

The AI agent must support **at least 6 distinct commands** across these categories:

#### Creation Commands
- "Add a yellow sticky note that says 'User Research'"
- "Create a blue rectangle at position 100, 200"
- "Add a frame called 'Sprint Planning'"

#### Manipulation Commands
- "Move all the pink sticky notes to the right side"
- "Resize the frame to fit its contents"
- "Change the sticky note color to green"

#### Layout Commands
- "Arrange these sticky notes in a grid"
- "Create a 2x3 grid of sticky notes for pros and cons"
- "Space these elements evenly"

#### Complex Commands
- "Create a SWOT analysis template with four quadrants"
- "Build a user journey map with 5 stages"
- "Set up a retrospective board with What Went Well, What Didn't, and Action Items columns"

#### AI Tool Schema (Minimum)

```
createStickyNote(text, x, y, color)
createShape(type, x, y, width, height, color)
createFrame(title, x, y, width, height)
createConnector(fromId, toId, style)
moveObject(objectId, x, y)
resizeObject(objectId, width, height)
updateText(objectId, newText)
changeColor(objectId, color)
getBoardState()  // returns current board objects for context
```

#### AI Evaluation Criteria

| Command | Expected Result |
|---|---|
| "Create a SWOT analysis" | 4 labeled quadrants (Strengths, Weaknesses, Opportunities, Threats) |
| "Arrange in a grid" | Elements aligned with consistent spacing |
| Multi-step commands | AI plans steps and executes sequentially |

#### Shared AI State
- All users see AI-generated results in real-time
- Multiple users can issue AI commands simultaneously without conflict

---

## 5. Performance Targets

| Metric | Target |
|---|---|
| Frame rate | 60 FPS during pan, zoom, object manipulation |
| Object sync latency | < 100ms |
| Cursor sync latency | < 50ms |
| Object capacity | 500+ objects without performance drops |
| Concurrent users | 5+ without degradation |
| AI response latency | < 2 seconds for single-step commands |
| AI command breadth | 6+ command types |
| AI reliability | Consistent, accurate execution |

---

## 6. Testing Scenarios

The following scenarios will be evaluated:

1. **Simultaneous editing** - 2 users editing simultaneously in different browsers
2. **State persistence** - One user refreshing mid-edit; state must persist
3. **Sync performance** - Rapid creation and movement of sticky notes and shapes
4. **Network resilience** - Network throttling and disconnection recovery
5. **Scale test** - 5+ concurrent users without degradation

---

## 7. Technical Architecture

### Recommended Stack (to be finalized via Pre-Search)

| Layer | Options |
|---|---|
| Backend | Firebase (Firestore + Realtime DB + Auth), Supabase, AWS (DynamoDB + Lambda + WebSockets), custom WebSocket server |
| Frontend | React/Vue/Svelte with Konva.js, Fabric.js, PixiJS, HTML5 Canvas |
| AI Integration | OpenAI GPT-4 or Anthropic Claude with function calling |
| Deployment | Vercel, Firebase Hosting, or Render |

### Build Priority Order

1. **Cursor sync** - Get two cursors moving across browsers
2. **Object sync** - Create sticky notes that appear for all users
3. **Conflict handling** - Handle simultaneous edits
4. **State persistence** - Survive refreshes and reconnects
5. **Board features** - Shapes, frames, connectors, transforms
6. **AI commands (basic)** - Single-step creation/manipulation
7. **AI commands (complex)** - Multi-step template generation

### Critical Architectural Guidance

- Multiplayer sync is the hardest part — start here
- Build vertically: finish one layer before starting the next
- Test with multiple browser windows continuously
- Throttle network speed during testing
- Test simultaneous AI commands from multiple users

---

## 8. Authentication & Authorization

- User authentication required for MVP
- Options: social login, magic links, email/password, SSO
- Presence system must track authenticated users on the board

---

## 9. Non-Functional Requirements

### Security
- Identify known pitfalls for chosen stack
- Avoid common misconfigurations
- Manage dependency risks

### Conflict Resolution
- Last-write-wins is acceptable for MVP
- Must document the chosen approach

### Resilience
- Graceful disconnect/reconnect
- Board state persists when all users leave and return

---

## 10. AI-First Development Requirements

### Required Tools (use at least 2)
- Claude Code
- Cursor
- Codex
- MCP integrations

### Required Deliverables

#### AI Development Log (1 page)
| Section | Content |
|---|---|
| Tools & Workflow | Which AI coding tools used, how integrated |
| MCP Usage | Which MCPs used, what they enabled |
| Effective Prompts | 3-5 prompts that worked well (include actual prompts) |
| Code Analysis | Rough % of AI-generated vs hand-written code |
| Strengths & Limitations | Where AI excelled, where it struggled |
| Key Learnings | Insights about working with coding agents |

#### AI Cost Analysis
- **Development costs:** LLM API costs, total tokens (input/output), API call count, other AI costs
- **Production projections:** Monthly cost estimates at 100 / 1,000 / 10,000 / 100,000 users
- **Assumptions:** Average AI commands per user per session, sessions per user per month, tokens per command type

---

## 11. Submission Requirements

**Deadline: Sunday 10:59 PM CT**

| Deliverable | Requirements |
|---|---|
| GitHub Repository | Setup guide, architecture overview, deployed link |
| Demo Video (3-5 min) | Real-time collaboration, AI commands, architecture explanation |
| Pre-Search Document | Completed checklist from Phase 1-3 |
| AI Development Log | 1-page breakdown using template |
| AI Cost Analysis | Dev spend + projections for 100/1K/10K/100K users |
| Deployed Application | Publicly accessible, supports 5+ users with auth |
| Social Post | Share on X or LinkedIn with description, features, demo/screenshots, tag @GauntletAI |

---

## 12. Success Criteria

### MVP Pass (24 hours)
- All 9 MVP checklist items functional
- Deployed and publicly accessible
- Real-time sync working between 2+ browsers

### Full Submission Pass (7 days)
- All board features implemented (shapes, connectors, frames, text, transforms, selection, operations)
- AI agent with 6+ command types across creation, manipulation, layout, and complex categories
- 60 FPS performance with 500+ objects
- < 100ms object sync, < 50ms cursor sync
- 5+ concurrent users supported
- All documentation deliverables complete
- Production cost analysis with scaling projections

---

## 13. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Real-time sync complexity | Blocks all features | Start with sync first; use proven solutions (Firebase Realtime DB, Liveblocks, Yjs) |
| Canvas performance at scale | Poor UX with many objects | Use virtual rendering; only draw visible objects |
| AI latency | Slow user experience | Stream responses; optimistic UI updates |
| Conflict resolution edge cases | Data corruption | Start with last-write-wins; document approach |
| Deployment issues | Can't demo | Deploy early and often; test on deployed version |

---

## 14. Out of Scope (for this sprint)

- Rich text editing within shapes
- Image/file uploads
- Version history / undo-redo across sessions
- Board permissions / sharing controls beyond auth
- Mobile-optimized touch interface
- Export to PDF/image
