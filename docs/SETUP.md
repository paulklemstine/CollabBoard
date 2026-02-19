# Flow Space Setup Guide

A comprehensive guide to setting up the Flow Space real-time collaborative whiteboard application.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Initial Setup](#initial-setup)
- [Firebase Configuration](#firebase-configuration)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Git**
- **Firebase CLI** (`npm install -g firebase-tools`)

### Verify Prerequisites

```bash
node --version    # Should be v18+
npm --version     # Should be v9+
firebase --version
git --version
```

## Initial Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CollabBoard
```

### 2. Install Dependencies

```bash
npm install
```

This will install all frontend dependencies including:
- React 19 with TypeScript
- Vite (build tool)
- react-konva (canvas rendering)
- Firebase SDK
- Vitest (testing framework)
- Tailwind CSS

### 3. Install Firebase Functions Dependencies (if applicable)

```bash
cd functions
npm install
cd ..
```

## Firebase Configuration

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter project name (e.g., "collabboard-prod")
4. Enable Google Analytics (optional)
5. Create the project

### 2. Enable Required Firebase Services

#### Enable Firestore Database
1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Start in **production mode**
4. Choose a location (select closest to your users)
5. Click "Enable"

#### Enable Realtime Database
1. In Firebase Console, go to **Realtime Database**
2. Click "Create Database"
3. Start in **locked mode**
4. Choose a location
5. Click "Enable"

#### Enable Authentication
1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Go to "Sign-in method" tab
4. Enable **Google** provider
   - Add your email as authorized domain
5. Enable **Anonymous** provider

#### Enable Cloud Functions (Optional - for AI features)
1. In Firebase Console, go to **Functions**
2. Click "Get started"
3. Upgrade to **Blaze plan** (pay-as-you-go, required for Cloud Functions)

### 3. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click the **Web** icon (`</>`)
4. Register your app with a nickname (e.g., "CollabBoard Web")
5. Copy the `firebaseConfig` object - you'll need these values for environment variables

### 4. Firebase CLI Login

```bash
firebase login
```

This will open a browser window for authentication.

### 5. Link Project to Firebase

```bash
firebase use --add
```

Select your Firebase project from the list and give it an alias (e.g., "default" or "prod").

## Environment Variables

### 1. Create `.env` File

Create a `.env` file in the project root:

```bash
touch .env
```

### 2. Add Firebase Configuration

Add the following variables to your `.env` file (replace with your actual Firebase config values):

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com

# Development Settings
VITE_USE_EMULATORS=false

# AI Configuration (Optional - for Cloud Functions)
ANTHROPIC_API_KEY=your-anthropic-api-key-here
```

## Local Development

### Option 1: Development with Production Firebase

Use this for quick setup or when testing with real data:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Option 2: Development with Firebase Emulators (Recommended)

Use this for isolated development and testing:

#### 1. Set Up Emulators

```bash
firebase init emulators
```

Select:
- Firestore Emulator (port 8080)
- Realtime Database Emulator (port 9000)
- Authentication Emulator (port 9099)
- Functions Emulator (port 5001, if using Cloud Functions)

#### 2. Update `.env` for Emulators

```env
VITE_USE_EMULATORS=true
```

#### 3. Start Emulators

In a separate terminal:

```bash
firebase emulators:start
```

The Emulator UI will be available at `http://localhost:4000`

#### 4. Start Dev Server

```bash
npm run dev
```

### Development Workflow

1. **Start Firebase Emulators** (if using): `firebase emulators:start`
2. **Start Dev Server**: `npm run dev`
3. **Run Tests in Watch Mode**: `npm run test:watch` (in another terminal)
4. Make changes - Vite will hot-reload automatically
5. Write tests first (TDD approach - see [CLAUDE.md](CLAUDE.md))

## Testing

This project follows Test-Driven Development (TDD). See [CLAUDE.md](CLAUDE.md) for detailed testing guidelines.

### Run All Tests

```bash
npm test
```

### Watch Mode (Recommended for Development)

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test src/components/Board/FrameComponent.test.tsx
```

### Testing with Firebase Emulators

```bash
# Start emulators
firebase emulators:start

# In another terminal, run tests
VITE_USE_EMULATORS=true npm test
```

### E2E Tests (Future)

```bash
npm run test:e2e
```

## Deployment

### 1. Build the Application

```bash
npm run build
```

This creates optimized production files in the `dist/` directory.

### 2. Test Production Build Locally

```bash
npm run preview
```

### 3. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### 4. Deploy Everything (Hosting + Firestore Rules + Database Rules + Functions)

```bash
firebase deploy
```

### 5. Deploy Specific Services

```bash
# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Deploy only Realtime Database rules
firebase deploy --only database

# Deploy only Cloud Functions
firebase deploy --only functions

# Deploy multiple services
firebase deploy --only hosting,firestore:rules
```

### CI/CD Deployment

For automated deployments, use Firebase GitHub Actions:

```bash
firebase init hosting:github
```

This sets up GitHub Actions workflows for automatic deployment on push to main branch.

## Troubleshooting

### Issue: "Firebase: Error (auth/invalid-api-key)"

**Solution:** Check that `VITE_FIREBASE_API_KEY` in `.env` is correct and matches your Firebase project settings.

### Issue: Vite not finding environment variables

**Solution:**
- Ensure `.env` file is in the project root
- Restart the dev server after changing `.env`
- Environment variables must start with `VITE_` to be accessible in the browser

### Issue: "Firebase: No Firebase App '[DEFAULT]' has been created"

**Solution:** Check that [firebase.ts](src/services/firebase.ts) is being imported before any Firebase service usage.

### Issue: Emulators won't start

**Solution:**
```bash
# Kill processes on emulator ports
# On macOS/Linux:
lsof -ti:8080 | xargs kill -9
lsof -ti:9000 | xargs kill -9
lsof -ti:9099 | xargs kill -9

# On Windows:
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Issue: Tests failing with Canvas errors

**Solution:**
- Ensure `vitest-canvas-mock` is installed
- Check that [src/test/setup.ts](src/test/setup.ts) is properly configured
- The mock is already set up in [vite.config.ts:15](vite.config.ts#L15)

### Issue: Firestore permission denied

**Solution:**
- Check that you're authenticated: `firebase login`
- Verify [firestore.rules](firestore.rules) allows your operations
- If using emulators, ensure `VITE_USE_EMULATORS=true`

### Issue: Real-time updates not working

**Solution:**
- Check browser console for WebSocket connection errors
- Verify Firestore/RTDB listeners are properly attached (see `useBoard`, `useCursors`, `usePresence` hooks)
- Ensure you're not hitting Firestore quota limits (check Firebase Console)

### Issue: Hot reload not working in Vite

**Solution:**
- Check [vite.config.ts:8-10](vite.config.ts#L8-L10) - polling is enabled for compatibility
- Try `npm run dev` with `--host` flag: `npm run dev -- --host`
- Clear Vite cache: `rm -rf node_modules/.vite`

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Vite Documentation](https://vite.dev/)
- [React Konva Documentation](https://konvajs.org/docs/react/)
- [Vitest Documentation](https://vitest.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Project Structure

```
CollabBoard/
├── src/
│   ├── components/      # React components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Firebase config & services
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── test/            # Test setup files
├── functions/           # Firebase Cloud Functions (AI agent)
├── envsetup/            # Environment variable encryption scripts
├── public/              # Static assets
├── dist/                # Production build output (generated)
├── firebase.json        # Firebase configuration
├── firestore.rules      # Firestore security rules
├── database.rules.json  # Realtime Database security rules
├── vite.config.ts       # Vite & Vitest configuration
├── CLAUDE.md            # Project instructions & conventions
└── package.json         # Dependencies & scripts
```

## Next Steps

1. Review [CLAUDE.md](CLAUDE.md) for project conventions and TDD workflow
2. Explore the codebase starting with [src/App.tsx](src/App.tsx)
3. Run the app locally and test real-time collaboration with multiple browser windows
4. Write your first test and feature following TDD principles
5. Deploy to Firebase Hosting when ready

## Getting Help

- Check existing tests for examples: `*.test.tsx` files
- Review component implementations in [src/components/](src/components/)
- Check Firebase Console for service status and logs
- Review Git commit history for implementation examples

Happy coding!
