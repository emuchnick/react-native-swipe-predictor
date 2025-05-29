# React Native Swipe Predictor Example

This example demonstrates the capabilities of the `react-native-swipe-predictor` library with an interactive swipeable card interface.

## Features Demonstrated

- **Swipeable Card**: A draggable card that can be swiped in any direction
- **Prediction Visualization**: A green "ghost" card shows where the library predicts the swipe will end
- **Debug Overlay**: Toggle-able overlay showing real-time physics calculations
- **Performance Benchmarks**: Built-in benchmark screen to test prediction performance

## Setup

### Prerequisites

- Node.js (16+)
- React Native development environment set up for iOS/Android
- Xcode (for iOS development)
- Android Studio (for Android development)

### Installation

1. Install dependencies:
   ```bash
   cd example
   yarn install
   ```

2. Install iOS pods (macOS only):
   ```bash
   cd ios
   pod install
   cd ..
   ```

## Running the Example

### iOS

```bash
yarn ios
```

Or manually:
```bash
npx react-native run-ios
```

### Android

```bash
yarn android
```

Or manually:
```bash
npx react-native run-android
```

### Metro Bundler Only

If you already have the app installed on your device/simulator:
```bash
yarn start
```

## Project Structure

- `App.tsx` - Main example app with swipeable card demo
- `benchmarks.tsx` - Performance benchmarking screen
- `metro.config.js` - Metro configuration to use the local library
- `tsconfig.json` - TypeScript configuration with path mapping

## Features

### Swipeable Card Demo

The main screen shows:
- A blue card that responds to swipe gestures
- A green ghost card that predicts where the swipe will end
- Real-time confidence percentage
- Debug overlay toggle showing velocity vectors and prediction calculations

### Benchmarks Screen

Access via "Run Benchmarks" button to test:
- Prediction latency
- Frame rate during gestures
- Calculation accuracy
- Memory usage

## Troubleshooting

### Build Issues

If you encounter build issues:

1. Clean build folders:
   ```bash
   cd ios && rm -rf build && cd ..
   cd android && ./gradlew clean && cd ..
   ```

2. Reset Metro cache:
   ```bash
   npx react-native start --reset-cache
   ```

3. Reinstall dependencies:
   ```bash
   rm -rf node_modules
   yarn install
   cd ios && pod install && cd ..
   ```

### Module Not Found

If you see "Cannot find module 'react-native-swipe-predictor'":
- Ensure you've built the parent library first: `cd .. && yarn build`
- Check that metro.config.js is properly configured
- Restart Metro bundler with cache reset

## Development Tips

- The example uses the local development version of the library via Metro's `extraNodeModules` configuration
- Changes to the library source will be reflected after rebuilding and reloading
- Use the debug overlay to understand prediction calculations in real-time
- The benchmark screen helps identify performance bottlenecks