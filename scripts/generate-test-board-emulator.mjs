/**
 * Generate a test board with 5000 random objects (using Firebase Emulator)
 *
 * Prerequisites:
 * 1. Start Firebase emulators: firebase emulators:start
 * 2. Run this script: node scripts/generate-test-board-emulator.mjs
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, writeBatch, doc, connectFirestoreEmulator } from 'firebase/firestore';

// Firebase config for emulator
const firebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo-project.firebaseapp.com',
  projectId: 'collabboard-d2f13',
  storageBucket: 'collabboard-d2f13.appspot.com',
  messagingSenderId: '123456789',
  appId: '1:123456789:web:abcdef',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
connectFirestoreEmulator(db, 'localhost', 8080);

console.log('✓ Connected to Firestore Emulator (localhost:8080)');

// Object type ratios
const STICKY_RATIO = 0.4;
const SHAPE_RATIO = 0.3;
const FRAME_RATIO = 0.15;
const CONNECTOR_RATIO = 0.15;

const COLORS = {
  sticky: ['#fef08a', '#fecaca', '#bfdbfe', '#d9f99d', '#fbcfe8', '#e9d5ff'],
  shape: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
};

const SHAPE_TYPES = ['rect', 'circle', 'triangle', 'diamond'];
const CONNECTOR_STYLES = ['straight', 'curved'];

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStickyNote(index, userId) {
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

function generateShape(index, userId) {
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

function generateFrame(index, userId) {
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

function generateConnector(index, objectIds, userId) {
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

async function generateTestBoard(boardName, objectCount = 5000) {
  console.log(`\nCreating test board "${boardName}" with ${objectCount} objects...`);

  // Create board metadata
  const boardRef = await addDoc(collection(db, 'boards'), {
    name: boardName,
    createdBy: 'test-user',
    createdByName: 'Test User',
    createdByGuest: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.log(`✓ Board created with ID: ${boardRef.id}`);

  const boardId = boardRef.id;
  const userId = 'test-user';

  // Calculate object counts
  const stickyCount = Math.floor(objectCount * STICKY_RATIO);
  const shapeCount = Math.floor(objectCount * SHAPE_RATIO);
  const frameCount = Math.floor(objectCount * FRAME_RATIO);
  const connectorCount = objectCount - stickyCount - shapeCount - frameCount;

  console.log(`\nGenerating objects:`);
  console.log(`  - ${stickyCount} sticky notes`);
  console.log(`  - ${shapeCount} shapes`);
  console.log(`  - ${frameCount} frames`);
  console.log(`  - ${connectorCount} connectors`);
  console.log('');

  const objectIds = [];
  let totalWritten = 0;

  // Firestore batch writes (max 500 operations per batch)
  const BATCH_SIZE = 500;
  let batch = writeBatch(db);
  let batchCount = 0;

  // Helper to commit batch when needed
  async function commitBatchIfNeeded() {
    if (batchCount >= BATCH_SIZE) {
      await batch.commit();
      console.log(`  ✓ Written ${totalWritten} objects...`);
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

  console.log(`\n✓ Successfully created ${totalWritten} objects in board ${boardId}`);
  console.log(`\n📋 Board URL: http://localhost:5173/?board=${boardId}`);
  console.log(`\nTo view the board:`);
  console.log(`  1. Make sure dev server is running: npm run dev`);
  console.log(`  2. Open: http://localhost:5173/?board=${boardId}`);

  return boardId;
}

// Run
const boardName = process.argv[2] || 'Performance Test - 5000 Objects';
const objectCount = parseInt(process.argv[3]) || 5000;

generateTestBoard(boardName, objectCount)
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error generating test board:', error.message);
    console.error('\nMake sure Firebase emulators are running:');
    console.error('  firebase emulators:start');
    process.exit(1);
  });
