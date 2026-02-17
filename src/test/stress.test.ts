/**
 * Stress Tests for CollabBoard
 *
 * Target metrics:
 * | Metric                | Target                                    |
 * |-----------------------|-------------------------------------------|
 * | Frame rate            | 60 FPS (≤16.67ms per processing cycle)    |
 * | Object sync latency   | <100ms                                    |
 * | Cursor sync latency   | <50ms                                     |
 * | Object capacity       | 500+ objects without performance drops    |
 * | Concurrent users      | 5+ without degradation                    |
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoard } from '../hooks/useBoard';
import { useCursors } from '../hooks/useCursors';
import { usePresence } from '../hooks/usePresence';
import * as boardService from '../services/boardService';
import type { AnyBoardObject } from '../services/boardService';
import type { StickyNote, Shape, Frame, CursorPosition, PresenceUser } from '../types/board';
import { findContainingFrame, getChildrenOfFrame } from '../utils/containment';
import { onValue, set } from 'firebase/database';

// ─── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../services/boardService', () => ({
  addObject: vi.fn(),
  updateObject: vi.fn(),
  deleteObject: vi.fn(),
  subscribeToBoard: vi.fn((_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
    subscribeCb = cb;
    return vi.fn();
  }),
}));

vi.mock('firebase/database', () => ({
  ref: vi.fn(() => ({ key: 'mock-ref' })),
  onValue: vi.fn(),
  set: vi.fn(),
  off: vi.fn(),
  onDisconnect: vi.fn(() => ({ remove: vi.fn() })),
  getDatabase: vi.fn(),
}));

vi.mock('../services/firebase', () => ({
  db: {},
  rtdb: {},
}));

let subscribeCb: ((objects: AnyBoardObject[]) => void) | null = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateStickyNotes(count: number): StickyNote[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `sticky-${i}`,
    type: 'sticky' as const,
    x: Math.random() * 5000,
    y: Math.random() * 5000,
    width: 200,
    height: 200,
    rotation: 0,
    createdBy: `user-${i % 10}`,
    updatedAt: Date.now(),
    text: `Note ${i}`,
    color: '#fef08a',
  }));
}

function generateShapes(count: number): Shape[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `shape-${i}`,
    type: 'shape' as const,
    x: Math.random() * 5000,
    y: Math.random() * 5000,
    width: 120,
    height: 120,
    rotation: 0,
    createdBy: `user-${i % 10}`,
    updatedAt: Date.now(),
    shapeType: 'rect' as const,
    color: '#ef4444',
  }));
}

function generateFrames(count: number): Frame[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `frame-${i}`,
    type: 'frame' as const,
    x: i * 500,
    y: i * 400,
    width: 400,
    height: 300,
    rotation: 0,
    createdBy: `user-${i % 10}`,
    updatedAt: Date.now(),
    title: `Frame ${i}`,
  }));
}

function generateMixedObjects(count: number): AnyBoardObject[] {
  const stickies = generateStickyNotes(Math.floor(count * 0.5));
  const shapes = generateShapes(Math.floor(count * 0.3));
  const frames = generateFrames(Math.floor(count * 0.2));
  return [...stickies, ...shapes, ...frames];
}

function generateCursorData(count: number, excludeUserId?: string): Record<string, CursorPosition> {
  const data: Record<string, CursorPosition> = {};
  for (let i = 0; i < count; i++) {
    const userId = `user-${i}`;
    if (userId === excludeUserId) continue;
    data[userId] = {
      userId,
      x: Math.random() * 5000,
      y: Math.random() * 5000,
      name: `User ${i}`,
      color: `#${i.toString(16).padStart(6, '0')}`,
      timestamp: Date.now(),
    };
  }
  return data;
}

function generatePresenceData(count: number): Record<string, PresenceUser> {
  const data: Record<string, PresenceUser> = {};
  for (let i = 0; i < count; i++) {
    data[`user-${i}`] = {
      uid: `user-${i}`,
      displayName: `User ${i}`,
      email: `user${i}@test.com`,
      color: `#${i.toString(16).padStart(6, '0')}`,
      online: true,
      lastSeen: Date.now(),
    };
  }
  return data;
}

// 16.67ms budget for 60 FPS
const FRAME_BUDGET_MS = 16.67;

// ─── Test Suites ────────────────────────────────────────────────────────────

describe('Stress Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    subscribeCb = null;
    vi.mocked(boardService.subscribeToBoard).mockImplementation(
      (_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
        subscribeCb = cb;
        return vi.fn();
      },
    );
  });

  // ─── Object Capacity: 500+ objects ──────────────────────────────────────

  describe('Object Capacity (500+ objects)', () => {
    it('useBoard processes 500 objects within frame budget', () => {
      const { result } = renderHook(() => useBoard('board-1', 'user-1'));
      const objects = generateMixedObjects(500);

      const start = performance.now();
      act(() => {
        subscribeCb?.(objects);
      });
      const elapsed = performance.now() - start;

      expect(result.current.objects).toHaveLength(500);
      expect(elapsed).toBeLessThan(100); // State update should be fast
    });

    it('useBoard processes 1000 objects without failure', () => {
      const { result } = renderHook(() => useBoard('board-1', 'user-1'));
      const objects = generateMixedObjects(1000);

      act(() => {
        subscribeCb?.(objects);
      });

      expect(result.current.objects).toHaveLength(1000);
    });

    it('type filtering of 500 objects completes within frame budget', () => {
      const objects = generateMixedObjects(500);

      const start = performance.now();
      const stickies = objects.filter((o): o is StickyNote => o.type === 'sticky');
      const shapes = objects.filter((o): o is Shape => o.type === 'shape');
      const frames = objects.filter((o): o is Frame => o.type === 'frame');
      const elapsed = performance.now() - start;

      expect(stickies.length + shapes.length + frames.length).toBe(500);
      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('containment check across 500 objects with 100 frames completes within frame budget', () => {
      const frames = generateFrames(100);
      const stickies = generateStickyNotes(400).map((s, i) => ({
        ...s,
        // Place some inside frames
        x: frames[i % 100].x + 50,
        y: frames[i % 100].y + 50,
      }));

      const start = performance.now();
      for (const sticky of stickies) {
        findContainingFrame(sticky, frames);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('getChildrenOfFrame with 500 objects completes within frame budget', () => {
      const frames = generateFrames(50);
      const objects: AnyBoardObject[] = [
        ...frames,
        ...generateStickyNotes(450).map((s, i) => ({
          ...s,
          parentId: `frame-${i % 50}`,
        })),
      ];

      const start = performance.now();
      for (const frame of frames) {
        getChildrenOfFrame(frame.id, objects);
      }
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });
  });

  // ─── Object Sync Latency: <100ms ───────────────────────────────────────

  describe('Object Sync Latency (<100ms)', () => {
    it('addObject call completes within latency budget', async () => {
      vi.mocked(boardService.addObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      const start = performance.now();
      act(() => {
        result.current.addStickyNote(100, 100);
      });
      const elapsed = performance.now() - start;

      expect(boardService.addObject).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(100);
    });

    it('moveObject call completes within latency budget', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      const start = performance.now();
      act(() => {
        result.current.moveObject('obj-1', 200, 300);
      });
      const elapsed = performance.now() - start;

      expect(boardService.updateObject).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(100);
    });

    it('50 rapid sequential updates complete within 100ms each', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        act(() => {
          result.current.moveObject(`obj-${i}`, i * 10, i * 10);
        });
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(100);
      }

      expect(boardService.updateObject).toHaveBeenCalledTimes(50);
    });

    it('removeObject with 500 objects (connector cleanup) completes within 100ms', () => {
      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      const objects: AnyBoardObject[] = [
        ...generateStickyNotes(450),
        // 50 connectors referencing sticky-0
        ...Array.from({ length: 50 }, (_, i) => ({
          id: `conn-${i}`,
          type: 'connector' as const,
          x: 0, y: 0, width: 0, height: 0, rotation: 0,
          createdBy: 'user-1',
          updatedAt: Date.now(),
          fromId: 'sticky-0',
          toId: `sticky-${i + 1}`,
          style: 'straight' as const,
        })),
      ];

      act(() => {
        subscribeCb?.(objects);
      });

      const start = performance.now();
      act(() => {
        result.current.removeObject('sticky-0');
      });
      const elapsed = performance.now() - start;

      // Should delete the sticky + all 50 connectors
      expect(boardService.deleteObject).toHaveBeenCalledTimes(51);
      expect(elapsed).toBeLessThan(100);
    });

    it('subscription update with 500 objects processes within 100ms', () => {
      const { result } = renderHook(() => useBoard('board-1', 'user-1'));
      const objects = generateMixedObjects(500);

      const start = performance.now();
      act(() => {
        subscribeCb?.(objects);
      });
      const elapsed = performance.now() - start;

      expect(result.current.objects).toHaveLength(500);
      expect(elapsed).toBeLessThan(100);
    });
  });

  // ─── Cursor Sync Latency: <50ms ───────────────────────────────────────

  describe('Cursor Sync Latency (<50ms)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('cursor update call dispatches within 50ms', () => {
      vi.mocked(onValue).mockReturnValue(vi.fn() as never);

      const { result } = renderHook(() =>
        useCursors('board-1', 'user-1', 'Test', '#ff0000'),
      );

      const start = performance.now();
      act(() => {
        result.current.updateCursor(100, 200);
      });
      const elapsed = performance.now() - start;

      expect(set).toHaveBeenCalled();
      expect(elapsed).toBeLessThan(50);
    });

    it('processing 10 concurrent cursor positions completes within 50ms', () => {
      const cursorData = generateCursorData(10, 'user-0');

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        (callback as (snap: { val: () => typeof cursorData }) => void)({
          val: () => cursorData,
        });
        return vi.fn() as never;
      });

      const start = performance.now();
      const { result } = renderHook(() =>
        useCursors('board-1', 'user-0', 'Test', '#ff0000'),
      );
      const elapsed = performance.now() - start;

      expect(result.current.cursors.length).toBeGreaterThanOrEqual(9);
      expect(elapsed).toBeLessThan(50);
    });

    it('cursor filtering with stale detection across 20 users completes within 50ms', () => {
      const now = Date.now();
      const cursorData: Record<string, CursorPosition> = {};

      for (let i = 0; i < 20; i++) {
        cursorData[`user-${i}`] = {
          userId: `user-${i}`,
          x: Math.random() * 5000,
          y: Math.random() * 5000,
          name: `User ${i}`,
          color: '#ff0000',
          // Half are stale
          timestamp: i % 2 === 0 ? now : now - 10000,
        };
      }

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        (callback as (snap: { val: () => typeof cursorData }) => void)({
          val: () => cursorData,
        });
        return vi.fn() as never;
      });

      const start = performance.now();
      const { result } = renderHook(() =>
        useCursors('board-1', 'user-99', 'Me', '#000'),
      );
      const elapsed = performance.now() - start;

      // Should have ~10 active cursors (the even-indexed ones with fresh timestamps)
      expect(result.current.cursors.length).toBe(10);
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ─── Concurrent Users: 5+ without degradation ─────────────────────────

  describe('Concurrent Users (5+ without degradation)', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('presence system handles 10 concurrent users within frame budget', () => {
      const presenceData = generatePresenceData(10);

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        (callback as (snap: { val: () => typeof presenceData }) => void)({
          val: () => presenceData,
        });
        return vi.fn() as never;
      });

      const start = performance.now();
      const { result } = renderHook(() =>
        usePresence('board-1', 'user-0', 'User 0', 'user0@test.com'),
      );
      const elapsed = performance.now() - start;

      expect(result.current.onlineUsers.length).toBe(10);
      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('presence system handles 50 concurrent users without failure', () => {
      const presenceData = generatePresenceData(50);

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        (callback as (snap: { val: () => typeof presenceData }) => void)({
          val: () => presenceData,
        });
        return vi.fn() as never;
      });

      const { result } = renderHook(() =>
        usePresence('board-1', 'user-0', 'User 0', 'user0@test.com'),
      );

      expect(result.current.onlineUsers.length).toBe(50);
    });

    it('5 users making simultaneous object updates all process within 100ms', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      // Simulate 5 user hooks
      const hooks = Array.from({ length: 5 }, (_, i) =>
        renderHook(() => useBoard('board-1', `user-${i}`)),
      );

      const objects = generateMixedObjects(200);
      act(() => {
        subscribeCb?.(objects);
      });

      // Each user moves an object simultaneously
      const start = performance.now();
      for (let i = 0; i < 5; i++) {
        act(() => {
          hooks[i].result.current.moveObject(`sticky-${i}`, i * 100, i * 100);
        });
      }
      const elapsed = performance.now() - start;

      expect(boardService.updateObject).toHaveBeenCalledTimes(5);
      expect(elapsed).toBeLessThan(100);
    });

    it('board subscription update with 5 users and 500 objects processes within 100ms', () => {
      const callbacks: ((objects: AnyBoardObject[]) => void)[] = [];
      vi.mocked(boardService.subscribeToBoard).mockImplementation(
        (_boardId: string, cb: (objects: AnyBoardObject[]) => void) => {
          callbacks.push(cb);
          return vi.fn();
        },
      );

      const hooks = Array.from({ length: 5 }, (_, i) =>
        renderHook(() => useBoard('board-1', `user-${i}`)),
      );

      const objects = generateMixedObjects(500);

      const start = performance.now();
      act(() => {
        for (const cb of callbacks) {
          cb(objects);
        }
      });
      const elapsed = performance.now() - start;

      // All hooks should see the same objects
      for (const hook of hooks) {
        expect(hook.result.current.objects).toHaveLength(500);
      }
      expect(elapsed).toBeLessThan(100);
    });

    it('cursor system handles 5+ simultaneous cursor streams', () => {
      const cursorData = generateCursorData(8);

      vi.mocked(onValue).mockImplementation((_ref, callback) => {
        (callback as (snap: { val: () => typeof cursorData }) => void)({
          val: () => cursorData,
        });
        return vi.fn() as never;
      });

      const start = performance.now();
      const { result } = renderHook(() =>
        useCursors('board-1', 'user-99', 'Me', '#000'),
      );
      const elapsed = performance.now() - start;

      expect(result.current.cursors.length).toBe(8);
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ─── Frame Rate: 60 FPS processing budget ─────────────────────────────

  describe('Frame Rate (60 FPS processing budget)', () => {
    it('object type filtering of 500 objects fits within single frame', () => {
      const objects = generateMixedObjects(500);

      const start = performance.now();
      const stickies = objects.filter((o): o is StickyNote => o.type === 'sticky');
      const shapes = objects.filter((o): o is Shape => o.type === 'shape');
      const frames = objects.filter((o): o is Frame => o.type === 'frame');
      const connectors = objects.filter((o) => o.type === 'connector');
      const stickers = objects.filter((o) => o.type === 'sticker');
      const elapsed = performance.now() - start;

      expect(stickies.length + shapes.length + frames.length + connectors.length + stickers.length).toBe(500);
      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('frame containment detection during drag with 100 frames fits within single frame', () => {
      const frames = generateFrames(100);
      const draggedObj: StickyNote = {
        id: 'dragged',
        type: 'sticky',
        x: 250,
        y: 200,
        width: 100,
        height: 100,
        rotation: 0,
        createdBy: 'user-1',
        updatedAt: Date.now(),
        text: '',
        color: '#fef08a',
      };

      const start = performance.now();
      // Simulate 60 drag move containment checks (1 second of dragging)
      for (let i = 0; i < 60; i++) {
        draggedObj.x = i * 50;
        draggedObj.y = i * 40;
        findContainingFrame(draggedObj, frames);
      }
      const elapsed = performance.now() - start;

      // 60 checks should complete well within 1 second (16.67ms each)
      expect(elapsed).toBeLessThan(1000);
      // Average per check should be within frame budget
      expect(elapsed / 60).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('processing a rapid burst of 60 state updates (1 second at 60fps)', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));
      const objects = generateMixedObjects(200);
      act(() => {
        subscribeCb?.(objects);
      });

      const start = performance.now();
      for (let i = 0; i < 60; i++) {
        act(() => {
          result.current.moveObject(`sticky-${i % 100}`, i * 10, i * 10);
        });
      }
      const elapsed = performance.now() - start;

      expect(boardService.updateObject).toHaveBeenCalledTimes(60);
      // All 60 updates within 1 second
      expect(elapsed).toBeLessThan(1000);
    });

    it('frame drag with 20 children: move + offset calculation within frame budget', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      const frame: Frame = {
        id: 'frame-0', type: 'frame',
        x: 100, y: 100, width: 800, height: 600,
        rotation: 0, createdBy: 'user-1', updatedAt: Date.now(), title: 'Big Frame',
      };
      const children = generateStickyNotes(20).map((s) => ({
        ...s,
        parentId: 'frame-0',
        x: 150 + Math.random() * 700,
        y: 150 + Math.random() * 500,
      }));
      const objects: AnyBoardObject[] = [frame, ...children];

      act(() => {
        subscribeCb?.(objects);
      });

      const start = performance.now();
      act(() => {
        result.current.handleFrameDragMove('frame-0', 200, 200);
      });
      const elapsed = performance.now() - start;

      expect(result.current.frameDragOffset).not.toBeNull();
      expect(elapsed).toBeLessThan(FRAME_BUDGET_MS);
    });

    it('frame drag end persists 20 children positions within 100ms', () => {
      vi.mocked(boardService.updateObject).mockResolvedValue(undefined);

      const { result } = renderHook(() => useBoard('board-1', 'user-1'));

      const frame: Frame = {
        id: 'frame-0', type: 'frame',
        x: 100, y: 100, width: 800, height: 600,
        rotation: 0, createdBy: 'user-1', updatedAt: Date.now(), title: 'Big Frame',
      };
      const children = generateStickyNotes(20).map((s) => ({
        ...s,
        parentId: 'frame-0',
      }));
      const objects: AnyBoardObject[] = [frame, ...children];

      act(() => {
        subscribeCb?.(objects);
      });

      // Start drag to initialize ref
      act(() => {
        result.current.handleFrameDragMove('frame-0', 200, 200);
      });
      vi.mocked(boardService.updateObject).mockClear();

      const start = performance.now();
      act(() => {
        result.current.handleFrameDragEnd('frame-0', 200, 200);
      });
      const elapsed = performance.now() - start;

      // frame + 20 children = 21 updates
      expect(boardService.updateObject).toHaveBeenCalledTimes(21);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
