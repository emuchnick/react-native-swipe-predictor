# Platform-Specific Physics Configuration

React Native Swipe Predictor automatically detects the platform and applies appropriate physics settings. Here's how to use it:

## Automatic Platform Detection (Recommended)

```tsx
import { useSwipePredictor } from 'react-native-swipe-predictor';
import { Platform } from 'react-native';

function MyComponent() {
  const swipePredictor = useSwipePredictor({
    // Automatically uses iOS or Android physics based on Platform.OS
    physics: Platform.OS === 'ios' ? 'ios' : 'android',
    onPrediction: ({ x, y, confidence }) => {
      // Your prediction handler
    }
  });
}
```

## Even Simpler - Default Behavior

If you don't specify physics at all, the module automatically uses platform defaults:

```tsx
const swipePredictor = useSwipePredictor({
  // No physics specified - automatically uses platform defaults!
  onPrediction: ({ x, y, confidence }) => {
    // Your prediction handler
  }
});
```

## Physics Presets

### iOS Physics
- **Deceleration**: 1000 px/s²
- **Minimum Velocity**: 50 px/s
- **Projection Time**: 500 ms
- **Smoothing Factor**: 0.9
- **Feel**: Smooth, elastic, bouncy

### Android Physics
- **Deceleration**: 1500 px/s²
- **Minimum Velocity**: 50 px/s
- **Projection Time**: 300 ms
- **Smoothing Factor**: 0.7
- **Feel**: Snappy, direct, responsive

## Custom Platform-Aware Physics

For more control, you can customize physics per platform:

```tsx
import { Platform } from 'react-native';

const swipePredictor = useSwipePredictor({
  physics: Platform.select({
    ios: {
      deceleration: 800,      // Gentler than default
      minimumVelocity: 30,    // More sensitive
      projectionTime: 600,    // Longer predictions
      smoothingFactor: 0.95   // Extra smooth
    },
    android: {
      deceleration: 2000,     // Snappier than default
      minimumVelocity: 70,    // Less sensitive
      projectionTime: 200,    // Shorter predictions
      smoothingFactor: 0.6    // More responsive
    },
    default: 'ios'            // Fallback for other platforms
  }),
  onPrediction: ({ x, y, confidence }) => {
    // Your prediction handler
  }
});
```

## Best Practices

1. **Use Platform Defaults First**: Start with the automatic platform detection. Only customize if needed.

2. **Test on Both Platforms**: Physics that feel good on iOS might feel sluggish on Android and vice versa.

3. **Consider Device Performance**: High-end devices can handle more aggressive physics settings.

4. **Match Platform Conventions**: iOS users expect smoother, more elastic animations. Android users expect snappier, more direct responses.

## Example: Complete Cross-Platform Setup

```tsx
import React from 'react';
import { Platform } from 'react-native';
import { useSwipePredictor } from 'react-native-swipe-predictor';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, withSpring } from 'react-native-reanimated';

function CrossPlatformSwipeableCard() {
  const translateX = useSharedValue(0);
  
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    // This line makes it work perfectly on both platforms!
    physics: Platform.OS === 'ios' ? 'ios' : 'android',
    
    confidenceThreshold: Platform.select({
      ios: 0.7,      // iOS can be more confident
      android: 0.6   // Android needs slightly lower threshold
    }),
    
    onPrediction: ({ x, confidence }) => {
      'worklet';
      if (confidence > 0.6) {
        // Use platform-specific spring config too
        translateX.value = withSpring(x, {
          damping: Platform.OS === 'ios' ? 15 : 20,
          stiffness: Platform.OS === 'ios' ? 100 : 150,
        });
      }
    }
  });
  
  const gesture = Gesture.Pan()
    .onBegin(() => runOnJS(onTouchStart)())
    .onUpdate((e) => {
      translateX.value = e.translationX;
      runOnJS(onTouchMove)(e);
    })
    .onEnd(() => runOnJS(onTouchEnd)());
    
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={{ transform: [{ translateX }] }}>
        {/* Your content */}
      </Animated.View>
    </GestureDetector>
  );
}
```

## Testing Your Configuration

1. Run on iOS Simulator and physical device
2. Run on Android Emulator and physical device
3. Test with different swipe speeds
4. Test with different swipe lengths
5. Ensure predictions feel natural on each platform

Remember: The goal is to make your React Native app feel like a native app on each platform!