# React Native Swipe Predictor API Documentation

## Table of Contents

- [Core Hook](#core-hook)
- [Components](#components)
- [Types](#types)
- [Native Modules](#native-modules)
- [Physics Configurations](#physics-configurations)
- [Examples](#examples)

## Core Hook

### `useSwipePredictor(options?: SwipePredictorOptions)`

The main React hook for integrating swipe prediction into your components.

```typescript
import { useSwipePredictor } from 'react-native-swipe-predictor';

const swipePredictor = useSwipePredictor({
  confidenceThreshold: 0.7,
  updateInterval: 16,
  onPrediction: (prediction) => {
    console.log('Prediction:', prediction);
  },
  physics: 'ios',
  debug: false,
});
```

#### Parameters

##### `options` (optional)
Configuration object for the swipe predictor.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `confidenceThreshold` | `number` | `0.7` | Minimum confidence level (0-1) required to trigger prediction callbacks. Higher values mean more conservative predictions. |
| `updateInterval` | `number` | `16` | Milliseconds between prediction updates. 16ms = 60fps, 8ms = 120fps. |
| `onPrediction` | `(prediction: Prediction) => void` | `undefined` | Callback function called when a prediction meets the confidence threshold. Can be a worklet for better performance. |
| `physics` | `'ios' \| 'android' \| PhysicsConfig` | Platform default | Physics model to use. Can be a preset or custom configuration. |
| `debug` | `boolean` | `false` | Enable debug mode to show visual overlay with prediction data. |

#### Return Value

Returns an object with the following properties:

```typescript
{
  onTouchStart: () => void;
  onTouchMove: (event: GestureEvent) => void;
  onTouchEnd: () => void;
  prediction: Prediction | null;
  isActive: boolean;
  debugInfo?: DebugInfo;
}
```

| Property | Type | Description |
|----------|------|-------------|
| `onTouchStart` | `() => void` | Function to call when a gesture begins. Initializes the predictor. |
| `onTouchMove` | `(event) => void` | Function to call on gesture updates. Pass the gesture event from your handler. |
| `onTouchEnd` | `() => void` | Function to call when a gesture ends. Cleans up the predictor. |
| `prediction` | `Prediction \| null` | Current prediction data, or null if no active gesture. |
| `isActive` | `boolean` | Whether a gesture is currently being tracked. |
| `debugInfo` | `DebugInfo \| undefined` | Additional debug information when debug mode is enabled. |

## Components

### `SwipePredictorDebugOverlay`

A visual debugging component that displays prediction information as an overlay.

```tsx
import { SwipePredictorDebugOverlay } from 'react-native-swipe-predictor';

<SwipePredictorDebugOverlay
  isActive={swipePredictor.isActive}
  prediction={swipePredictor.prediction}
  touchPoints={swipePredictor.debugInfo?.touchPoints}
  currentVelocity={swipePredictor.debugInfo?.velocity}
/>
```

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isActive` | `boolean` | Yes | Whether to show the overlay |
| `prediction` | `Prediction \| null` | Yes | Current prediction data |
| `touchPoints` | `TouchPoint[]` | No | Array of recent touch points for trail visualization |
| `currentVelocity` | `{ vx: number; vy: number }` | No | Current velocity for vector visualization |

## Types

### `Prediction`

The core prediction data returned by the predictor.

```typescript
interface Prediction {
  x: number;          // Predicted end X position (relative to start)
  y: number;          // Predicted end Y position (relative to start)
  vx: number;         // Current X velocity (pixels/second)
  vy: number;         // Current Y velocity (pixels/second)
  confidence: number; // Prediction confidence (0-1)
  duration: number;   // Predicted time until gesture ends (milliseconds)
}
```

### `PhysicsConfig`

Custom physics configuration for fine-tuning predictions.

```typescript
interface PhysicsConfig {
  deceleration: number;      // Deceleration rate in pixels/second²
  minimumVelocity: number;   // Minimum velocity threshold in pixels/second
  projectionTime: number;    // Maximum prediction time in milliseconds
  smoothingFactor: number;   // Velocity smoothing factor (0-1)
}
```

### `TouchPoint`

Individual touch point data.

```typescript
interface TouchPoint {
  x: number;         // X position
  y: number;         // Y position
  timestamp: number; // Time since gesture start (milliseconds)
}
```

### `GestureEvent`

Event data from gesture handlers.

```typescript
interface GestureEvent {
  translationX: number;
  translationY: number;
  velocityX?: number;
  velocityY?: number;
}
```

## Native Modules

### `SwipePredictorModule`

Low-level native module interface (not typically used directly).

```typescript
interface SwipePredictorModule {
  createPredictor(): Promise<number>;
  addTouchPoint(id: number, x: number, y: number, timestamp: number): void;
  getPrediction(id: number): Promise<Prediction>;
  releasePredictor(id: number): void;
  setPhysicsConfig(config: PhysicsConfig): void;
}
```

## Physics Configurations

### Preset Configurations

#### iOS Physics
```typescript
{
  deceleration: 1000,
  minimumVelocity: 50,
  projectionTime: 500,
  smoothingFactor: 0.9
}
```
Provides a smooth, elastic feel typical of iOS interactions.

#### Android Physics
```typescript
{
  deceleration: 1500,
  minimumVelocity: 50,
  projectionTime: 300,
  smoothingFactor: 0.7
}
```
Provides a snappier, more direct response typical of Android.

### Custom Physics

You can create custom physics configurations for specific use cases:

```typescript
// Heavy object physics
const heavyPhysics: PhysicsConfig = {
  deceleration: 2000,      // Higher deceleration
  minimumVelocity: 100,    // Requires more force
  projectionTime: 200,     // Shorter predictions
  smoothingFactor: 0.95    // More smoothing
};

// Light, floaty physics
const floatyPhysics: PhysicsConfig = {
  deceleration: 500,       // Lower deceleration
  minimumVelocity: 30,     // Very responsive
  projectionTime: 800,     // Longer predictions
  smoothingFactor: 0.6     // Less smoothing
};
```

## Examples

### Basic Integration with Gesture Handler

```tsx
import React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle,
  withSpring,
  runOnJS 
} from 'react-native-reanimated';
import { useSwipePredictor } from 'react-native-swipe-predictor';

function SwipeableView() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    confidenceThreshold: 0.7,
    onPrediction: ({ x, y, confidence }) => {
      'worklet';
      if (confidence > 0.7) {
        translateX.value = withSpring(x);
        translateY.value = withSpring(y);
      }
    }
  });
  
  const gesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      runOnJS(onTouchStart)();
    })
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      runOnJS(onTouchMove)(event);
    })
    .onEnd(() => {
      'worklet';
      runOnJS(onTouchEnd)();
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });
    
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value }
    ]
  }));
  
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.box, animatedStyle]}>
        {/* Content */}
      </Animated.View>
    </GestureDetector>
  );
}
```

### With Debug Overlay

```tsx
function DebugExample() {
  const [showDebug, setShowDebug] = useState(true);
  
  const swipePredictor = useSwipePredictor({
    debug: true,
    confidenceThreshold: 0.5,
    onPrediction: (prediction) => {
      console.log('Confidence:', prediction.confidence);
    }
  });
  
  return (
    <View style={styles.container}>
      {/* Your swipeable content */}
      
      {showDebug && (
        <SwipePredictorDebugOverlay
          isActive={swipePredictor.isActive}
          prediction={swipePredictor.prediction}
          touchPoints={swipePredictor.debugInfo?.touchPoints}
          currentVelocity={swipePredictor.debugInfo?.velocity}
        />
      )}
    </View>
  );
}
```

### Custom Physics Example

```tsx
function CustomPhysicsExample() {
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    physics: {
      deceleration: 800,      // Gentle deceleration
      minimumVelocity: 30,    // Very responsive
      projectionTime: 600,    // Long predictions
      smoothingFactor: 0.85   // Smooth velocity
    },
    onPrediction: ({ x, y, duration }) => {
      console.log(`Will end at (${x}, ${y}) in ${duration}ms`);
    }
  });
  
  // ... rest of component
}
```

### Worklet Integration

For optimal performance, use worklets with Reanimated:

```tsx
function WorkletExample() {
  const position = useSharedValue({ x: 0, y: 0 });
  
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    onPrediction: ({ x, y, confidence }) => {
      'worklet';
      // This runs on the UI thread for maximum performance
      if (confidence > 0.8) {
        position.value = {
          x: withSpring(x),
          y: withSpring(y)
        };
      }
    }
  });
  
  // ... rest of component
}
```

## Best Practices

1. **Use Worklets**: When using with Reanimated, make your `onPrediction` callback a worklet for best performance.

2. **Confidence Thresholds**: Start with 0.7 and adjust based on your use case. Higher values are more conservative.

3. **Update Intervals**: Use 16ms (60fps) for most cases. Only use 8ms (120fps) if you need ultra-smooth predictions.

4. **Physics Tuning**: Start with platform defaults, then adjust based on the "weight" of your UI elements.

5. **Memory Management**: The predictor automatically cleans up, but always call `onTouchEnd` to ensure proper cleanup.

6. **Debug Mode**: Use debug mode during development to visualize predictions and tune parameters.

## Troubleshooting

### Low Confidence Scores
- User might be making erratic movements
- Try lowering `minimumVelocity` in physics config
- Increase `smoothingFactor` for more stable predictions

### Predictions Feel Delayed
- Ensure you're using worklets with Reanimated
- Check that `updateInterval` matches your display refresh rate
- Verify no heavy computations are blocking the JS thread

### Predictions Overshoot
- Increase `deceleration` value
- Reduce `projectionTime`
- Lower `smoothingFactor` for more responsive predictions