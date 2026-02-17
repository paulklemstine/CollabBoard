import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  lerp,
  easeOutCubic,
  easeOutQuart,
  exponentialSmoothing,
  createInterpolationState,
  updateTarget,
  interpolatePosition,
  PositionInterpolator,
} from './interpolation';

describe('interpolation utilities', () => {
  describe('lerp', () => {
    it('should interpolate between two values', () => {
      expect(lerp(0, 100, 0)).toBe(0);
      expect(lerp(0, 100, 0.5)).toBe(50);
      expect(lerp(0, 100, 1)).toBe(100);
    });

    it('should handle negative values', () => {
      expect(lerp(-100, 100, 0.5)).toBe(0);
      expect(lerp(100, -100, 0.5)).toBe(0);
    });
  });

  describe('easing functions', () => {
    it('should return 0 at t=0 and 1 at t=1', () => {
      expect(easeOutCubic(0)).toBe(0);
      expect(easeOutCubic(1)).toBe(1);
      expect(easeOutQuart(0)).toBe(0);
      expect(easeOutQuart(1)).toBe(1);
    });

    it('should ease out (slow down at end)', () => {
      // At t=0.5, ease-out should be > 0.5 (faster at start)
      expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
      expect(easeOutQuart(0.5)).toBeGreaterThan(0.5);
    });
  });

  describe('exponentialSmoothing', () => {
    it('should move towards target based on alpha', () => {
      const current = 0;
      const target = 100;

      const result1 = exponentialSmoothing(current, target, 0.1);
      expect(result1).toBe(10); // 0 + (100 - 0) * 0.1

      const result2 = exponentialSmoothing(current, target, 0.5);
      expect(result2).toBe(50); // 0 + (100 - 0) * 0.5
    });

    it('should not overshoot target', () => {
      const current = 50;
      const target = 100;
      const result = exponentialSmoothing(current, target, 1.0);
      expect(result).toBe(100);
    });
  });

  describe('createInterpolationState', () => {
    it('should create initial state with current and target at same position', () => {
      const state = createInterpolationState(100, 200);

      expect(state.current).toEqual({ x: 100, y: 200 });
      expect(state.target).toEqual({ x: 100, y: 200 });
      expect(state.velocity).toEqual({ x: 0, y: 0 });
      expect(state.lastUpdate).toBeGreaterThan(0);
    });
  });

  describe('updateTarget', () => {
    it('should update target position and calculate velocity', () => {
      const state = createInterpolationState(0, 0);

      // Wait a bit to ensure time difference
      vi.useFakeTimers();
      const now = Date.now();
      vi.setSystemTime(now);

      const initialState = { ...state, lastUpdate: now - 100 }; // 100ms ago

      vi.setSystemTime(now);
      const newState = updateTarget(initialState, 100, 200);

      expect(newState.target).toEqual({ x: 100, y: 200 });
      expect(newState.velocity.x).toBeGreaterThan(0); // Moving right
      expect(newState.velocity.y).toBeGreaterThan(0); // Moving down

      vi.useRealTimers();
    });

    it('should handle zero time delta', () => {
      const state = createInterpolationState(0, 0);
      const newState = updateTarget(state, 100, 200);

      // Should not crash and velocity should be calculated
      expect(newState.target).toEqual({ x: 100, y: 200 });
      expect(newState.velocity.x).toBeDefined();
      expect(newState.velocity.y).toBeDefined();
    });
  });

  describe('interpolatePosition', () => {
    it('should move current position towards target', () => {
      const state = createInterpolationState(0, 0);
      state.target = { x: 100, y: 100 };
      state.velocity = { x: 0, y: 0 };

      const newState = interpolatePosition(state, 16, 0.2, 0); // 16ms = ~60fps

      expect(newState.current.x).toBeGreaterThan(0);
      expect(newState.current.x).toBeLessThan(100);
      expect(newState.current.y).toBeGreaterThan(0);
      expect(newState.current.y).toBeLessThan(100);
    });

    it('should use prediction when velocity is non-zero', () => {
      const state = createInterpolationState(0, 0);
      state.target = { x: 100, y: 100 };
      state.velocity = { x: 1000, y: 1000 }; // Moving fast

      const withPrediction = interpolatePosition(state, 16, 0.2, 0.5);
      const withoutPrediction = interpolatePosition(state, 16, 0.2, 0);

      // With prediction should move further (predicting ahead)
      expect(withPrediction.current.x).toBeGreaterThan(withoutPrediction.current.x);
      expect(withPrediction.current.y).toBeGreaterThan(withoutPrediction.current.y);
    });

    it('should handle different smoothing factors', () => {
      const state = createInterpolationState(0, 0);
      state.target = { x: 100, y: 100 };
      state.velocity = { x: 0, y: 0 };

      const slow = interpolatePosition(state, 16, 0.05, 0);
      const fast = interpolatePosition(state, 16, 0.5, 0);

      // Higher smoothing factor should move closer to target
      expect(fast.current.x).toBeGreaterThan(slow.current.x);
      expect(fast.current.y).toBeGreaterThan(slow.current.y);
    });
  });

  describe('PositionInterpolator', () => {
    let interpolator: PositionInterpolator;
    let updateCallback: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      vi.useFakeTimers();
      updateCallback = vi.fn();
      interpolator = new PositionInterpolator(0, 0, updateCallback);
    });

    afterEach(() => {
      interpolator.destroy();
      vi.useRealTimers();
    });

    it('should initialize with current position', () => {
      const pos = interpolator.getCurrentPosition();
      expect(pos).toEqual({ x: 0, y: 0 });
    });

    it('should call update callback when target is set', () => {
      interpolator.setTarget(100, 100);
      vi.advanceTimersByTime(16); // Advance by one frame

      expect(updateCallback).toHaveBeenCalled();
    });

    it('should interpolate to target over multiple frames', () => {
      interpolator.setTarget(100, 100);

      // Simulate several frames
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(16);
      }

      const pos = interpolator.getCurrentPosition();
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);
    });

    it('should snap to position immediately', () => {
      interpolator.snapTo(500, 500);

      const pos = interpolator.getCurrentPosition();
      expect(pos).toEqual({ x: 500, y: 500 });
      expect(updateCallback).toHaveBeenCalledWith(500, 500);
    });

    it('should stop animating when close to target', () => {
      updateCallback.mockClear();
      interpolator.setTarget(1, 1); // Very close target

      // Advance time until animation stops
      for (let i = 0; i < 100; i++) {
        vi.advanceTimersByTime(16);
      }

      const callCountAfterStop = updateCallback.mock.calls.length;

      // Advance more time - should not call update anymore
      vi.advanceTimersByTime(1000);

      expect(updateCallback.mock.calls.length).toBe(callCountAfterStop);
    });

    it('should clean up on destroy', () => {
      interpolator.setTarget(100, 100);
      interpolator.destroy();

      updateCallback.mockClear();
      vi.advanceTimersByTime(1000);

      // Should not call update after destroy
      expect(updateCallback).not.toHaveBeenCalled();
    });
  });
});
