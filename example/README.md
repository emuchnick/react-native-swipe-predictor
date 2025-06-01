# SwipePredictor Example App

This example app demonstrates the capabilities of the `react-native-swipe-predictor` library through four interactive demos. Experience how physics-based gesture prediction can enhance user interfaces with responsive, anticipatory animations.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- Yarn or npm
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Mac only) or Android Emulator
- Expo Go app on your physical device (optional)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/emuchnick/react-native-swipe-predictor.git
   cd react-native-swipe-predictor
   ```

2. **Install example dependencies**
   ```bash
   cd example
   yarn install
   ```

### Running the App

#### iOS (Simulator)

```bash
yarn ios
```

#### Android (Emulator)

```bash
yarn android
```

#### Expo Go (Physical Device)

```bash
yarn start
```

Then scan the QR code with Expo Go (Android) or Camera app (iOS)

## 📱 Demo Screens

### 1. Basic Demo

**Purpose:** Demonstrates core swipe prediction functionality with visual debugging tools.

**Features:**

- Real-time gesture tracking
- Debug overlay showing prediction paths
- Confidence level visualization
- Toggle debug mode on/off

**Try This:**

- Swipe anywhere on the screen
- Watch the blue prediction dot show where your gesture will end
- Toggle debug mode to see detailed path visualization
- Notice how predictions update in real-time

### 2. Cards Demo

**Purpose:** Shows practical implementation with Tinder-style swipeable cards.

**Features:**

- Predictive "LIKE" / "NOPE" feedback
- Card stack with smooth animations
- Gesture-based interaction
- Prediction confidence display

**Try This:**

- Swipe cards left (NOPE) or right (LIKE)
- Notice how the action is predicted before you release
- Watch the card opacity change based on prediction
- Reset cards to try different swipe speeds

### 3. Gallery Demo

**Purpose:** Demonstrates predictive image preloading for smooth scrolling.

**Features:**

- Horizontal scrollable gallery
- Visual preloading indicators
- Toggle between predictive and standard mode
- Real-time preload status

**Try This:**

- Scroll through the gallery horizontally
- Watch green borders indicate preloaded images
- Toggle predictive mode off to see the difference
- Notice how images are ready before you reach them

### 4. Game Physics Demo

**Purpose:** Interactive physics playground showing gaming applications.

**Features:**

- Throwable objects with physics simulation
- Real-time trajectory prediction
- Target shooting with scoring
- Adjustable gravity settings
- Toggle prediction visualization

**Try This:**

- Swipe to throw objects at targets
- Blue dots show predicted trajectory path
- Blue circle shows predicted landing spot
- Adjust gravity to see different physics behaviors
- Toggle prediction off to play without assistance
- Try to hit all targets for maximum score

## 🏗️ Architecture

### Library Integration

The example app demonstrates three ways to use SwipePredictor:

1. **Direct Hook Usage** (`useSwipePredictor`)

   - Used in BasicDemo and GameDemo
   - Provides raw prediction data
   - Full control over gesture handling

2. **Specialized Hooks**

   - `usePredictiveCards` - Tinder-style card interactions
   - `usePredictiveImageGallery` - Predictive content preloading

3. **Debug Components**
   - `SwipePredictorDebugOverlay` - Visual debugging tool

### Key Concepts

- **Prediction Confidence**: 0-1 value indicating prediction reliability
- **Physics-Based Calculations**: Uses velocity and deceleration for accurate predictions
- **Real-time Updates**: Predictions update at 60 FPS by default
- **Platform Optimization**: Different physics parameters for iOS and Android

## 🛠️ Customization

### Modifying Physics Parameters

Edit the physics configuration in any demo:

```typescript
const { prediction } = useSwipePredictor({
  confidenceThreshold: 0.7, // Minimum confidence for predictions
  updateInterval: 16, // Update frequency in ms
  physics: {
    decelerationRate: 1500, // How quickly gestures slow down
    minVelocityThreshold: 50, // Minimum velocity to track
    velocitySmoothingFactor: 0.7, // Gesture smoothing (0-1)
  },
});
```

### Adding New Demos

1. Create a new screen in `screens/`
2. Import and use `useSwipePredictor` hook
3. Add to navigation in `App.tsx`

## 🐛 Troubleshooting

### Build Issues

**"Module not found: react-native-swipe-predictor"**

- Run `yarn build` in the root directory
- Ensure you've run `yarn install` in both root and example directories

**"Unable to resolve module @react-native-community/slider"**

```bash
cd example
yarn add @react-native-community/slider
cd ios && pod install
```

### Runtime Issues

**Predictions not showing**

- Check console for native module warnings
- Rebuild the app after library changes
- Ensure gesture handlers are properly connected

**Poor prediction accuracy**

- Adjust `confidenceThreshold` (lower = more predictions)
- Tune physics parameters for your use case
- Ensure consistent gesture speed

### Platform-Specific

**iOS Simulator**

- Use trackpad/mouse for more accurate gestures
- Enable "Slow Animations" in Simulator menu for debugging

**Android Emulator**

- Enable GPU acceleration for better performance
- Use x86_64 images for faster execution

## 📚 Learn More

- [Main Library Documentation](../README.md)
- [API Reference](../docs/API.md)
- [Platform Physics Guide](../docs/platform-physics.md)

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue in the main repository.

When reporting issues, please include:

- Device/Emulator details
- OS version
- Steps to reproduce
- Expected vs actual behavior
- Any error messages

## 📄 License

This example app is part of the react-native-swipe-predictor library and follows the same MIT license.
