import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/**
 * Integration test to verify parent-child relationships work correctly
 * when AI creates objects with parentId.
 */

describe('ParentId Integration Test', () => {
  let app: ReturnType<typeof initializeApp>;
  let db: ReturnType<typeof getFirestore>;

  beforeEach(() => {
    // Initialize Firebase Admin (using emulator if FIRESTORE_EMULATOR_HOST is set)
    app = initializeApp({ projectId: 'collabboard-test' });
    db = getFirestore(app);
  });

  afterEach(async () => {
    await deleteApp(app);
  });

  it('should store parentId when creating sticky note with parent', async () => {
    const boardId = 'test-board';
    const userId = 'test-user';

    // Simulate creating a frame first
    const frameRef = db.collection(`boards/${boardId}/objects`).doc();
    await frameRef.set({
      type: 'frame',
      title: 'Test Frame',
      x: 100,
      y: 100,
      width: 400,
      height: 300,
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      parentId: '',
    });

    // Simulate AI creating a sticky note with parentId
    const stickyRef = db.collection(`boards/${boardId}/objects`).doc();
    await stickyRef.set({
      type: 'sticky',
      text: 'Child Note',
      x: 120,  // Inside frame bounds (100 + 20)
      y: 160,  // Inside frame bounds (100 + 60, accounting for title bar)
      width: 200,
      height: 200,
      color: '#fef9c3',
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      parentId: frameRef.id,  // Set parent
    });

    // Read back and verify
    const stickyDoc = await stickyRef.get();
    const stickyData = stickyDoc.data();

    expect(stickyData).toBeDefined();
    expect(stickyData?.parentId).toBe(frameRef.id);
    expect(stickyData?.parentId).not.toBe('');
  });

  it('should store empty string for parentId when no parent', async () => {
    const boardId = 'test-board';
    const userId = 'test-user';

    // Simulate creating a sticky note without parent
    const stickyRef = db.collection(`boards/${boardId}/objects`).doc();
    await stickyRef.set({
      type: 'sticky',
      text: 'Standalone Note',
      x: 0,
      y: 0,
      width: 200,
      height: 200,
      color: '#fef9c3',
      rotation: 0,
      createdBy: userId,
      updatedAt: Date.now(),
      parentId: '',  // No parent
    });

    // Read back and verify
    const stickyDoc = await stickyRef.get();
    const stickyData = stickyDoc.data();

    expect(stickyData).toBeDefined();
    expect(stickyData?.parentId).toBe('');
  });
});
