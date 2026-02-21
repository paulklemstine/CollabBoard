import { describe, it, expect } from 'vitest';
import { requestNeedsContext, resolveFontFamily, computeAutoOrigin } from './index';

describe('requestNeedsContext', () => {
  it('returns summary for move requests', () => {
    expect(requestNeedsContext('move the red sticky')).toBe('summary');
  });

  it('returns summary for delete requests', () => {
    expect(requestNeedsContext('delete all stickies')).toBe('summary');
  });

  it('returns summary for "what" questions', () => {
    expect(requestNeedsContext('what is on the board?')).toBe('summary');
  });

  it('returns summary for "how many" questions', () => {
    expect(requestNeedsContext('how many objects are there?')).toBe('summary');
  });

  it('returns summary for arrange requests', () => {
    expect(requestNeedsContext('arrange the shapes in a circle')).toBe('summary');
  });

  it('returns summary for selected objects', () => {
    expect(requestNeedsContext('change these to blue')).toBe('summary');
  });

  it('returns none for pure creation requests', () => {
    expect(requestNeedsContext('create a SWOT analysis')).toBe('none');
  });

  it('returns none for generic creation', () => {
    expect(requestNeedsContext('add 10 stickies')).toBe('none');
  });

  it('returns none for flowchart creation', () => {
    expect(requestNeedsContext('A -> B -> C')).toBe('none');
  });
});

describe('resolveFontFamily', () => {
  it('resolves sans to Inter', () => {
    expect(resolveFontFamily('sans')).toBe("'Inter', sans-serif");
  });

  it('resolves serif to Georgia', () => {
    expect(resolveFontFamily('serif')).toBe("'Georgia', serif");
  });

  it('resolves mono to Fira Code', () => {
    expect(resolveFontFamily('mono')).toBe("'Fira Code', monospace");
  });

  it('resolves cursive to Caveat', () => {
    expect(resolveFontFamily('cursive')).toBe("'Caveat', cursive");
  });

  it('defaults to sans when undefined', () => {
    expect(resolveFontFamily(undefined)).toBe("'Inter', sans-serif");
  });

  it('defaults to sans for unknown input', () => {
    expect(resolveFontFamily('comic-sans')).toBe("'Inter', sans-serif");
  });
});

describe('computeAutoOrigin', () => {
  it('computes origin for single object', () => {
    const result = computeAutoOrigin([
      { id: '1', x: 100, y: 200, width: 50, height: 50 },
    ]);
    expect(result.minX).toBe(100);
    expect(result.minY).toBe(200);
    expect(result.maxX).toBe(150);
    expect(result.maxY).toBe(250);
    expect(result.centerX).toBe(125);
    expect(result.centerY).toBe(225);
  });

  it('computes origin for multiple objects', () => {
    const result = computeAutoOrigin([
      { id: '1', x: 0, y: 0, width: 100, height: 100 },
      { id: '2', x: 200, y: 200, width: 100, height: 100 },
    ]);
    expect(result.minX).toBe(0);
    expect(result.minY).toBe(0);
    expect(result.maxX).toBe(300);
    expect(result.maxY).toBe(300);
    expect(result.centerX).toBe(150);
    expect(result.centerY).toBe(150);
  });
});
