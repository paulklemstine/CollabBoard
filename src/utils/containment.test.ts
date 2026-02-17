import { describe, it, expect } from 'vitest';
import {
  getObjectCenter,
  isPointInsideFrame,
  findContainingFrame,
  getChildrenOfFrame,
  wouldCreateCircularDependency,
} from './containment';
import type { Frame, StickyNote } from '../types/board';
import type { AnyBoardObject } from '../services/boardService';

function makeFrame(overrides: Partial<Frame> = {}): Frame {
  return {
    id: 'frame-1',
    type: 'frame',
    x: 100,
    y: 100,
    width: 400,
    height: 300,
    rotation: 0,
    createdBy: 'user-1',
    updatedAt: 0,
    title: 'Test Frame',
    ...overrides,
  };
}

function makeSticky(overrides: Partial<StickyNote> = {}): StickyNote {
  return {
    id: 'sticky-1',
    type: 'sticky',
    x: 200,
    y: 200,
    width: 200,
    height: 200,
    rotation: 0,
    createdBy: 'user-1',
    updatedAt: 0,
    text: '',
    color: '#fef08a',
    ...overrides,
  };
}

describe('getObjectCenter', () => {
  it('returns the center point of an object', () => {
    const obj = makeSticky({ x: 100, y: 50, width: 200, height: 100 });
    expect(getObjectCenter(obj)).toEqual({ x: 200, y: 100 });
  });

  it('works with zero-origin objects', () => {
    const obj = makeSticky({ x: 0, y: 0, width: 50, height: 50 });
    expect(getObjectCenter(obj)).toEqual({ x: 25, y: 25 });
  });
});

describe('isPointInsideFrame', () => {
  const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });

  it('returns true for a point inside the frame', () => {
    expect(isPointInsideFrame({ x: 300, y: 250 }, frame)).toBe(true);
  });

  it('returns true for a point on the edge', () => {
    expect(isPointInsideFrame({ x: 100, y: 100 }, frame)).toBe(true);
    expect(isPointInsideFrame({ x: 500, y: 400 }, frame)).toBe(true);
  });

  it('returns false for a point outside the frame', () => {
    expect(isPointInsideFrame({ x: 50, y: 250 }, frame)).toBe(false);
    expect(isPointInsideFrame({ x: 300, y: 500 }, frame)).toBe(false);
  });
});

describe('findContainingFrame', () => {
  it('returns the frame when object center is inside it', () => {
    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 200, y: 200, width: 100, height: 100 }); // center: (250, 250)
    expect(findContainingFrame(sticky, [frame])).toEqual(frame);
  });

  it('returns null when object is outside all frames', () => {
    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 600, y: 600, width: 100, height: 100 }); // center: (650, 650)
    expect(findContainingFrame(sticky, [frame])).toBeNull();
  });

  it('returns the smallest frame when overlapping', () => {
    const bigFrame = makeFrame({ id: 'big', x: 0, y: 0, width: 1000, height: 1000 });
    const smallFrame = makeFrame({ id: 'small', x: 200, y: 200, width: 200, height: 200 });
    const sticky = makeSticky({ x: 250, y: 250, width: 50, height: 50 }); // center: (275, 275)
    expect(findContainingFrame(sticky, [bigFrame, smallFrame])?.id).toBe('small');
  });

  it('excludes the object itself when it is a frame', () => {
    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    // Dragging the frame over itself should not return itself
    expect(findContainingFrame(frame, [frame])).toBeNull();
  });

  it('allows frame-in-frame nesting when no circular dependency', () => {
    const bigFrame = makeFrame({ id: 'big', x: 0, y: 0, width: 1000, height: 1000 });
    const smallFrame = makeFrame({ id: 'small', x: 250, y: 250, width: 200, height: 200 }); // center: (350, 350)
    const objects: AnyBoardObject[] = [bigFrame, smallFrame];

    // Small frame being dragged into big frame should be allowed
    expect(findContainingFrame(smallFrame, [bigFrame], objects)?.id).toBe('big');
  });

  it('prevents circular dependency when frame is child of dragged frame', () => {
    const parentFrame = makeFrame({ id: 'parent', x: 0, y: 0, width: 1000, height: 1000 });
    const childFrame = makeFrame({ id: 'child', x: 250, y: 250, width: 200, height: 200, parentId: 'parent' });
    const objects: AnyBoardObject[] = [parentFrame, childFrame];

    // Parent frame (which contains child) cannot be nested inside its own child
    // Parent center is at (500, 500), which is outside child's bounds anyway, but test the logic
    const draggedParent = { ...parentFrame, x: 260, y: 260, width: 150, height: 150 }; // center: (335, 335) - inside child
    expect(findContainingFrame(draggedParent, [childFrame], objects)).toBeNull();
  });

  it('prevents multi-level circular dependency', () => {
    const frame1 = makeFrame({ id: 'f1', x: 0, y: 0, width: 1000, height: 1000 });
    const frame2 = makeFrame({ id: 'f2', x: 100, y: 100, width: 800, height: 800, parentId: 'f1' });
    const frame3 = makeFrame({ id: 'f3', x: 200, y: 200, width: 600, height: 600, parentId: 'f2' });
    const objects: AnyBoardObject[] = [frame1, frame2, frame3];

    // f1 contains f2, f2 contains f3
    // f1 cannot be nested into f3 (would create f3 -> f1 -> f2 -> f3)
    const draggedF1 = { ...frame1, x: 300, y: 300, width: 200, height: 200 }; // center inside f3
    expect(findContainingFrame(draggedF1, [frame3], objects)).toBeNull();
  });
});

describe('wouldCreateCircularDependency', () => {
  it('detects direct circular dependency (self-parenting)', () => {
    const frame = makeFrame({ id: 'f1' });
    expect(wouldCreateCircularDependency('f1', 'f1', [frame])).toBe(true);
  });

  it('detects simple circular dependency (A -> B -> A)', () => {
    const frameA = makeFrame({ id: 'A', parentId: 'B' });
    const frameB = makeFrame({ id: 'B' });
    const objects: AnyBoardObject[] = [frameA, frameB];

    // B currently has no parent, but A is child of B
    // If we make B a child of A, we'd have: A -> B -> A (circular)
    expect(wouldCreateCircularDependency('B', 'A', objects)).toBe(true);
  });

  it('detects multi-level circular dependency (A -> B -> C -> A)', () => {
    const frameA = makeFrame({ id: 'A' });
    const frameB = makeFrame({ id: 'B', parentId: 'A' });
    const frameC = makeFrame({ id: 'C', parentId: 'B' });
    const objects: AnyBoardObject[] = [frameA, frameB, frameC];

    // Current chain: A -> B -> C
    // If we make A a child of C, we'd have: C -> A -> B -> C (circular)
    expect(wouldCreateCircularDependency('A', 'C', objects)).toBe(true);
  });

  it('allows non-circular nesting', () => {
    const frameA = makeFrame({ id: 'A' });
    const frameB = makeFrame({ id: 'B' });
    const frameC = makeFrame({ id: 'C', parentId: 'B' });
    const objects: AnyBoardObject[] = [frameA, frameB, frameC];

    // Current: B -> C
    // Making A a child of B is fine: B -> A, B -> C
    expect(wouldCreateCircularDependency('A', 'B', objects)).toBe(false);

    // Making A a child of C is fine: B -> C -> A
    expect(wouldCreateCircularDependency('A', 'C', objects)).toBe(false);
  });

  it('detects existing circular dependency in data structure', () => {
    // Malformed data where circular dependency already exists
    const frameA = makeFrame({ id: 'A', parentId: 'B' });
    const frameB = makeFrame({ id: 'B', parentId: 'A' });
    const objects: AnyBoardObject[] = [frameA, frameB];

    // Any operation on this broken structure should detect the cycle
    expect(wouldCreateCircularDependency('A', 'B', objects)).toBe(true);
    expect(wouldCreateCircularDependency('B', 'A', objects)).toBe(true);
  });
});

describe('getChildrenOfFrame', () => {
  it('returns objects with matching parentId', () => {
    const objects = [
      makeSticky({ id: 's1', parentId: 'f1' }),
      makeSticky({ id: 's2', parentId: 'f2' }),
      makeSticky({ id: 's3', parentId: 'f1' }),
      makeFrame({ id: 'f1' }),
    ];
    const children = getChildrenOfFrame('f1', objects);
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.id).sort()).toEqual(['s1', 's3']);
  });

  it('returns empty array when no children exist', () => {
    const objects = [
      makeSticky({ id: 's1' }),
      makeFrame({ id: 'f1' }),
    ];
    expect(getChildrenOfFrame('f1', objects)).toEqual([]);
  });

  it('treats empty-string parentId as no parent', () => {
    const objects = [
      makeSticky({ id: 's1', parentId: '' }),
    ];
    expect(getChildrenOfFrame('f1', objects)).toEqual([]);
  });
});
