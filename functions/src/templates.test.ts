import { describe, it, expect } from 'vitest';
import { detectTemplate } from './index';
import type { TemplateMatch } from './index';

describe('detectTemplate', () => {
  describe('flowchart patterns', () => {
    it('detects simple arrow syntax', () => {
      const result = detectTemplate('A -> B -> C');
      expect(result).toEqual({ type: 'flowchart', nodes: ['A', 'B', 'C'] });
    });

    it('detects double-arrow syntax', () => {
      const result = detectTemplate('Start --> Middle --> End');
      expect(result).toEqual({ type: 'flowchart', nodes: ['Start', 'Middle', 'End'] });
    });

    it('detects unicode arrow', () => {
      const result = detectTemplate('A → B');
      expect(result).toEqual({ type: 'flowchart', nodes: ['A', 'B'] });
    });

    it('rejects single node (no arrows)', () => {
      const result = detectTemplate('just a single node');
      expect(result?.type).not.toBe('flowchart');
    });

    it('rejects empty node segments', () => {
      const result = detectTemplate('-> B -> C');
      expect(result?.type).not.toBe('flowchart');
    });
  });

  describe('clear-board patterns', () => {
    it('detects "clear the board"', () => {
      expect(detectTemplate('clear the board')).toEqual({ type: 'clear-board' });
    });

    it('detects "clear board"', () => {
      expect(detectTemplate('clear board')).toEqual({ type: 'clear-board' });
    });

    it('detects "delete everything"', () => {
      expect(detectTemplate('delete everything')).toEqual({ type: 'clear-board' });
    });

    it('detects "remove all objects"', () => {
      expect(detectTemplate('remove all objects')).toEqual({ type: 'clear-board' });
    });

    it('detects "wipe the canvas"', () => {
      expect(detectTemplate('wipe the canvas')).toEqual({ type: 'clear-board' });
    });

    it('detects "clean the board"', () => {
      expect(detectTemplate('clean the board')).toEqual({ type: 'clear-board' });
    });

    it('does NOT match "delete the red sticky"', () => {
      const result = detectTemplate('delete the red sticky');
      expect(result?.type).not.toBe('clear-board');
    });
  });

  describe('grid patterns', () => {
    it('detects "3x4 grid"', () => {
      const result = detectTemplate('create a 3x4 grid of stickies');
      expect(result).toMatchObject({ type: 'grid-create', rows: 3, cols: 4 });
    });

    it('detects "2x3 grid"', () => {
      const result = detectTemplate('make a 2x3 grid');
      expect(result).toMatchObject({ type: 'grid-create', rows: 2, cols: 3 });
    });

    it('detects grid with labels "for pros and cons"', () => {
      const result = detectTemplate('create a 2x3 grid of stickies for pros and cons');
      expect(result).toMatchObject({ type: 'grid-create', rows: 2, cols: 3 });
      if (result?.type === 'grid-create') {
        expect(result.labels).toEqual(['pros', 'cons']);
      }
    });

    it('detects "4x4 grid"', () => {
      const result = detectTemplate('4x4 grid of notes');
      expect(result).toMatchObject({ type: 'grid-create', rows: 4, cols: 4 });
    });

    it('rejects grids exceeding 500 total', () => {
      const result = detectTemplate('create a 30x30 grid');
      expect(result).toBeNull();
    });
  });

  describe('numbered flowchart patterns', () => {
    it('detects "create a flowchart with 5 steps"', () => {
      const result = detectTemplate('create a flowchart with 5 steps');
      expect(result).toMatchObject({ type: 'numbered-flowchart', stepCount: 5 });
    });

    it('detects "make a 3-step flowchart"', () => {
      const result = detectTemplate('make a 3-step flowchart');
      expect(result).toMatchObject({ type: 'numbered-flowchart', stepCount: 3 });
    });

    it('detects "build a flowchart with 7 stages"', () => {
      const result = detectTemplate('build a flowchart with 7 stages');
      expect(result).toMatchObject({ type: 'numbered-flowchart', stepCount: 7 });
    });

    it('defaults to 5 steps when no count given', () => {
      const result = detectTemplate('create a flowchart');
      expect(result).toMatchObject({ type: 'numbered-flowchart', stepCount: 5 });
    });
  });

  describe('structural templates', () => {
    it('detects SWOT', () => {
      const result = detectTemplate('create a SWOT analysis');
      expect(result).toEqual({ type: 'template', templateType: 'swot' });
    });

    it('detects kanban', () => {
      const result = detectTemplate('make a kanban board');
      expect(result).toEqual({ type: 'template', templateType: 'kanban' });
    });

    it('detects retrospective', () => {
      const result = detectTemplate('set up a retro');
      expect(result).toEqual({ type: 'template', templateType: 'retrospective' });
    });

    it('detects retrospective (full word)', () => {
      const result = detectTemplate('create a retrospective');
      expect(result).toEqual({ type: 'template', templateType: 'retrospective' });
    });

    it('detects eisenhower', () => {
      const result = detectTemplate('eisenhower matrix');
      expect(result).toEqual({ type: 'template', templateType: 'eisenhower' });
    });

    it('detects mind map', () => {
      const result = detectTemplate('create a mind map');
      expect(result).toEqual({ type: 'template', templateType: 'mind-map' });
    });

    it('detects mindmap (no space)', () => {
      const result = detectTemplate('make a mindmap');
      expect(result).toEqual({ type: 'template', templateType: 'mind-map' });
    });

    it('detects pros and cons', () => {
      const result = detectTemplate('create a pros and cons list');
      expect(result).toEqual({ type: 'template', templateType: 'pros-cons' });
    });

    it('detects pro/con variant', () => {
      const result = detectTemplate('make a pro/con comparison');
      expect(result).toEqual({ type: 'template', templateType: 'pros-cons' });
    });

    it('detects timeline', () => {
      const result = detectTemplate('create a timeline');
      expect(result).toEqual({ type: 'template', templateType: 'timeline' });
    });

    it('detects timeline with stages', () => {
      const result = detectTemplate('create a timeline with 5 stages');
      expect(result).toEqual({ type: 'template', templateType: 'timeline' });
    });

    it('detects user journey map', () => {
      const result = detectTemplate('build a user journey map');
      expect(result).toEqual({ type: 'template', templateType: 'journey' });
    });

    it('detects journey map with stages', () => {
      const result = detectTemplate('create a user journey map with 5 stages');
      expect(result).toEqual({ type: 'template', templateType: 'journey' });
    });
  });

  describe('bulk-create patterns', () => {
    it('matches "create 10 stickies"', () => {
      const result = detectTemplate('create 10 stickies');
      expect(result).toEqual({ type: 'bulk-create', count: 10, objectType: 'sticky' });
    });

    it('matches "add 5 shapes"', () => {
      const result = detectTemplate('add 5 shapes');
      expect(result).toEqual({ type: 'bulk-create', count: 5, objectType: 'shape' });
    });

    it('matches "50 random objects"', () => {
      const result = detectTemplate('add 50 random objects');
      expect(result).toEqual({ type: 'bulk-create', count: 50, objectType: 'random' });
    });

    it('matches "generate 20 cards"', () => {
      const result = detectTemplate('generate 20 cards');
      expect(result).toEqual({ type: 'bulk-create', count: 20, objectType: 'sticky' });
    });

    it('matches "create 5 notes"', () => {
      const result = detectTemplate('create 5 notes');
      expect(result).toEqual({ type: 'bulk-create', count: 5, objectType: 'sticky' });
    });

    it('matches "make 3 frames"', () => {
      const result = detectTemplate('make 3 frames');
      expect(result).toEqual({ type: 'bulk-create', count: 3, objectType: 'frame' });
    });

    it('matches "add 10 text"', () => {
      const result = detectTemplate('add 10 texts');
      expect(result).toEqual({ type: 'bulk-create', count: 10, objectType: 'text' });
    });

    it('matches "create 8 stickers"', () => {
      const result = detectTemplate('create 8 stickers');
      expect(result).toEqual({ type: 'bulk-create', count: 8, objectType: 'sticker' });
    });

    it('matches "place 15 items"', () => {
      const result = detectTemplate('place 15 items');
      expect(result).toEqual({ type: 'bulk-create', count: 15, objectType: 'random' });
    });

    it('matches "put 7 things"', () => {
      const result = detectTemplate('put 7 things');
      expect(result).toEqual({ type: 'bulk-create', count: 7, objectType: 'random' });
    });

    it('matches count of 1', () => {
      const result = detectTemplate('create 1 sticky');
      expect(result).toEqual({ type: 'bulk-create', count: 1, objectType: 'sticky' });
    });

    it('matches count of 500', () => {
      const result = detectTemplate('create 500 stickies');
      expect(result).toEqual({ type: 'bulk-create', count: 500, objectType: 'sticky' });
    });
  });

  describe('bulk-create guards', () => {
    it('rejects prompts with content words (about)', () => {
      const result = detectTemplate('create 5 stickies about project management');
      expect(result).toBeNull();
    });

    it('rejects prompts with content words (with)', () => {
      const result = detectTemplate('create 5 notes with feedback');
      expect(result).toBeNull();
    });

    it('rejects prompts with content words (for)', () => {
      const result = detectTemplate('add 3 cards for sprint planning');
      expect(result).toBeNull();
    });

    it('rejects prompts with content words (titled)', () => {
      const result = detectTemplate('create 5 stickies titled TODO');
      expect(result).toBeNull();
    });

    it('rejects prompts with content words (containing)', () => {
      const result = detectTemplate('add 10 notes containing ideas');
      expect(result).toBeNull();
    });

    it('rejects count > 500', () => {
      const result = detectTemplate('create 501 stickies');
      expect(result).toBeNull();
    });

    it('rejects count of 0', () => {
      const result = detectTemplate('create 0 stickies');
      expect(result).toBeNull();
    });
  });

  describe('single-object creation', () => {
    it('detects "add a sticky note"', () => {
      const result = detectTemplate('add a sticky note');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'sticky' });
    });

    it('detects "create a rectangle"', () => {
      const result = detectTemplate('create a rectangle');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'shape', shapeType: 'rect' });
    });

    it('detects "add a circle"', () => {
      const result = detectTemplate('add a circle');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'shape', shapeType: 'circle' });
    });

    it('detects "create a blue rectangle"', () => {
      const result = detectTemplate('create a blue rectangle');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'shape', shapeType: 'rect', color: '#dbeafe' });
    });

    it('detects "add a yellow sticky note"', () => {
      const result = detectTemplate('add a yellow sticky note');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'sticky', color: '#fef9c3' });
    });

    it('detects "add a frame called Sprint Planning"', () => {
      const result = detectTemplate("add a frame called Sprint Planning");
      expect(result).toMatchObject({ type: 'single-create', objectType: 'frame', label: 'Sprint Planning' });
    });

    it('detects "create a sticky note that says User Research"', () => {
      const result = detectTemplate("create a sticky note that says User Research");
      expect(result).toMatchObject({ type: 'single-create', objectType: 'sticky', label: 'User Research' });
    });

    it('detects "add a text"', () => {
      const result = detectTemplate('add a text');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'text' });
    });

    it('detects "create a triangle"', () => {
      const result = detectTemplate('create a triangle');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'shape', shapeType: 'triangle' });
    });

    it('detects "add a diamond"', () => {
      const result = detectTemplate('add a diamond');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'shape', shapeType: 'diamond' });
    });

    it('detects pink sticky note', () => {
      const result = detectTemplate('create a pink sticky note');
      expect(result).toMatchObject({ type: 'single-create', objectType: 'sticky', color: '#fce7f3' });
    });

    it('detects quoted text in sticky', () => {
      const result = detectTemplate("add a sticky note that says 'Hello World'");
      expect(result).toMatchObject({ type: 'single-create', objectType: 'sticky', label: 'Hello World' });
    });
  });

  describe('non-matches', () => {
    it('returns null for generic creative prompts', () => {
      const result = detectTemplate('help me brainstorm ideas');
      expect(result).toBeNull();
    });

    it('returns null for empty string', () => {
      const result = detectTemplate('');
      expect(result).toBeNull();
    });

    it('returns null for ambiguous prompts', () => {
      const result = detectTemplate('make something cool');
      expect(result).toBeNull();
    });
  });

  describe('priority ordering', () => {
    it('flowchart arrows take priority over everything', () => {
      const result = detectTemplate('A -> B -> C');
      expect(result?.type).toBe('flowchart');
    });

    it('clear-board takes priority over single-create', () => {
      const result = detectTemplate('clear the board');
      expect(result?.type).toBe('clear-board');
    });

    it('bulk-create takes priority over structural templates', () => {
      const result = detectTemplate('create 5 stickies');
      expect(result?.type).toBe('bulk-create');
    });

    it('grid takes priority over bulk-create for NxM pattern', () => {
      const result = detectTemplate('create a 3x4 grid of stickies');
      expect(result?.type).toBe('grid-create');
    });
  });
});
