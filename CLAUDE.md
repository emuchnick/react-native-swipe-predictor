# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

react-native-swipe-predictor is a high-performance React Native library that predicts touch gesture endpoints using physics-based calculations implemented in Rust. It eliminates the typical 80ms delay in gesture handling by starting animations before the user lifts their finger.

## Architecture

The codebase follows a three-layer architecture:

1. **Rust Core** (`src/rust/src/lib.rs`): Physics calculations, prediction algorithms, and performance-critical logic
2. **Native Bridges**: iOS Swift (`ios/SwipePredictor/`) and Android Kotlin (`android/src/main/java/com/swipepredictor/`) modules that interface with Rust via FFI
3. **JavaScript API** (`src/`): React hooks and components with TypeScript support

## Common Commands

### Building

```bash
# Build everything (JS + native libraries)
yarn build

# Build Rust libraries only
yarn build:rust         # Both platforms
yarn build:rust:ios     # iOS only
yarn build:rust:android # Android only

# Watch mode for JS/TS development
yarn dev
```

### Code Quality

```bash
# Run TypeScript type checking
yarn typecheck

# Run ESLint
yarn lint

# Run tests (when implemented)
yarn test
```

### Rust Development

```bash
# Run Rust tests
cd src/rust && cargo test

# Build iOS library manually
cd src/rust && ./build-ios.sh

# Build Android library manually
cd src/rust && ./build-android.sh
```

### Example App

```bash
# Install dependencies
cd example && yarn install

# Run on iOS
cd example && yarn ios

# Run on Android
cd example && yarn android
```

## Key Implementation Details

### Rust-Native Bridge

- iOS uses Swift with C bindings exported from Rust
- Android uses Kotlin with JNI bindings
- Both platforms communicate with Rust through the `SwipePredictorBridge` FFI interface

### Prediction Algorithm

- Located in `src/rust/src/lib.rs`
- Uses physics-based calculations with configurable deceleration rates
- Maintains a buffer of recent touch points for velocity calculation
- Includes confidence scoring based on gesture straightness and consistency

### Native Module Registration

- iOS: `ios/SwipePredictor/SwipePredictorModule.m` registers the Swift module
- Android: `android/src/main/java/com/swipepredictor/SwipePredictorPackage.kt` registers the Kotlin module

### JavaScript API

- Main hook: `src/js/hooks/useSwipePredictor.tsx`
- Debug overlay: `src/js/components/SwipePredictorDebugOverlay.tsx`
- Native module interface: `src/js/native/SwipePredictorModule.ts`

## Testing

- Rust unit tests are in `src/rust/src/lib.rs` (test module at bottom)
- JavaScript/TypeScript tests should be added to `__tests__/` directory
- Integration testing through the example app
- Performance benchmarking available in `example/benchmarks.tsx`
