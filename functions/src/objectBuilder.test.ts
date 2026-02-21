import { describe, it, expect } from 'vitest';
import { buildObjectData } from './index';

describe('buildObjectData', () => {
  const userId = 'test-user';
  const now = 1700000000000;

  describe('sticky notes', () => {
    it('creates sticky with defaults', () => {
      const data = buildObjectData('createStickyNote', {}, userId, now);
      expect(data).toMatchObject({
        type: 'sticky',
        text: '',
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        color: '#fef9c3',
        textColor: '#1e293b',
        createdBy: userId,
        updatedAt: now,
        parentId: '',
        rotation: 0,
      });
    });

    it('creates sticky with custom params', () => {
      const data = buildObjectData('createStickyNote', {
        text: 'Hello',
        x: 100,
        y: 200,
        width: 300,
        height: 300,
        color: '#ff0000',
        textColor: '#ffffff',
        parentId: 'parent-1',
      }, userId, now);
      expect(data).toMatchObject({
        type: 'sticky',
        text: 'Hello',
        x: 100,
        y: 200,
        width: 300,
        height: 300,
        color: '#ff0000',
        textColor: '#ffffff',
        parentId: 'parent-1',
      });
    });

    it('includes aiLabel when provided', () => {
      const data = buildObjectData('createStickyNote', { aiLabel: 'test-label' }, userId, now);
      expect(data.aiLabel).toBe('test-label');
    });

    it('includes aiGroupId when resolvedGroupId provided', () => {
      const data = buildObjectData('createStickyNote', {}, userId, now, 'group-1');
      expect(data.aiGroupId).toBe('group-1');
    });
  });

  describe('shapes', () => {
    it('creates shape with defaults', () => {
      const data = buildObjectData('createShape', {}, userId, now);
      expect(data).toMatchObject({
        type: 'shape',
        shapeType: 'rect',
        width: 120,
        height: 120,
        color: '#dbeafe',
        strokeColor: '#4f46e5',
      });
    });

    it('creates line shape with endpoint math', () => {
      const data = buildObjectData('createShape', {
        shapeType: 'line',
        fromX: 0,
        fromY: 0,
        toX: 200,
        toY: 0,
      }, userId, now);
      expect(data.type).toBe('shape');
      expect(data.shapeType).toBe('line');
      expect(data.width).toBe(200);
      expect(data.height).toBe(4);
      expect(data.rotation).toBe(0);
    });

    it('creates line shape with default width when no endpoints', () => {
      const data = buildObjectData('createShape', { shapeType: 'line' }, userId, now);
      expect(data.width).toBe(200);
      expect(data.height).toBe(4);
    });
  });

  describe('frames', () => {
    it('creates frame with defaults', () => {
      const data = buildObjectData('createFrame', {}, userId, now);
      expect(data).toMatchObject({
        type: 'frame',
        title: 'Frame',
        width: 400,
        height: 300,
        borderless: false,
        sentToBack: true,
      });
    });

    it('creates frame with custom title', () => {
      const data = buildObjectData('createFrame', { title: 'My Frame' }, userId, now);
      expect(data.title).toBe('My Frame');
    });
  });

  describe('stickers', () => {
    it('creates sticker with defaults', () => {
      const data = buildObjectData('createSticker', {}, userId, now);
      expect(data).toMatchObject({
        type: 'sticker',
        emoji: '😊',
        width: 150,
        height: 150,
      });
    });

    it('creates sticker with custom emoji and size', () => {
      const data = buildObjectData('createSticker', { emoji: '🎯', size: 200 }, userId, now);
      expect(data.emoji).toBe('🎯');
      expect(data.width).toBe(200);
      expect(data.height).toBe(200);
    });
  });

  describe('gif stickers', () => {
    it('creates gif sticker with search term', () => {
      const data = buildObjectData('createGifSticker', { searchTerm: 'happy dance' }, userId, now);
      expect(data).toMatchObject({
        type: 'sticker',
        emoji: '',
        gifSearchTerm: 'happy dance',
      });
    });
  });

  describe('text', () => {
    it('creates text with defaults', () => {
      const data = buildObjectData('createText', {}, userId, now);
      expect(data).toMatchObject({
        type: 'text',
        text: '',
        width: 300,
        height: 50,
        fontSize: 24,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        color: '#1e293b',
        bgColor: 'transparent',
      });
    });

    it('creates text with custom values', () => {
      const data = buildObjectData('createText', {
        text: 'Hello World',
        fontSize: 36,
        fontWeight: 'bold',
      }, userId, now);
      expect(data.text).toBe('Hello World');
      expect(data.fontSize).toBe(36);
      expect(data.fontWeight).toBe('bold');
    });
  });

  describe('connectors', () => {
    it('creates connector with defaults', () => {
      const data = buildObjectData('createConnector', {
        fromId: 'a',
        toId: 'b',
      }, userId, now);
      expect(data).toMatchObject({
        type: 'connector',
        fromId: 'a',
        toId: 'b',
        style: 'straight',
        lineType: 'solid',
        startArrow: false,
        endArrow: false,
        strokeWidth: 2,
        color: '#6366f1',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        parentId: '',
      });
    });
  });

  describe('unknown op type', () => {
    it('returns type unknown for unknown op', () => {
      const data = buildObjectData('createSomethingWeird', {}, userId, now);
      expect(data.type).toBe('unknown');
    });
  });
});
