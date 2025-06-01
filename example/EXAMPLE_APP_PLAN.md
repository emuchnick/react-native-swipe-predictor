# SwipePredictor Example App Plan

## Overview

A minimal example app to demonstrate the core capabilities of react-native-swipe-predictor library. Focus on simplicity and clear demonstration of features.

## App Structure

```
example/
├── App.tsx              → Main app with tab navigation
├── screens/
│   ├── BasicDemo.tsx    → Basic swipe prediction with debug overlay
│   ├── CardsDemo.tsx    → Simple Tinder-style cards
│   └── GalleryDemo.tsx  → Image gallery with preloading
├── components/
│   └── DemoCard.tsx     → Reusable card component
└── assets/
    └── images/          → 10-15 sample images
```

## Screen Specifications

### 1. Basic Demo (Main Showcase)

- **Purpose**: Demonstrate core prediction functionality
- **Features**:
  - Full screen gesture area
  - Toggle debug overlay on/off
  - Display real-time prediction coordinates
  - Show confidence level
  - Simple instruction text

### 2. Cards Demo

- **Purpose**: Show practical use case with Tinder-style cards
- **Features**:
  - Stack of 5-6 cards with sample profiles
  - Visual feedback for like/dislike zones
  - Prediction-based opacity changes
  - Reset button to try again
  - Uses `usePredictiveCards` hook

### 3. Gallery Demo

- **Purpose**: Demonstrate predictive image preloading
- **Features**:
  - Horizontal scroll with 10-15 images
  - Preload indicator (border color)
  - Toggle between predictive/standard mode
  - Uses `usePredictiveImageGallery` hook

## Implementation Details

### Dependencies

```json
{
  "dependencies": {
    "react-native-swipe-predictor": "file:../",
    "react-native-gesture-handler": "~2.x",
    "react-native-reanimated": "~3.x",
    "@react-navigation/bottom-tabs": "^6.x",
    "@react-navigation/native": "^6.x",
    "react-native-screens": "~3.x",
    "react-native-safe-area-context": "~4.x"
  }
}
```

### Key Implementation Points

1. **Navigation**: Simple bottom tabs using React Navigation
2. **Styling**: Use StyleSheet with minimal, clean design
3. **Colors**:
   - Primary: `#007AFF` (iOS blue)
   - Success: `#34C759` (green)
   - Danger: `#FF3B30` (red)
   - Background: `#F5F5F5`
4. **No External APIs**: All data hardcoded
5. **No Configuration UI**: Use sensible defaults

### Sample Data Structure

```typescript
// For Cards Demo
const SAMPLE_PROFILES = [
  { id: 1, name: "Alex", age: 28, color: "#FF6B6B" },
  { id: 2, name: "Sam", age: 25, color: "#4ECDC4" },
  { id: 3, name: "Jordan", age: 30, color: "#45B7D1" },
  { id: 4, name: "Casey", age: 27, color: "#96CEB4" },
  { id: 5, name: "Morgan", age: 29, color: "#FECA57" },
];

// For Gallery Demo
const GALLERY_IMAGES = [
  require("./assets/images/photo1.jpg"),
  require("./assets/images/photo2.jpg"),
  // ... etc
];
```

### Code Examples

#### Basic Demo Core

```typescript
const BasicDemo = () => {
  const [showDebug, setShowDebug] = useState(true);
  const { prediction, debugInfo, onTouchStart, onTouchMove, onTouchEnd } =
    useSwipePredictor();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Swipe anywhere to see predictions</Text>
        <Switch value={showDebug} onValueChange={setShowDebug} />
      </View>

      <View
        style={styles.gestureArea}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {showDebug && (
          <SwipePredictorDebugOverlay
            debugInfo={debugInfo}
            prediction={prediction}
            width={width}
            height={height}
          />
        )}
      </View>

      {prediction && (
        <View style={styles.stats}>
          <Text>
            Prediction: ({Math.round(prediction.x)}, {Math.round(prediction.y)})
          </Text>
          <Text>Confidence: {(prediction.confidence * 100).toFixed(0)}%</Text>
        </View>
      )}
    </View>
  );
};
```

## Development Timeline

1. **Hour 1**: Setup & Navigation

   - Initialize Expo app
   - Add dependencies
   - Setup tab navigation
   - Create screen placeholders

2. **Hour 2**: Basic Demo

   - Implement gesture handling
   - Add debug overlay toggle
   - Display prediction data

3. **Hour 3**: Cards & Gallery

   - Implement cards with `usePredictiveCards`
   - Add gallery with `usePredictiveImageGallery`
   - Add sample images and data

4. **Final Polish**:
   - Test on both platforms
   - Add simple instructions
   - Clean up styling

## Excluded Features (Keep it Simple)

- ❌ Configuration screens
- ❌ Performance metrics dashboard
- ❌ Light mode (use dark mode by default)
- ❌ Onboarding flow (no need for auth in a demo app)
- ❌ State management (Redux/Context)
- ❌ API integrations
- ❌ Complex animations
- ❌ Multiple physics presets
- ❌ Export functionality

## Success Criteria

- ✅ Clearly demonstrates the 80ms advantage
- ✅ Shows practical use cases
- ✅ Easy to understand code
- ✅ Minimal dependencies
- ✅ Works on both iOS and Android
- ✅ Can be built and run in < 5 minutes
