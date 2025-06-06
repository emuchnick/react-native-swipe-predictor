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

## Who Needs This Library?

### ✅ You NEED this if you're building:

- **Dating apps with card swiping** (Tinder-style) - Predict swipe decisions and start card animations early
- **Media apps with heavy images/videos** - Pre-load next content based on swipe trajectory
- **Games or drawing apps** in React Native - Eliminate input lag for better responsiveness
- **Apps targeting older Android devices** (pre-2020) - Compensate for slower touch processing
- **Any UI where 80ms latency is noticeable** - Navigation drawers, carousels, dismissible cards

### ❌ You DON'T need this for:

- Simple CRUD apps with basic navigation
- Apps with standard scrolling lists (ScrollView/FlatList handle this well)
- Apps only targeting iPhone 12+ (already have excellent touch latency)
- Forms, buttons, or tap-based interactions
- Apps where animations can wait until after touch release

### Real-world impact:

- **Instagram Stories**: Pre-load next story when user starts swiping = instant transitions
- **Image Galleries**: Start loading hi-res image before swipe completes = no loading state
- **Navigation Drawers**: Begin open/close animation during swipe = feels native
- **Card Games**: Predict throw trajectory for realistic physics = better game feel

## 🚀 5-Minute Setup Guide

This library uses **Rust** for high-performance calculations, but don't worry! Everything is pre-built and you don't need to know Rust or have any Rust tools installed.

### Prerequisites

- React Native 0.70 or higher
- iOS 15.1+ / Android 6.0+ (API 23+)
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

2. **Important for M1/M2 Macs**: If you encounter architecture issues, try:

```bash
cd ios && arch -x86_64 pod install
```

3. Open your project in Xcode and ensure:
   - Minimum iOS Deployment Target is 15.1 or higher
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

### Step 3: Verify Installation (optional)

Create a test component to verify everything is working:

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSwipePredictor } from "react-native-swipe-predictor";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";

function TestSwipe() {
  const translateX = useSharedValue(0);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    onPrediction: ({ x, confidence }) => {
      "worklet";
      if (confidence > 0.7) {
        console.log("Prediction working! X:", x);
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
    justifyContent: "center",
    alignItems: "center",
  },
  box: {
    width: 200,
    height: 200,
    backgroundColor: "#3498db",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
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

Alternatively, try our [Example App](/example/README.md).

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

### Helper Hooks

We provide pre-built hooks for common use cases:

#### `usePredictiveImageGallery`

Optimized for image galleries with smart preloading:

```tsx
import { usePredictiveImageGallery } from "react-native-swipe-predictor";

const { onTouchMove, onTouchStart, onTouchEnd } = usePredictiveImageGallery({
  images: imageUrls,
  currentIndex,
  imageWidth: SCREEN_WIDTH,
  onPreload: (indices, priority) => {
    indices.forEach((index) => {
      Image.prefetch(imageUrls[index]);
    });
  },
  preloadRadius: 2, // Preload 2 images in each direction
});
```

#### `usePredictiveCards`

Perfect for Tinder-style card interactions:

```tsx
import { usePredictiveCards } from "react-native-swipe-predictor";

const { onTouchMove, onTouchStart, onTouchEnd, predictedAction } =
  usePredictiveCards({
    onActionPredicted: (action, confidence) => {
      "worklet";
      switch (action) {
        case "like":
          cardRotation.value = withSpring(15);
          break;
        case "dislike":
          cardRotation.value = withSpring(-15);
          break;
        case "superlike":
          cardScale.value = withSpring(1.2);
          break;
      }
    },
    horizontalThreshold: 120,
    verticalThreshold: -100,
  });
```

#### `usePredictiveNavigation`

For navigation gestures with directional prediction:

```tsx
import { usePredictiveNavigation } from "react-native-swipe-predictor";

const { onTouchMove, onTouchStart, onTouchEnd } = usePredictiveNavigation({
  onNavigationPredicted: (direction, confidence) => {
    if (confidence > 0.8) {
      switch (direction) {
        case "left":
          prefetchScreen("NextScreen");
          break;
        case "right":
          prepareGoBack();
          break;
      }
    }
  },
  navigationThreshold: 100,
});
```

#### `useSwipePredictorWithMetrics`

Monitor performance and accuracy:

```tsx
import { useSwipePredictorWithMetrics } from "react-native-swipe-predictor";

const { onTouchMove, onTouchStart, onTouchEnd, metrics } =
  useSwipePredictorWithMetrics({
    onPrediction: ({ x, y }) => {
      // Your prediction handler
    },
    onValidatePrediction: (prediction, actual) => {
      const distance = Math.sqrt(
        Math.pow(prediction.x - actual.x, 2) +
          Math.pow(prediction.y - actual.y, 2)
      );
      return distance < 50; // Within 50 pixels
    },
  });

console.log("Average confidence:", metrics.averageConfidence);
console.log("Predictions/sec:", metrics.predictionsPerSecond);
console.log("Accuracy:", metrics.accuracy);
```

### Custom Physics

Fine-tune the physics model for your specific use case:

```tsx
const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
  physics: {
    decelerationRate: 1500, // px/s²
    minVelocityThreshold: 50, // px/s
    minGestureTimeMs: 30, // ms
    velocitySmoothingFactor: 0.7,
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

## 🔧 Troubleshooting

### Common Setup Issues

#### iOS Build Errors

**"Module 'SwipePredictor' not found"**

```bash
# Solution 1: Clean and reinstall
cd ios
pod deintegrate
pod install

# Solution 2: Clear caches
cd ..
rm -rf ~/Library/Developer/Xcode/DerivedData
npx react-native clean
```

**"Undefined symbols for architecture arm64"**

- This means the Rust library wasn't linked properly
- Ensure you ran `pod install` after installing the package
- Check that your Podfile doesn't exclude arm64 architectures

**Build fails on M1/M2 Mac**

```bash
# Install pods with Rosetta
cd ios
sudo arch -x86_64 gem install ffi
arch -x86_64 pod install
```

#### Android Build Errors

**"libreact-native-swipe-predictor.so not found"**

- Clean and rebuild:

```bash
cd android
./gradlew clean
cd ..
npx react-native run-android
```

**"Duplicate libc++\_shared.so" errors**

- Add to `android/app/build.gradle`:

```gradle
android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libjsi.so'
    }
}
```

**Minimum SDK version errors**

- Update `android/build.gradle`:

```gradle
minSdkVersion = 23  // Must be 23 or higher
```

#### Runtime Issues

**"Cannot read property 'createPredictor' of undefined"**

- The native module didn't link properly
- For React Native 0.60+: Run `npx react-native unlink react-native-swipe-predictor` then reinstall
- For older versions: Manually link following the [manual linking guide](https://reactnative.dev/docs/linking-libraries-ios)

**App crashes on launch**

- Ensure you've installed required peer dependencies:

```bash
npm list react-native-gesture-handler react-native-reanimated
```

- Follow the [gesture-handler installation guide](https://docs.swmansion.com/react-native-gesture-handler/docs/installation)
- Follow the [reanimated installation guide](https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/installation)

**Predictions seem delayed**

- Ensure you're using worklets for `onPrediction`
- Check that frame rate isn't being limited by other operations
- Try reducing `updateInterval` to 8ms for 120Hz displays

**Confidence is always low**

- User might be making erratic movements
- Try adjusting the physics parameters
- Ensure touch events are being forwarded correctly

### Still Having Issues?

1. **Check our [GitHub Issues](https://github.com/emuchnick/react-native-swipe-predictor/issues)** - Someone might have already solved your problem
2. **Enable debug mode** to see what's happening:

```tsx
const swipePredictor = useSwipePredictor({
  debug: true,
  onPrediction: (prediction) => {
    console.log("Prediction:", prediction);
  },
});
```

3. **Create a minimal reproduction** - This helps identify if the issue is with the library or your setup
4. **Open an issue** with:
   - Your React Native version
   - Platform (iOS/Android)
   - Complete error message
   - Minimal code to reproduce

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

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Remember, this library is made mostly in rust. This setup assumes you already have rust installed
# Clone the repo
git clone https://github.com/emuchnick/react-native-swipe-predictor

# Install dependencies
yarn install

# Build Rust libraries
yarn build:rust

# Run example app
cd example && yarn ios
```

---

## License

MIT © Ethan Muchnick
