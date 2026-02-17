# CollabBoard

A real-time collaborative whiteboard where multiple users create, edit, and organize content together on an infinite canvas.

**Live Demo**: [collabboard-ba094.web.app](https://collabboard-ba094.web.app)

## Features

- **Infinite canvas** with smooth pan and zoom
- **Sticky notes** with editable text and custom colors
- **Shapes** (rectangles, circles) with color picker
- **Frames** for grouping and organizing content (drag-and-drop containment)
- **Connectors** between objects with live preview during creation
- **Real-time sync** across all connected users (<100ms latency)
- **Multiplayer cursors** with name labels, accurate across different viewports
- **Presence awareness** showing who's currently online
- **Multi-board support** with dashboard, create/delete, and shareable URLs
- **Authentication** via Google, email/password, or guest access
- **Board deletion detection** (users are redirected if a board is deleted)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Canvas | Konva.js / react-konva |
| Styling | Tailwind CSS |
| Board Objects | Firebase Firestore (real-time listeners) |
| Cursors & Presence | Firebase Realtime Database |
| Auth | Firebase Auth (Google, Email/Password, Anonymous) |
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
│   ├── Board/         # Canvas: sticky notes, shapes, frames, connectors
│   ├── Cursors/       # Multiplayer cursor overlay
│   ├── Dashboard/     # Board list, create form, board cards
│   ├── Presence/      # Online users panel
│   └── Toolbar/       # Object creation tools
├── hooks/             # useAuth, useBoard, useCursors, usePresence, useRouter, useUserBoards
├── services/          # Firebase config, board CRUD, auth, board metadata
├── types/             # TypeScript interfaces
└── utils/             # Containment logic, auth error messages
```

## Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data model, component hierarchy |
| [SETUP.md](docs/SETUP.md) | Detailed setup and deployment guide |
| [AI_DEVELOPMENT_LOG.md](docs/AI_DEVELOPMENT_LOG.md) | Engineering diary |
| [AI_COST_ANALYSIS.md](docs/AI_COST_ANALYSIS.md) | Cost projections for AI features |
| [PRESENCE_HEARTBEAT.md](docs/PRESENCE_HEARTBEAT.md) | Presence and cursor timeout systems |
| [PRD.md](docs/PRD.md) | Product requirements document |
| [PRE-SEARCH.md](docs/PRE-SEARCH.md) | Architecture decisions and tradeoffs |

## Key Design Decisions

- **Konva.js over PixiJS**: Higher-level API with React integration; 500 objects at 60 FPS is achievable
- **Firebase RTDB for cursors**: `onDisconnect()` + <50ms latency vs Firestore's ~100ms
- **No CRDT/OT**: Last-write-wins is sufficient at object-level granularity for whiteboard use cases
- **Native DOM mousemove**: Konva suppresses Stage events during drag; native listener ensures cursor updates during drag operations
- **World-coordinate cursors**: Stored in world space, converted to screen space locally per viewport

## License

MIT
