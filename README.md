# React Native Swipe Predictor

> Create impossibly responsive swipe interactions by predicting where gestures will end

[![npm version](https://img.shields.io/npm/v/react-native-swipe-predictor.svg)](https://www.npmjs.com/package/react-native-swipe-predictor)
[![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-lightgrey.svg)](https://reactnative.dev/)
[![License](https://img.shields.io/npm/l/react-native-swipe-predictor.svg)](https://github.com/emuchnick/react-native-swipe-predictor/blob/main/LICENSE)

## What is this?

React Native Swipe Predictor is a high-performance native module that uses physics-based prediction to determine where touch gestures will end. By starting animations before the user lifts their finger, it creates an incredibly responsive feeling that makes React Native apps feel as smooth as native iOS/Android apps.

### The Problem

```
Normal flow: [Touch] → [Move] → [Lift finger] → [Animation starts] (80ms delay)
```

### Our Solution

```
With predictor: [Touch] → [Move + Animation starts] → [Done] (0ms delay)
```

## Demo

![Swipe Predictor Demo](https://github.com/emuchnick/react-native-swipe-predictor/raw/main/docs/demo.gif)

_Left: Standard React Native | Right: With Swipe Predictor_

## Live Examples

Try out these interactive examples:

- **[Tinder Cards](examples/tinder-cards)** - Swipeable card stack with predictive animations
- **[Navigation Drawer](examples/navigation-drawer)** - Smooth drawer with predictive opening/closing
- **[Image Gallery](examples/image-gallery)** - Gallery with buttery smooth image transitions

## 🚀 5-Minute Setup Guide

This library uses **Rust** for high-performance calculations, but don't worry! Everything is pre-built and you don't need to know Rust or have any Rust tools installed.

### Prerequisites

- React Native 0.70 or higher
- iOS 13.0+ / Android 6.0+ (API 23+)
- [react-native-gesture-handler](https://docs.swmansion.com/react-native-gesture-handler/) (required for gesture handling)
- [react-native-reanimated](https://docs.swmansion.com/react-native-reanimated/) (required for animations)

### Step 1: Install the Package

```bash
# Using npm
npm install react-native-swipe-predictor react-native-gesture-handler react-native-reanimated

# Using yarn
yarn add react-native-swipe-predictor react-native-gesture-handler react-native-reanimated
```

### Step 2: Platform-Specific Setup

#### iOS Setup

1. Install CocoaPods dependencies:
```bash
cd ios && pod install
```

2. **Important for M1/M2 Macs**: If you encounter architecture issues:
```bash
cd ios && arch -x86_64 pod install
```

3. Open your project in Xcode and ensure:
   - Minimum iOS Deployment Target is 13.0 or higher
   - Build Settings → Enable Bitcode is set to "No"

#### Android Setup

1. Ensure your `android/build.gradle` has:
```gradle
buildscript {
    ext {
        minSdkVersion = 23  // or higher
        compileSdkVersion = 33  // or higher
        targetSdkVersion = 33  // or higher
    }
}
```

2. If you're using React Native 0.73+, no additional setup is needed!

3. For older React Native versions, add to `android/app/build.gradle`:
```gradle
android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsi.so'
        pickFirst '**/libreact_nativemodule_core.so'
    }
}
```

### Step 3: Verify Installation

Create a test component to verify everything is working:

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSwipePredictor } from 'react-native-swipe-predictor';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

function TestSwipe() {
  const translateX = useSharedValue(0);
  
  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    onPrediction: ({ x, confidence }) => {
      'worklet';
      if (confidence > 0.7) {
        console.log('Prediction working! X:', x);
        translateX.value = withSpring(x);
      }
    },
  });
  
  const gesture = Gesture.Pan()
    .onBegin(() => runOnJS(onTouchStart)())
    .onUpdate((e) => {
      translateX.value = e.translationX;
      runOnJS(onTouchMove)(e);
    })
    .onEnd(() => {
      runOnJS(onTouchEnd)();
      translateX.value = withSpring(0);
    });
    
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.box, animatedStyle]}>
          <Text style={styles.text}>Swipe Me!</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    width: 200,
    height: 200,
    backgroundColor: '#3498db',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TestSwipe;
```

### Step 4: Run Your App

```bash
# iOS
npx react-native run-ios

# Android
npx react-native run-android
```

If everything is set up correctly, you should be able to swipe the blue box and see it animate smoothly!

## Quick Start

```tsx
import { useSwipePredictor } from "react-native-swipe-predictor";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

function SwipeableCard() {
  const translateX = useSharedValue(0);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    onPrediction: ({ x, confidence }) => {
      "worklet";
      // Start animating toward predicted position immediately
      if (confidence > 0.7) {
        translateX.value = withSpring(x);
      }
    },
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

## API Reference

### `useSwipePredictor(options)`

The main hook for gesture prediction.

#### Options

| Option                | Type                                  | Default          | Description                                                  |
| --------------------- | ------------------------------------- | ---------------- | ------------------------------------------------------------ |
| `confidenceThreshold` | `number`                              | `0.7`            | Minimum confidence (0-1) required to trigger predictions     |
| `updateInterval`      | `number`                              | `16`             | How often to emit predictions in milliseconds (16ms = 60fps) |
| `onPrediction`        | `function`                            | -                | Called with prediction data when confidence threshold is met |
| `physics`             | `'ios' \| 'android' \| PhysicsConfig` | Platform default | Physics model to use for predictions                         |
| `debug`               | `boolean`                             | `false`          | Show debug overlay with prediction visualization             |

#### Returns

| Property       | Type                 | Description                                  |
| -------------- | -------------------- | -------------------------------------------- |
| `onTouchStart` | `() => void`         | Call when gesture begins                     |
| `onTouchMove`  | `(event) => void`    | Call on gesture update with event data       |
| `onTouchEnd`   | `() => void`         | Call when gesture ends                       |
| `prediction`   | `Prediction \| null` | Current prediction data                      |
| `isActive`     | `boolean`            | Whether a gesture is currently being tracked |

#### Prediction Object

```typescript
interface Prediction {
  x: number; // Predicted end X position
  y: number; // Predicted end Y position
  vx: number; // Current X velocity
  vy: number; // Current Y velocity
  confidence: number; // Prediction confidence (0-1)
  duration: number; // Predicted gesture duration (ms)
}
```

### `SwipePredictorDebugOverlay`

Visual debugging component that shows prediction data.

```tsx
import { SwipePredictorDebugOverlay } from "react-native-swipe-predictor";

<SwipePredictorDebugOverlay
  isActive={isActive}
  prediction={prediction}
  touchPoints={touchPoints}
  currentVelocity={velocity}
/>;
```

## Performance

Our Rust-powered prediction engine delivers:

- **< 0.5ms** prediction calculation time
- **60-120 FPS** support with no frame drops
- **< 1MB** memory footprint
- **0% CPU** usage when idle

### Benchmark Results

```
Device: iPhone 15 Pro (120Hz)
Average Latency: 0.42ms
Max Latency: 1.2ms
Maintained FPS: 120
1000 swipes: 0 dropped frames
```

## Advanced Usage

### Custom Physics

Fine-tune the physics model for your specific use case:

```tsx
const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
  physics: {
    deceleration: 1500, // px/s²
    minimumVelocity: 50, // px/s
    projectionTime: 300, // ms
    smoothingFactor: 0.8,
  },
});
```

### Platform-Specific Behavior

```tsx
const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
  physics: Platform.OS === "ios" ? "ios" : "android",
  // iOS: Smoother, more elastic feel
  // Android: Snappier, more direct response
});
```

### Debug Mode

Enable visual debugging to see predictions in real-time:

```tsx
const swipePredictor = useSwipePredictor({
  debug: true, // Shows velocity vectors and predicted endpoints
  onPrediction: ({ x, y, confidence }) => {
    console.log(`Prediction: ${x}, ${y} (confidence: ${confidence})`);
  },
});
```

## Troubleshooting

### Common Issues

**Predictions seem delayed**

- Ensure you're using worklets for `onPrediction`
- Check that frame rate isn't being limited by other operations

**Confidence is always low**

- User might be making erratic movements
- Try adjusting the physics parameters
- Ensure touch events are being forwarded correctly

**Module not found errors**

- Run `cd ios && pod install`
- Clean and rebuild your project
- Check that auto-linking worked correctly

## Architecture

React Native Swipe Predictor uses a three-layer architecture:

1. **Rust Core** - High-performance physics calculations
2. **Native Bridges** - Swift (iOS) and Kotlin (Android) modules
3. **JavaScript API** - React hooks and components

The Rust core maintains a rolling buffer of touch points and uses physics equations to predict the final position based on velocity and deceleration patterns.

## Comparison

| Feature            | Standard RN | With Swipe Predictor |
| ------------------ | ----------- | -------------------- |
| Response time      | 80-120ms    | 0ms                  |
| Feels native       | No          | Yes                  |
| Frame drops        | Common      | None                 |
| Setup complexity   | Low         | Low                  |
| Bundle size impact | 0KB         | ~200KB               |

## > Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repo
git clone https://github.com/emuchnick/react-native-swipe-predictor

# Install dependencies
yarn install

# Build Rust libraries
yarn build:rust

# Run example app
cd example && yarn ios
```

## License

MIT © Ethan Muchnick

---

<p align="center">
  Made with love by developers who care about 60fps
</p>
