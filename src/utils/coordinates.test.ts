import { describe, it, expect } from 'vitest';
import { screenToWorld, worldToScreen } from './coordinates';
import type { StageTransform } from '../components/Board/Board';

describe('coordinates', () => {
  describe('screenToWorld', () => {
    it('converts screen coords to world coords with no transform', () => {
      const transform: StageTransform = { x: 0, y: 0, scale: 1 };
      const result = screenToWorld(100, 200, transform);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts screen coords to world coords with pan only', () => {
      const transform: StageTransform = { x: 50, y: 100, scale: 1 };
      const result = screenToWorld(150, 250, transform);

      // World coords = (screen - position) / scale
      // x: (150 - 50) / 1 = 100
      // y: (250 - 100) / 1 = 150
      expect(result).toEqual({ x: 100, y: 150 });
    });

    it('converts screen coords to world coords with zoom only', () => {
      const transform: StageTransform = { x: 0, y: 0, scale: 2 };
      const result = screenToWorld(100, 200, transform);

      // World coords = (screen - position) / scale
      // x: (100 - 0) / 2 = 50
      // y: (200 - 0) / 2 = 100
      expect(result).toEqual({ x: 50, y: 100 });
    });

    it('converts screen coords to world coords with pan and zoom', () => {
      const transform: StageTransform = { x: 100, y: 50, scale: 2 };
      const result = screenToWorld(300, 250, transform);

      // World coords = (screen - position) / scale
      // x: (300 - 100) / 2 = 100
      // y: (250 - 50) / 2 = 100
      expect(result).toEqual({ x: 100, y: 100 });
    });

    it('converts screen coords with negative pan', () => {
      const transform: StageTransform = { x: -100, y: -50, scale: 1 };
      const result = screenToWorld(100, 200, transform);

      // When stage is panned negatively (moved left/up), world coords are higher
      expect(result).toEqual({ x: 200, y: 250 });
    });

    it('converts screen coords with zoom out (scale < 1)', () => {
      const transform: StageTransform = { x: 0, y: 0, scale: 0.5 };
      const result = screenToWorld(100, 200, transform);

      // Zoomed out means larger world area visible
      expect(result).toEqual({ x: 200, y: 400 });
    });
  });

  describe('worldToScreen', () => {
    it('converts world coords to screen coords with no transform', () => {
      const transform: StageTransform = { x: 0, y: 0, scale: 1 };
      const result = worldToScreen(100, 200, transform);

      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts world coords to screen coords with pan only', () => {
      const transform: StageTransform = { x: 50, y: 100, scale: 1 };
      const result = worldToScreen(100, 150, transform);

      // Screen coords = world * scale + position
      // x: 100 * 1 + 50 = 150
      // y: 150 * 1 + 100 = 250
      expect(result).toEqual({ x: 150, y: 250 });
    });

    it('converts world coords to screen coords with zoom only', () => {
      const transform: StageTransform = { x: 0, y: 0, scale: 2 };
      const result = worldToScreen(50, 100, transform);

      // Screen coords = world * scale + position
      // x: 50 * 2 + 0 = 100
      // y: 100 * 2 + 0 = 200
      expect(result).toEqual({ x: 100, y: 200 });
    });

    it('converts world coords to screen coords with pan and zoom', () => {
      const transform: StageTransform = { x: 100, y: 50, scale: 2 };
      const result = worldToScreen(100, 100, transform);

      // Screen coords = world * scale + position
      // x: 100 * 2 + 100 = 300
      // y: 100 * 2 + 50 = 250
      expect(result).toEqual({ x: 300, y: 250 });
    });
  });

  describe('round-trip conversion', () => {
    it('screenToWorld and worldToScreen are inverse operations', () => {
      const transform: StageTransform = { x: 123, y: 456, scale: 1.5 };
      const screenCoords = { x: 500, y: 700 };

      const world = screenToWorld(screenCoords.x, screenCoords.y, transform);
      const backToScreen = worldToScreen(world.x, world.y, transform);

      expect(backToScreen.x).toBeCloseTo(screenCoords.x, 10);
      expect(backToScreen.y).toBeCloseTo(screenCoords.y, 10);
    });

    it('round-trip works with multiple transform scenarios', () => {
      const scenarios: StageTransform[] = [
        { x: 0, y: 0, scale: 1 },
        { x: 100, y: 200, scale: 2 },
        { x: -50, y: -100, scale: 0.5 },
        { x: 500, y: 300, scale: 3.5 },
      ];

      scenarios.forEach((transform) => {
        const screenCoords = { x: 400, y: 600 };
        const world = screenToWorld(screenCoords.x, screenCoords.y, transform);
        const backToScreen = worldToScreen(world.x, world.y, transform);

        expect(backToScreen.x).toBeCloseTo(screenCoords.x, 10);
        expect(backToScreen.y).toBeCloseTo(screenCoords.y, 10);
      });
    });
  });

  describe('toolbar positioning', () => {
    it('converts toolbar button position to world coordinates', () => {
      // Toolbar is at bottom of screen, ~100px from bottom
      // Screen size is 1920x1080
      // Button is centered horizontally
      const screenX = 1920 / 2; // 960
      const screenY = 1080 - 100; // 980

      // User has panned right (stage moved right, so stage.x is positive)
      // and zoomed in 2x
      const transform: StageTransform = { x: 200, y: 150, scale: 2 };

      const world = screenToWorld(screenX, screenY, transform);

      // x: (960 - 200) / 2 = 380
      // y: (980 - 150) / 2 = 415
      expect(world).toEqual({ x: 380, y: 415 });
    });

    it('positions sticky note above toolbar with zoomed out view', () => {
      const screenX = 800;
      const screenY = 1000; // Near bottom of screen

      // Zoomed out to see more of the canvas
      const transform: StageTransform = { x: 0, y: 0, scale: 0.5 };

      const world = screenToWorld(screenX, screenY, transform);

      // x: (800 - 0) / 0.5 = 1600
      // y: (1000 - 0) / 0.5 = 2000
      expect(world).toEqual({ x: 1600, y: 2000 });
    });
  });
});
