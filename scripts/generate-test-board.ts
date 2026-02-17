/**
 * Generate a test board with 5000 random objects
 * Usage: npx tsx scripts/generate-test-board.ts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, writeBatch, doc } from 'firebase/firestore';

// Firebase config - using environment variables or default to localhost emulator
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:123456789:web:abcdef',
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || 'http://localhost:9000/?ns=demo-project',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Object type ratios
const STICKY_RATIO = 0.4;
const SHAPE_RATIO = 0.3;
const FRAME_RATIO = 0.15;
const CONNECTOR_RATIO = 0.15;

const COLORS = {
  sticky: ['#fef08a', '#fecaca', '#bfdbfe', '#d9f99d', '#fbcfe8', '#e9d5ff'],
  shape: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
};

const SHAPE_TYPES = ['rect', 'circle', 'triangle', 'diamond'] as const;
const CONNECTOR_STYLES = ['straight', 'curved'] as const;

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStickyNote(index: number, userId: string) {
  return {
    type: 'sticky',
    x: Math.random() * 8000 - 1000,
    y: Math.random() * 8000 - 1000,
    width: 200,
    height: 200,
    rotation: 0,
    createdBy: userId,
    updatedAt: Date.now(),
    text: `Note ${index}`,
    color: randomChoice(COLORS.sticky),
  };
}

function generateShape(index: number, userId: string) {
  return {
    type: 'shape',
    x: Math.random() * 8000 - 1000,
    y: Math.random() * 8000 - 1000,
    width: 120,
    height: 120,
    rotation: 0,
    createdBy: userId,
    updatedAt: Date.now(),
    shapeType: randomChoice(SHAPE_TYPES),
    color: randomChoice(COLORS.shape),
  };
}

function generateFrame(index: number, userId: string) {
  return {
    type: 'frame',
    x: (index % 20) * 600,
    y: Math.floor(index / 20) * 500,
    width: 500,
    height: 400,
    rotation: 0,
    createdBy: userId,
    updatedAt: Date.now(),
    title: `Frame ${index}`,
  };
}

function generateConnector(index: number, objectIds: string[], userId: string) {
  if (objectIds.length < 2) {
    return null;
  }

  const fromId = randomChoice(objectIds);
  let toId = randomChoice(objectIds);
  // Ensure different objects
  while (toId === fromId && objectIds.length > 1) {
    toId = randomChoice(objectIds);
  }

  return {
    type: 'connector',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    createdBy: userId,
    updatedAt: Date.now(),
    fromId,
    toId,
    style: randomChoice(CONNECTOR_STYLES),
  };
}

async function generateTestBoard(boardName: string, objectCount: number = 5000) {
  console.log(`Creating test board "${boardName}" with ${objectCount} objects...`);

  // Create board metadata
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: boardName,
    createdBy: 'test-user',
    createdByName: 'Test User',
    createdByGuest: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.log(`Board created with ID: ${boardRef.id}`);

  const boardId = boardRef.id;
  const userId = 'test-user';

  // Calculate object counts
  const stickyCount = Math.floor(objectCount * STICKY_RATIO);
  const shapeCount = Math.floor(objectCount * SHAPE_RATIO);
  const frameCount = Math.floor(objectCount * FRAME_RATIO);
  const connectorCount = objectCount - stickyCount - shapeCount - frameCount;

  console.log(`Generating objects:`);
  console.log(`  - ${stickyCount} sticky notes`);
  console.log(`  - ${shapeCount} shapes`);
  console.log(`  - ${frameCount} frames`);
  console.log(`  - ${connectorCount} connectors`);

  const objectIds: string[] = [];
  let totalWritten = 0;

  // Firestore batch writes (max 500 operations per batch)
  const BATCH_SIZE = 500;
  let batch = writeBatch(db);
  let batchCount = 0;

  // Helper to commit batch when needed
  async function commitBatchIfNeeded() {
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  Written ${totalWritten} objects...`);
      batch = writeBatch(db);
      batchCount = 0;
    }
  }

  // Generate sticky notes
  for (let i = 0; i < stickyCount; i++) {
    const objRef = doc(collection(db, `boards/${boardId}/objects`));
    objectIds.push(objRef.id);
    batch.set(objRef, generateStickyNote(i, userId));
    batchCount++;
    totalWritten++;
    await commitBatchIfNeeded();
  }

  // Generate shapes
  for (let i = 0; i < shapeCount; i++) {
    const objRef = doc(collection(db, `boards/${boardId}/objects`));
    objectIds.push(objRef.id);
    batch.set(objRef, generateShape(i, userId));
    batchCount++;
    totalWritten++;
    await commitBatchIfNeeded();
  }

  // Generate frames
  for (let i = 0; i < frameCount; i++) {
    const objRef = doc(collection(db, `boards/${boardId}/objects`));
    objectIds.push(objRef.id);
    batch.set(objRef, generateFrame(i, userId));
    batchCount++;
    totalWritten++;
    await commitBatchIfNeeded();
  }

  // Generate connectors
  for (let i = 0; i < connectorCount; i++) {
    const connector = generateConnector(i, objectIds, userId);
    if (connector) {
      const objRef = doc(collection(db, `boards/${boardId}/objects`));
      batch.set(objRef, connector);
      batchCount++;
      totalWritten++;
      await commitBatchIfNeeded();
    }
  }

  // Commit remaining batch
  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`✓ Successfully created ${totalWritten} objects in board ${boardId}`);
  console.log(`\nBoard URL: ${process.env.VITE_APP_URL || 'http://localhost:5173'}/?board=${boardId}`);

  return boardId;
}

// Run if executed directly
if (require.main === module) {
  const boardName = process.argv[2] || 'Stress Test Board (5000 objects)';
  const objectCount = parseInt(process.argv[3]) || 5000;

  generateTestBoard(boardName, objectCount)
    .then(() => {
      console.log('\nDone!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error generating test board:', error);
      process.exit(1);
    });
}

export { generateTestBoard };
