import { describe, it, expect } from 'vitest';
import {
  getBoundingBox,
  rectanglesIntersect,
  transformGroupMove,
  transformGroupResize,
  transformGroupRotate,
} from './selectionMath';
import type { BoardObject } from '../types/board';

function makeObj(overrides: Partial<BoardObject> & { id: string }): BoardObject {
  return {
    type: 'sticky',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    createdBy: 'test',
    updatedAt: 0,
    ...overrides,
  } as BoardObject;
}

describe('getBoundingBox', () => {
  it('returns null for empty array', () => {
    expect(getBoundingBox([])).toBeNull();
  });

  it('returns bbox for a single object', () => {
    const obj = makeObj({ id: '1', x: 10, y: 20, width: 100, height: 50 });
    expect(getBoundingBox([obj])).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });

  it('returns bbox for multiple objects', () => {
    const objs = [
      makeObj({ id: '1', x: 0, y: 0, width: 50, height: 50 }),
      makeObj({ id: '2', x: 100, y: 100, width: 50, height: 50 }),
    ];
    expect(getBoundingBox(objs)).toEqual({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('handles objects with negative positions', () => {
    const objs = [
      makeObj({ id: '1', x: -50, y: -50, width: 100, height: 100 }),
      makeObj({ id: '2', x: 50, y: 50, width: 100, height: 100 }),
    ];
    expect(getBoundingBox(objs)).toEqual({ x: -50, y: -50, width: 200, height: 200 });
  });
});

describe('rectanglesIntersect', () => {
  it('returns true for overlapping rectangles', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      )
    ).toBe(true);
  });

  it('returns false for non-overlapping rectangles', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 100, y: 100, width: 50, height: 50 }
      )
    ).toBe(false);
  });

  it('returns false for edge-touching rectangles', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 50, height: 50 },
        { x: 50, y: 0, width: 50, height: 50 }
      )
    ).toBe(false);
  });

  it('returns true when one rectangle contains another', () => {
    expect(
      rectanglesIntersect(
        { x: 0, y: 0, width: 200, height: 200 },
        { x: 50, y: 50, width: 20, height: 20 }
      )
    ).toBe(true);
  });
});

describe('transformGroupMove', () => {
  it('translates all objects by dx, dy', () => {
    const objs = [
      makeObj({ id: '1', x: 10, y: 20 }),
      makeObj({ id: '2', x: 50, y: 60 }),
    ];
    const result = transformGroupMove(objs, 5, -10);
    expect(result).toEqual([
      { id: '1', updates: { x: 15, y: 10 } },
      { id: '2', updates: { x: 55, y: 50 } },
    ]);
  });
});

describe('transformGroupResize', () => {
  it('scales objects from the top-left anchor', () => {
    const objs = [
      makeObj({ id: '1', x: 0, y: 0, width: 100, height: 100 }),
      makeObj({ id: '2', x: 100, y: 0, width: 100, height: 100 }),
    ];
    const bbox = { x: 0, y: 0, width: 200, height: 100 };
    const result = transformGroupResize(objs, bbox, 2, 2, 0, 0);
    expect(result).toEqual([
      { id: '1', updates: { x: 0, y: 0, width: 200, height: 200 } },
      { id: '2', updates: { x: 200, y: 0, width: 200, height: 200 } },
    ]);
  });

  it('scales objects from a non-origin anchor', () => {
    const objs = [
      makeObj({ id: '1', x: 0, y: 0, width: 50, height: 50 }),
    ];
    const bbox = { x: 0, y: 0, width: 50, height: 50 };
    // Scale 2x from anchor at (50, 50) — the bottom-right corner
    const result = transformGroupResize(objs, bbox, 2, 2, 50, 50);
    expect(result).toEqual([
      { id: '1', updates: { x: -50, y: -50, width: 100, height: 100 } },
    ]);
  });
});

describe('transformGroupRotate', () => {
  it('rotates object positions around the bbox center', () => {
    const objs = [
      makeObj({ id: '1', x: 0, y: 0, width: 100, height: 100, rotation: 0 }),
    ];
    // bbox center is (50, 50), object center is also (50, 50) — no position change
    const bbox = { x: 0, y: 0, width: 100, height: 100 };
    const result = transformGroupRotate(objs, bbox, 45);
    expect(result[0].id).toBe('1');
    expect(result[0].updates.rotation).toBe(45);
    // Object center was at group center, so position stays the same
    expect(result[0].updates.x).toBeCloseTo(0);
    expect(result[0].updates.y).toBeCloseTo(0);
  });

  it('orbits objects around the group center', () => {
    const objs = [
      makeObj({ id: '1', x: 0, y: 0, width: 0, height: 0, rotation: 0 }),
      makeObj({ id: '2', x: 100, y: 0, width: 0, height: 0, rotation: 0 }),
    ];
    // bbox: x=0, y=0, w=100, h=0 → center at (50, 0)
    const bbox = { x: 0, y: 0, width: 100, height: 0 };
    // Rotate 90 degrees
    const result = transformGroupRotate(objs, bbox, 90);

    // obj1 center at (0,0), distance from center (50,0) is (-50, 0)
    // After 90° rotation: (50 + 0, 0 + (-50)) = (50, -50)
    expect(result[0].updates.x).toBeCloseTo(50);
    expect(result[0].updates.y).toBeCloseTo(-50);
    expect(result[0].updates.rotation).toBe(90);

    // obj2 center at (100,0), distance from center (50,0) is (50, 0)
    // After 90° rotation: (50 + 0, 0 + 50) = (50, 50)
    expect(result[1].updates.x).toBeCloseTo(50);
    expect(result[1].updates.y).toBeCloseTo(50);
    expect(result[1].updates.rotation).toBe(90);
  });

  it('accumulates rotation with existing object rotation', () => {
    const objs = [
      makeObj({ id: '1', x: 50, y: 50, width: 100, height: 100, rotation: 30 }),
    ];
    const bbox = { x: 50, y: 50, width: 100, height: 100 };
    const result = transformGroupRotate(objs, bbox, 15);
    expect(result[0].updates.rotation).toBe(45);
  });
});
