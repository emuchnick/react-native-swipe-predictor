import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  SafeAreaView,
  Switch,
  TouchableOpacity,
} from "react-native";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { useSwipePredictor, SwipePredictorDebugOverlay } from "react-native-swipe-predictor";
import BenchmarksScreen from "./benchmarks";
import DemoSelector, { DemoType } from "./demos/DemoSelector";
import InstagramStoriesDemo from "./demos/InstagramStories";
import TinderCardsDemo from "./demos/TinderCards";
import ImageGalleryDemo from "./demos/ImageGallery";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const CARD_WIDTH = screenWidth * 0.85;
const CARD_HEIGHT = screenHeight * 0.6;

function SwipeableCard() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const predictedX = useSharedValue(0);
  const predictedY = useSharedValue(0);

  const [showDebug, setShowDebug] = React.useState(true);
  const [cardColor, setCardColor] = React.useState("#007AFF");

  const { onTouchStart, onTouchMove, onTouchEnd, prediction, debugInfo } =
    useSwipePredictor({
      confidenceThreshold: 0.7,
      updateInterval: 16, // 60fps
      onPrediction: ({ x, y, confidence }) => {
        "worklet";
        // Start animating toward predicted position
        if (confidence > 0.7) {
          predictedX.value = withSpring(x, {
            damping: 15,
            stiffness: 100,
          });
          predictedY.value = withSpring(y, {
            damping: 15,
            stiffness: 100,
          });
        }
      },
      debug: showDebug,
    });

  const resetCard = () => {
    "worklet";
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    predictedX.value = withSpring(0);
    predictedY.value = withSpring(0);
  };

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      onTouchStart(e);
      runOnJS(setCardColor)("#FF3B30");
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      runOnJS(onTouchMove)(e);
    })
    .onEnd((e) => {
      onTouchEnd(e);
      runOnJS(setCardColor)("#007AFF");

      // Determine if card should be swiped away
      const shouldDismiss = Math.abs(e.translationX) > screenWidth * 0.3;

      if (shouldDismiss) {
        const direction = e.translationX > 0 ? 1 : -1;
        translateX.value = withSpring(screenWidth * direction * 1.5);
        translateY.value = withSpring(e.translationY * 2);

        // Reset after animation
        runOnJS(() => {
          setTimeout(() => {
            resetCard();
          }, 300);
        })();
      } else {
        resetCard();
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${(translateX.value / screenWidth) * 20}deg` },
    ],
  }));

  const predictedCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: predictedX.value },
      { translateY: predictedY.value },
      { rotate: `${(predictedX.value / screenWidth) * 20}deg` },
    ],
    opacity: prediction?.confidence || 0,
  }));

  return (
    <View style={styles.container}>
      {/* Predicted position ghost */}
      <Animated.View
        style={[styles.card, styles.predictedCard, predictedCardStyle]}
      >
        <Text style={styles.predictedText}>Predicted Position</Text>
      </Animated.View>

      {/* Actual card */}
      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[styles.card, { backgroundColor: cardColor }, cardStyle]}
        >
          <Text style={styles.cardTitle}>Swipe Me!</Text>
          <Text style={styles.cardSubtitle}>
            The ghost shows where I'll end up
          </Text>
          {prediction && (
            <Text style={styles.confidenceText}>
              Confidence: {(prediction.confidence * 100).toFixed(0)}%
            </Text>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Debug overlay */}
      {showDebug && (
        <SwipePredictorDebugOverlay
          debugInfo={debugInfo}
          prediction={prediction}
          width={screenWidth}
          height={screenHeight}
        />
      )}

      {/* Debug toggle */}
      <View style={styles.debugToggle}>
        <Text style={styles.debugToggleText}>Show Debug</Text>
        <Switch value={showDebug} onValueChange={setShowDebug} />
      </View>
    </View>
  );
}

export default function App() {
  const [currentDemo, setCurrentDemo] = useState<DemoType | 'benchmarks' | null>(null);

  // Demo header with back button
  const DemoHeader = ({ title }: { title: string }) => (
    <View style={styles.demoHeader}>
      <TouchableOpacity style={styles.backButton} onPress={() => setCurrentDemo(null)}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.demoHeaderTitle}>{title}</Text>
    </View>
  );

  // Render selected demo
  if (currentDemo === 'benchmarks') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <DemoHeader title="Benchmarks" />
        <BenchmarksScreen />
      </GestureHandlerRootView>
    );
  }

  if (currentDemo === 'instagram') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <DemoHeader title="Instagram Stories" />
        <InstagramStoriesDemo />
      </GestureHandlerRootView>
    );
  }

  if (currentDemo === 'tinder') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <DemoHeader title="Tinder Cards" />
        <TinderCardsDemo />
      </GestureHandlerRootView>
    );
  }

  if (currentDemo === 'gallery') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <DemoHeader title="Image Gallery" />
        <ImageGalleryDemo />
      </GestureHandlerRootView>
    );
  }

  if (currentDemo === 'basic') {
    return (
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.root}>
          <DemoHeader title="Basic Demo" />
          <SwipeableCard />
          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              Swipe the card in any direction.{"\n"}
              Watch the green ghost predict where it will go!
            </Text>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    );
  }

  // Show demo selector
  return (
    <GestureHandlerRootView style={styles.root}>
      <DemoSelector onSelectDemo={setCurrentDemo} />
      <TouchableOpacity 
        style={styles.benchmarkButton} 
        onPress={() => setCurrentDemo('benchmarks')}
      >
        <Text style={styles.benchmarkButtonText}>Run Benchmarks</Text>
      </TouchableOpacity>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    padding: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: "absolute",
  },
  predictedCard: {
    backgroundColor: "#34C759",
    borderWidth: 2,
    borderColor: "#34C759",
    borderStyle: "dashed",
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: "white",
    opacity: 0.9,
    textAlign: "center",
  },
  predictedText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  confidenceText: {
    position: "absolute",
    bottom: 20,
    fontSize: 14,
    color: "white",
    opacity: 0.8,
  },
  instructions: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    alignItems: "center",
  },
  instructionText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
  debugToggle: {
    position: "absolute",
    top: 50,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 10,
    borderRadius: 8,
  },
  debugToggleText: {
    color: "white",
    marginRight: 10,
    fontSize: 14,
  },
  demoHeader: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 100,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  demoHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 10,
  },
  benchmarkButton: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  benchmarkButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
