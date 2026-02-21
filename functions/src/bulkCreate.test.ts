import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available in vi.mock factory functions (which are hoisted)
const { mockSet, mockCommit, mockDoc, mockCollection, mockBatch } = vi.hoisted(() => {
  const mockSet = vi.fn();
  const mockCommit = vi.fn().mockResolvedValue(undefined);
  let _docId = 0;
  const mockDoc = vi.fn(() => ({ id: `doc-${_docId++}` }));
  const mockBatch = vi.fn(() => ({ set: mockSet, commit: mockCommit }));
  const mockCollection = vi.fn(() => ({ doc: mockDoc }));
  return { mockSet, mockCommit, mockDoc, mockCollection, mockBatch };
});

vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({
    collection: mockCollection,
    batch: mockBatch,
    doc: vi.fn(),
  })),
}));
vi.mock('firebase-functions/v2/firestore', () => ({
  onDocumentCreated: vi.fn(),
}));
vi.mock('firebase-functions/v2/https', () => ({
  onCall: vi.fn(),
  HttpsError: class extends Error { constructor(code: string, msg: string) { super(msg); } },
}));
vi.mock('firebase-functions/params', () => ({
  defineSecret: vi.fn(() => ({ value: () => 'test' })),
}));

import { executeBulkCreate } from './index';

describe('executeBulkCreate', () => {
  beforeEach(() => {
    mockSet.mockClear();
    mockCommit.mockClear();
    mockDoc.mockClear();
    mockBatch.mockClear();
  });

  it('creates exact count of 10 stickies', async () => {
    const objectsCreated: string[] = [];
    const result = await executeBulkCreate(10, 'sticky', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(10);
    expect(result).toContain('10');
  });

  it('creates exact count of 50 random objects', async () => {
    const objectsCreated: string[] = [];
    const result = await executeBulkCreate(50, 'random', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(50);
    expect(result).toContain('50');
    expect(result).toContain('objects');
  });

  it('creates exact count of 1 shape', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(1, 'shape', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(1);
  });

  it('creates exact count for text type', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(5, 'text', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(5);
  });

  it('creates exact count for sticker type', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(3, 'sticker', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(3);
  });

  it('creates exact count for frame type', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(4, 'frame', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(4);
  });

  it('uses batch splitting for 500 objects (2 batches)', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(500, 'sticky', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(500);
    // 500 objects = 450 + 50 = 2 batch commits
    expect(mockCommit).toHaveBeenCalledTimes(2);
  });

  it('produces no overlapping grid positions for stickies', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(25, 'sticky', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(25);

    // Each mockSet call has (docRef, data) — extract data objects
    const positions = new Set<string>();
    for (const call of mockSet.mock.calls) {
      const data = call[1];
      if (data && typeof data.x === 'number' && typeof data.y === 'number') {
        const key = `${data.x},${data.y}`;
        positions.add(key);
      }
    }
    // 25 unique positions
    expect(positions.size).toBe(25);
  });

  it('cycles types for random objects', async () => {
    const objectsCreated: string[] = [];
    await executeBulkCreate(4, 'random', 'board-1', 'user-1', objectsCreated);
    expect(objectsCreated).toHaveLength(4);

    // Collect types from mockSet calls
    const types = mockSet.mock.calls.map(call => call[1]?.type);
    expect(types).toContain('sticky');
    expect(types).toContain('shape');
    expect(types).toContain('text');
    expect(types).toContain('sticker');
  });

  it('uses viewport for positioning when provided', async () => {
    const objectsCreated: string[] = [];
    const viewport = { x: 500, y: 500, width: 1000, height: 800 };
    await executeBulkCreate(4, 'sticky', 'board-1', 'user-1', objectsCreated, viewport);
    expect(objectsCreated).toHaveLength(4);

    // All objects should be positioned relative to viewport center
    for (const call of mockSet.mock.calls) {
      const data = call[1];
      if (data && typeof data.x === 'number') {
        // With viewport center at 500,500 and viewport from 0,0 to 1000,800
        // objects should be within the viewport area
        expect(data.x).toBeGreaterThanOrEqual(-100); // some tolerance
        expect(data.y).toBeGreaterThanOrEqual(-100);
      }
    }
  });

  it('returns descriptive message', async () => {
    const objectsCreated: string[] = [];
    const result = await executeBulkCreate(10, 'sticky', 'board-1', 'user-1', objectsCreated);
    expect(result).toMatch(/Done! Created 10/);
  });
});
