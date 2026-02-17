/**
 * Predictive interpolation utilities for smooth cursor and object movement.
 *
 * Uses linear interpolation (lerp) with velocity-based prediction to create
 * buttery-smooth movement even with network latency and throttled updates.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface InterpolationState {
  current: Point2D;
  target: Point2D;
  velocity: Point2D;
  lastUpdate: number;
}

/**
 * Linear interpolation between two values
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Easing function for smooth deceleration (ease-out cubic)
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Easing function for very smooth deceleration (ease-out quart)
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Exponential smoothing with configurable factor
 * Lower alpha = smoother but more lag, higher alpha = more responsive
 */
export function exponentialSmoothing(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

/**
 * Create initial interpolation state
 */
export function createInterpolationState(x: number, y: number): InterpolationState {
  return {
    current: { x, y },
    target: { x, y },
    velocity: { x: 0, y: 0 },
    lastUpdate: Date.now(),
  };
}

/**
 * Update target position and calculate velocity for prediction
 */
export function updateTarget(
  state: InterpolationState,
  newX: number,
  newY: number
): InterpolationState {
  const now = Date.now();
  const dt = Math.max(1, now - state.lastUpdate) / 1000; // seconds

  // Calculate velocity based on target position change
  const velocityX = (newX - state.target.x) / dt;
  const velocityY = (newY - state.target.y) / dt;

  return {
    current: state.current,
    target: { x: newX, y: newY },
    velocity: { x: velocityX, y: velocityY },
    lastUpdate: now,
  };
}

/**
 * Interpolate current position towards target with predictive smoothing
 *
 * @param state - Current interpolation state
 * @param deltaTime - Time since last frame (ms)
 * @param smoothingFactor - Interpolation speed (0-1, higher = faster)
 * @param predictionFactor - How much to predict ahead (0-1)
 * @returns Updated state with new current position
 */
export function interpolatePosition(
  state: InterpolationState,
  deltaTime: number,
  smoothingFactor: number = 0.15,
  predictionFactor: number = 0.3
): InterpolationState {
  const dt = deltaTime / 1000; // Convert to seconds

  // Calculate predicted target position based on velocity
  const predictedX = state.target.x + state.velocity.x * dt * predictionFactor;
  const predictedY = state.target.y + state.velocity.y * dt * predictionFactor;

  // Exponential smoothing towards predicted position
  const newX = exponentialSmoothing(state.current.x, predictedX, smoothingFactor);
  const newY = exponentialSmoothing(state.current.y, predictedY, smoothingFactor);

  return {
    ...state,
    current: { x: newX, y: newY },
  };
}

/**
 * Hook-friendly interpolation that automatically handles animation frame updates
 */
export class PositionInterpolator {
  private state: InterpolationState;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private onUpdate: (x: number, y: number) => void;
  private smoothingFactor: number;
  private predictionFactor: number;

  constructor(
    initialX: number,
    initialY: number,
    onUpdate: (x: number, y: number) => void,
    smoothingFactor: number = 0.15,
    predictionFactor: number = 0.3
  ) {
    this.state = createInterpolationState(initialX, initialY);
    this.onUpdate = onUpdate;
    this.smoothingFactor = smoothingFactor;
    this.predictionFactor = predictionFactor;
  }

  /**
   * Set new target position
   */
  setTarget(x: number, y: number): void {
    this.state = updateTarget(this.state, x, y);

    // Start animation loop if not already running
    if (this.animationFrameId === null) {
      this.lastFrameTime = performance.now();
      this.animate();
    }
  }

  /**
   * Animation loop
   */
  private animate = (): void => {
    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Interpolate position
    this.state = interpolatePosition(
      this.state,
      deltaTime,
      this.smoothingFactor,
      this.predictionFactor
    );

    // Notify update
    this.onUpdate(this.state.current.x, this.state.current.y);

    // Check if we're close enough to target to stop animating
    const dx = Math.abs(this.state.current.x - this.state.target.x);
    const dy = Math.abs(this.state.current.y - this.state.target.y);
    const threshold = 0.5; // pixels

    if (dx < threshold && dy < threshold) {
      // Snap to final position
      this.state.current = { ...this.state.target };
      this.onUpdate(this.state.current.x, this.state.current.y);
      this.animationFrameId = null;
    } else {
      // Continue animating
      this.animationFrameId = requestAnimationFrame(this.animate);
    }
  };

  /**
   * Stop interpolation and clean up
   */
  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Get current position
   */
  getCurrentPosition(): Point2D {
    return { ...this.state.current };
  }

  /**
   * Get target position
   */
  getTargetPosition(): Point2D {
    return { ...this.state.target };
  }

  /**
   * Immediately snap to position without interpolation
   */
  snapTo(x: number, y: number): void {
    this.state = {
      current: { x, y },
      target: { x, y },
      velocity: { x: 0, y: 0 },
      lastUpdate: Date.now(),
    };
    this.onUpdate(x, y);

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
