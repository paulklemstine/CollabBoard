import { describe, it, expect } from 'vitest';
import {
  getObjectCenter,
  isPointInsideFrame,
  findContainingFrame,
  getChildrenOfFrame,
} from './containment';
import type { Frame, StickyNote } from '../types/board';

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
