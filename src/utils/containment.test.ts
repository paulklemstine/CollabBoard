import { describe, it, expect } from 'vitest';
import {
  getObjectCenter,
  isPointInsideFrame,
  findContainingFrame,
  getChildrenOfFrame,
  wouldCreateCircularDependency,
  scaleToFitFrame,
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
  it('returns the frame when object fits completely inside it', () => {
    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 200, y: 200, width: 100, height: 100 }); // center: (250, 250)
    expect(findContainingFrame(sticky, [frame])).toEqual(frame);
  });

  it('returns null when object center is inside but edges extend beyond frame', () => {
    const frame = makeFrame({ id: 'f1', x: 100, y: 100, width: 400, height: 300 });
    // Object center (250, 250) is inside frame, but left edge (50) extends beyond frame left (100)
    const sticky = makeSticky({ x: 50, y: 200, width: 400, height: 100 });
    expect(findContainingFrame(sticky, [frame])).toBeNull();
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

describe('scaleToFitFrame', () => {
  it('returns null when object fits inside frame without scaling', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 100, height: 100 });

    expect(scaleToFitFrame(sticky, frame)).toBeNull();
  });

  it('scales down object width when it exceeds frame width', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 500, height: 100 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThan(500);
    expect(result!.width).toBeLessThanOrEqual(400);
    expect(result!.height).toBeLessThan(100); // Height scaled proportionally
  });

  it('scales down object height when it exceeds frame height', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 100, height: 400 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();
    expect(result!.height).toBeLessThan(400);
    expect(result!.height).toBeLessThanOrEqual(300);
    expect(result!.width).toBeLessThan(100); // Width scaled proportionally
  });

  it('scales down object when both dimensions exceed frame', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 600, height: 500 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThanOrEqual(400);
    expect(result!.height).toBeLessThanOrEqual(300);
  });

  it('maintains aspect ratio when scaling', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 800, height: 400 }); // 2:1 aspect ratio

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // Original aspect ratio is 2:1
    const originalAspect = 800 / 400;
    const newAspect = result!.width / result!.height;
    expect(Math.abs(originalAspect - newAspect)).toBeLessThan(0.01);
  });

  it('leaves small margin to prevent edge-to-edge fit', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 500, height: 400 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // Should have some padding
    expect(result!.width).toBeLessThan(400);
    expect(result!.height).toBeLessThan(300);
  });

  it('handles very large objects gracefully', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 10000, height: 5000 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThanOrEqual(400);
    expect(result!.height).toBeLessThanOrEqual(300);
  });

  it('works with square objects', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    const sticky = makeSticky({ x: 150, y: 150, width: 500, height: 500 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // Square should remain square
    expect(Math.abs(result!.width - result!.height)).toBeLessThan(0.01);
  });

  it('handles rotated objects - 45 degrees that needs scaling', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 300, height: 300 });
    // 400x200 rectangle rotated 45 degrees
    // Bounding box becomes ~424x424, which exceeds 300x300 frame
    const sticky = makeSticky({ x: 150, y: 150, width: 400, height: 200, rotation: 45 });

    const result = scaleToFitFrame(sticky, frame);
    // The rotated bounding box is ~424x424, frame allows 270x270, so needs scaling
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThan(400);
    expect(result!.height).toBeLessThan(200);
  });

  it('handles rotated objects - 90 degrees', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    // 500x100 rectangle rotated 90 degrees becomes 100x500 bounding box
    const sticky = makeSticky({ x: 150, y: 150, width: 500, height: 100, rotation: 90 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // After rotation, the bounding box is 100w x 500h, so height needs scaling
    // The result should scale the original dimensions proportionally
    expect(result!.width).toBeLessThan(500);
    expect(result!.height).toBeLessThan(100);
  });

  it('handles rotated objects - 180 degrees (no change in bounding box)', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 300 });
    // 500x100 rotated 180 degrees still has same bounding box
    const sticky = makeSticky({ x: 150, y: 150, width: 500, height: 100, rotation: 180 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();
    expect(result!.width).toBeLessThan(500);
  });

  it('returns null for rotated object that fits', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 400, height: 400 });
    // Small object rotated 45 degrees - should still fit
    const sticky = makeSticky({ x: 150, y: 150, width: 100, height: 50, rotation: 45 });

    const result = scaleToFitFrame(sticky, frame);
    // Bounding box of 100x50 rotated 45 degrees is ~112x112, which fits in 400x400 frame
    expect(result).toBeNull();
  });

  it('scales correctly when rotation creates larger bounding box', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 300, height: 300 });
    // 400x100 rectangle. When rotated 45 degrees, bounding box is much larger
    const sticky = makeSticky({ x: 150, y: 150, width: 400, height: 100, rotation: 45 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // The scaled dimensions should maintain the original aspect ratio
    const originalAspect = 400 / 100;
    const newAspect = result!.width / result!.height;
    expect(Math.abs(originalAspect - newAspect)).toBeLessThan(0.01);
  });

  it('preserves center point when scaling down', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 300, height: 300 });
    // Object centered at (250, 250) with dimensions 500x400
    const sticky = makeSticky({ x: 0, y: 50, width: 500, height: 400 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // Original center: (0 + 500/2, 50 + 400/2) = (250, 250)
    // After scaling, center should still be at (250, 250)
    // New position should be: (250 - newWidth/2, 250 - newHeight/2)
    const originalCenterX = sticky.x + sticky.width / 2;
    const originalCenterY = sticky.y + sticky.height / 2;

    const newCenterX = result!.x + result!.width / 2;
    const newCenterY = result!.y + result!.height / 2;

    expect(Math.abs(originalCenterX - newCenterX)).toBeLessThan(0.01);
    expect(Math.abs(originalCenterY - newCenterY)).toBeLessThan(0.01);
  });

  it('preserves center point for rotated objects when scaling', () => {
    const frame = makeFrame({ x: 100, y: 100, width: 300, height: 300 });
    // Rotated object that needs scaling
    const sticky = makeSticky({ x: 100, y: 100, width: 400, height: 200, rotation: 45 });

    const result = scaleToFitFrame(sticky, frame);
    expect(result).not.toBeNull();

    // Center should remain the same
    const originalCenterX = sticky.x + sticky.width / 2;
    const originalCenterY = sticky.y + sticky.height / 2;

    const newCenterX = result!.x + result!.width / 2;
    const newCenterY = result!.y + result!.height / 2;

    expect(Math.abs(originalCenterX - newCenterX)).toBeLessThan(0.01);
    expect(Math.abs(originalCenterY - newCenterY)).toBeLessThan(0.01);
  });
});
