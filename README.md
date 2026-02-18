# CollabBoard

A real-time collaborative whiteboard where multiple users create, edit, and organize content together on an infinite canvas.

**Live Demo**: [collabboard-ba094.web.app](https://collabboard-ba094.web.app)

## Features

### Canvas & Objects
- **Infinite canvas** with smooth pan and zoom
- **Sticky notes** with editable text, custom colors, rotation, and resizing
- **Shapes** (rectangles, circles, lines) with color picker, rotation, and resizing
- **Frames** for grouping and organizing content with drag-and-drop containment
- **Connectors** between objects with live preview during creation
- **Rotation handles** for all objects with visual rotation cursor feedback
- **Rotation-aware scaling** that preserves object centers during resize

### Multi-Select & Group Operations
- **Multi-select** via Shift+click or drag-to-select rectangle
- **Group drag** to move multiple objects together
- **Group resize** with live transform preview
- **Group rotate** with live transform preview around selection center
- **Selection box** with visual handles for group transformations

### Real-Time Collaboration
- **Real-time sync** across all connected users (<100ms latency)
- **Multiplayer cursors** with name labels, accurate across different viewports
- **Predictive interpolation** for smooth cursor and object movement (compensates for network latency)
- **Presence awareness** showing who's currently online with heartbeat monitoring
- **Cursor smoothing** using velocity-based prediction and exponential smoothing

### AI Assistant
- **AI board agent** powered by Claude Sonnet 4.5 with function calling
- **Natural language commands** to create objects, frames, and layouts
- **Firestore-triggered Cloud Function** for AI processing
- **Frame-child attachment** with automatic coordinate calculation

### Board Management
- **Multi-board support** with dashboard, create/delete, and shareable URLs
- **Authentication** via Google, email/password, or guest access with auto-generated names
- **Board deletion detection** (users are redirected if a board is deleted)
- **Hash-based routing** for shareable board URLs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Canvas | Konva.js / react-konva |
| Styling | Tailwind CSS |
| Board Objects | Firebase Firestore (real-time listeners) |
| Cursors & Presence | Firebase Realtime Database |
| Auth | Firebase Auth (Google, Email/Password, Anonymous) |
| AI Agent | Firebase Cloud Functions v2 + Anthropic Claude Sonnet 4.5 |
| Hosting | Firebase Hosting |
| Testing | Vitest + React Testing Library |

## Quick Start

### Prerequisites

- Node.js v18+
- npm v9+
- Firebase CLI (`npm install -g firebase-tools`)

### Setup

```bash
git clone https://github.com/paulklemstine/CollabBoard.git
cd CollabBoard
npm install
```

Create a `.env` file in the project root:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
```

### Development

```bash
npm run dev
```

Open `http://localhost:5173` in your browser. Open a second browser window to test real-time collaboration.

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Build & Deploy

```bash
npm run build
firebase deploy --only hosting
```

## Architecture

```
Browser ──Firebase SDK──┬── Firestore (board metadata + objects)
                        ├── Realtime DB (cursors + presence)
                        └── Firebase Auth
```

- **Dual database**: Firestore for structured board data, RTDB for low-latency ephemeral data (cursors <50ms, presence with heartbeat)
- **Client-side writes**: No REST API; security enforced via Firestore/RTDB rules
- **Hash-based routing**: `/#/board/{id}` for shareable board URLs, zero dependencies
- **Last-write-wins**: Object-level conflict resolution via Firestore timestamps

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full technical overview.

## Project Structure

```
src/
├── components/
│   ├── Auth/          # Login/signup (Google, Email, Guest)
│   ├── Board/         # Canvas: sticky notes, shapes, frames, connectors, selection overlay
│   ├── Cursors/       # Multiplayer cursor overlay with interpolation
│   ├── Dashboard/     # Board list, create form, board cards
│   ├── Presence/      # Online users panel
│   └── Toolbar/       # Object creation tools, color picker, shape drawer
├── hooks/             # useAuth, useBoard, useCursors, usePresence, useRouter, useUserBoards, useMultiSelect
├── services/          # Firebase config, board CRUD, auth, board metadata, AI client
├── types/             # TypeScript interfaces
├── utils/             # Containment logic, auth error messages, interpolation, group transforms, selection math
└── functions/         # Cloud Functions for AI agent
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, component hierarchy |
| [SETUP.md](docs/SETUP.md) | Detailed setup and deployment guide |
| [AI_DEVELOPMENT_LOG.md](docs/AI_DEVELOPMENT_LOG.md) | Engineering diary |
| [AI_COST_ANALYSIS.md](docs/AI_COST_ANALYSIS.md) | Cost projections for AI features |
| [PRESENCE_HEARTBEAT.md](docs/PRESENCE_HEARTBEAT.md) | Presence and cursor timeout systems |
| [INTERPOLATION.md](docs/INTERPOLATION.md) | Predictive interpolation system for smooth movement |
| [PRD.md](docs/PRD.md) | Product requirements document |
| [PRE-SEARCH.md](docs/PRE-SEARCH.md) | Architecture decisions and tradeoffs |

## Key Design Decisions

- **Konva.js over PixiJS**: Higher-level API with React integration; 500 objects at 60 FPS is achievable
- **Firebase RTDB for cursors**: `onDisconnect()` + <50ms latency vs Firestore's ~100ms
- **No CRDT/OT**: Last-write-wins is sufficient at object-level granularity for whiteboard use cases
- **Native DOM mousemove**: Konva suppresses Stage events during drag; native listener ensures cursor updates during drag operations
- **World-coordinate cursors**: Stored in world space, converted to screen space locally per viewport
- **Predictive interpolation**: Velocity-based prediction + exponential smoothing compensates for network latency
- **Live transform previews**: Group transformations update local state during drag, persist only on dragEnd
- **Absolute coordinates**: All object positions are in absolute canvas coordinates, not relative to parent frames
- **Selection box center pivot**: All group transformations use selection box center as the pivot point

## License

MIT
