import { describe, it, expect } from 'vitest';
import { generateBoardId } from './boardId';

describe('generateBoardId', () => {
  it('returns a 10-character string', () => {
    const id = generateBoardId();
    expect(id).toHaveLength(10);
  });

  it('only contains base36 characters [0-9a-z]', () => {
    for (let i = 0; i < 100; i++) {
      const id = generateBoardId();
      expect(id).toMatch(/^[0-9a-z]{10}$/);
    }
  });

  it('generates unique IDs across multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateBoardId());
    }
    expect(ids.size).toBe(1000);
  });
});
