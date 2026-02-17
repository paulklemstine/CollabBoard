# Predictive Interpolation System

Smooth, buttery cursor and object movement with velocity-based prediction to compensate for network latency.

## Overview

CollabBoard uses predictive interpolation to create silky-smooth movement even with:
- Network latency (50-200ms typical)
- Throttled updates (100ms for cursors, 50ms for dragging)
- Firestore update delays (variable, typically 50-150ms)

## How It Works

### 1. **Linear Interpolation (Lerp)**
Smoothly transitions between current and target positions over time.

```typescript
// Instead of jumping: position = newPosition
// We interpolate: position = lerp(currentPosition, targetPosition, 0.2)
```

### 2. **Velocity-Based Prediction**
Predicts where the object will be based on its current velocity.

```typescript
// Calculate velocity from position changes
velocity = (newTarget - oldTarget) / deltaTime

// Predict ahead
predictedTarget = target + velocity * deltaTime * predictionFactor
```

### 3. **Exponential Smoothing**
Creates natural, physics-based easing without overshooting.

```typescript
newPosition = currentPosition + (predictedTarget - currentPosition) * smoothingFactor
```

## Components

### Core Utilities (`src/utils/interpolation.ts`)

**`PositionInterpolator`** - Main interpolation engine
```typescript
const interpolator = new PositionInterpolator(
  initialX,
  initialY,
  (x, y) => console.log('Updated:', x, y),
  0.2,  // smoothingFactor (0-1, higher = more responsive)
  0.4   // predictionFactor (0-1, higher = more prediction)
);

interpolator.setTarget(100, 100);  // Smoothly animate to new position
interpolator.snapTo(200, 200);     // Jump immediately
interpolator.destroy();            // Clean up
```

### React Hooks

**`useSmoothedPosition`** - General-purpose position smoothing
```typescript
import { useSmoothedPosition } from '../hooks/useSmoothedPosition';

function MyComponent({ targetX, targetY }) {
  const [smoothX, smoothY] = useSmoothedPosition(targetX, targetY, {
    smoothingFactor: 0.2,  // Responsiveness (0-1)
    predictionFactor: 0.4, // Prediction strength (0-1)
    snapInitial: true,     // No animation on mount
  });

  return <div style={{ left: smoothX, top: smoothY }} />;
}
```

**`useSmoothedObjectPosition`** - For board objects (handles local vs remote)
```typescript
import { useSmoothedObjectPosition } from '../hooks/useSmoothedObjectPosition';

function StickyNote({ note, isDragging }) {
  const { x, y } = useSmoothedObjectPosition(
    note.id,
    note.x,
    note.y,
    isDragging  // Skip interpolation for local drag
  );

  return <Group x={x} y={y}>...</Group>;
}
```

## Parameter Tuning Guide

### Smoothing Factor (0-1)
Controls how quickly the object catches up to the target.

- **0.05-0.1**: Very smooth, floaty (good for slow-moving objects)
- **0.15-0.2**: Balanced (default for most cases)
- **0.3-0.5**: Snappy, responsive (good for cursors)
- **0.8-1.0**: Almost instant (minimal smoothing)

**Use cases:**
- **Remote cursors**: 0.2 (smooth but responsive)
- **Remote dragged objects**: 0.15 (smoother, less jittery)
- **Local UI elements**: 0.5+ (immediate feedback)

### Prediction Factor (0-1)
Controls how much to predict ahead based on velocity.

- **0.0**: No prediction (only interpolate to current target)
- **0.2-0.4**: Light prediction (good for stable network)
- **0.5-0.7**: Moderate prediction (good for typical latency)
- **0.8-1.0**: Aggressive prediction (can overshoot)

**Use cases:**
- **Low latency (<50ms)**: 0.2-0.3
- **Medium latency (50-150ms)**: 0.4-0.5 (default)
- **High latency (>150ms)**: 0.6-0.8

## Current Implementation

### Cursors
**File**: `src/components/Cursors/Cursor.tsx`
- Smoothing Factor: **0.2** (responsive but smooth)
- Prediction Factor: **0.4** (compensates for 100ms throttle + network)
- Result: Silky-smooth cursor trails even with 100ms updates

### Board Objects (Future)
**File**: `src/hooks/useSmoothedObjectPosition.ts` (ready to integrate)
- Smoothing Factor: **0.15** (smoother for drag operations)
- Prediction Factor: **0.5** (higher for Firestore latency)
- Usage: Wrap object positions when rendering remote users' drags

## Performance

- **60 FPS**: Uses `requestAnimationFrame` for smooth updates
- **Auto-stops**: Interpolation stops when within 0.5px of target
- **Memory-safe**: Properly cleans up on unmount
- **No layout thrashing**: Updates via state/props, not direct DOM

## Testing

Run interpolation tests:
```bash
npm run test src/utils/interpolation.test.ts
```

Test coverage includes:
- Basic interpolation math
- Velocity calculation
- Prediction accuracy
- Edge cases (zero time delta, negative values)
- Memory cleanup

## Debugging

Enable logging to see interpolation in action:
```typescript
const interpolator = new PositionInterpolator(
  x, y,
  (newX, newY) => {
    console.log(`Interpolated: (${newX.toFixed(1)}, ${newY.toFixed(1)})`);
    updatePosition(newX, newY);
  },
  0.2, 0.4
);
```

## Future Enhancements

1. **Adaptive Prediction**: Automatically adjust prediction based on measured latency
2. **Jitter Detection**: Detect and smooth out network jitter
3. **Rotation Smoothing**: Apply same technique to rotation angles
4. **Scale Smoothing**: Smooth resize operations
5. **Configurable Easing**: Support different easing curves (ease-in, ease-out, elastic)

## References

- [Linear Interpolation (Wikipedia)](https://en.wikipedia.org/wiki/Linear_interpolation)
- [Exponential Smoothing](https://en.wikipedia.org/wiki/Exponential_smoothing)
- [Dead Reckoning (Prediction)](https://en.wikipedia.org/wiki/Dead_reckoning)
- [Game Networking (Gaffer on Games)](https://gafferongames.com/post/snapshot_interpolation/)
