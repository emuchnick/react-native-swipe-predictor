import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { usePredictiveCards } from "react-native-swipe-predictor";
import Animated, {
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolate,
  useSharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

/**
 * Get device width for responsive card sizing
 */
const { width } = Dimensions.get("window");

/**
 * Sample profile data for the card stack
 * @constant {Array<{id: number, name: string, age: number, color: string}>}
 */
const SAMPLE_PROFILES = [
  { id: 1, name: "Alex", age: 28, color: "#FF6B6B" },
  { id: 2, name: "Sam", age: 25, color: "#4ECDC4" },
  { id: 3, name: "Jordan", age: 30, color: "#45B7D1" },
  { id: 4, name: "Casey", age: 27, color: "#96CEB4" },
  { id: 5, name: "Morgan", age: 29, color: "#FECA57" },
];

/**
 * CardsDemo - Tinder-style card swiping with predictive feedback
 * 
 * @description
 * This screen demonstrates how SwipePredictor enhances card-based interfaces.
 * Features include:
 * - Predictive "LIKE" / "NOPE" indicators that appear before gesture completion
 * - Smooth animations driven by prediction confidence
 * - Card rotation and opacity changes based on swipe direction
 * - Stack visualization with background cards
 * 
 * The demo uses the specialized `usePredictiveCards` hook which provides:
 * - Pre-configured swipe thresholds
 * - Action prediction (like/dislike/superlike)
 * - Gesture state management
 * 
 * @component
 * @returns {JSX.Element} Interactive card stack with swipe gestures
 * 
 * @example
 * // The component manages its own state for the card stack
 * // and resets when all cards have been swiped
 */
export default function CardsDemo() {
  const [profiles] = useState(SAMPLE_PROFILES);
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    prediction,
    isActive,
    predictedAction,
  } = usePredictiveCards({
    onActionPredicted: (action, confidence) => {
      console.log("Predicted action:", action, "with confidence:", confidence);
    },
    horizontalThreshold: width * 0.4,
    enableSuperlike: false,
  });

  const gesture = Gesture.Pan()
    .onBegin(() => {
      onTouchStart();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      onTouchMove(event);
    })
    .onEnd((_event) => {
      onTouchEnd(undefined);
      const shouldSwipe = Math.abs(translateX.value) > width * 0.4;
      if (shouldSwipe) {
        translateX.value = withSpring(translateX.value > 0 ? width : -width);
        translateY.value = withSpring(0);
        setTimeout(() => {
          setCurrentIndex((prev) => prev + 1);
          translateX.value = 0;
          translateY.value = 0;
        }, 300);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const resetCards = () => {
    setCurrentIndex(0);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  };

  const currentProfile = profiles[currentIndex % profiles.length];

  const animatedCardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-width / 2, 0, width / 2],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [0, width / 4],
        [0, 1],
        Extrapolate.CLAMP
      ),
    };
  });

  const nopeOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        translateX.value,
        [-width / 4, 0],
        [1, 0],
        Extrapolate.CLAMP
      ),
    };
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Swipe cards with predictive feedback</Text>
        <Text style={styles.subtitle}>Swipe right to like, left to pass</Text>
      </View>

      <View style={styles.cardContainer}>
        {/* Background cards */}
        {profiles
          .slice(currentIndex + 1, currentIndex + 3)
          .map((profile, index) => (
            <View
              key={profile.id}
              style={[
                styles.card,
                { backgroundColor: profile.color },
                {
                  transform: [
                    { scale: 1 - (index + 1) * 0.05 },
                    { translateY: (index + 1) * 10 },
                  ],
                  zIndex: -index - 1,
                },
              ]}
            />
          ))}

        {/* Active card */}
        {currentIndex < profiles.length && (
          <GestureDetector gesture={gesture}>
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: currentProfile.color },
                animatedCardStyle,
              ]}
            >
              <Text style={styles.cardName}>{currentProfile.name}</Text>
              <Text style={styles.cardAge}>{currentProfile.age} years old</Text>

              <Animated.View
                style={[
                  styles.choiceContainer,
                  styles.likeContainer,
                  likeOpacityStyle,
                ]}
              >
                <Text style={styles.choiceText}>LIKE</Text>
              </Animated.View>

              <Animated.View
                style={[
                  styles.choiceContainer,
                  styles.nopeContainer,
                  nopeOpacityStyle,
                ]}
              >
                <Text style={styles.choiceText}>NOPE</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        )}

        {currentIndex >= profiles.length && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No more cards!</Text>
            <TouchableOpacity style={styles.resetButton} onPress={resetCards}>
              <Text style={styles.resetButtonText}>Reset Cards</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.stats}>
        {predictedAction && isActive ? (
          <>
            <Text style={styles.statsText}>
              Predicted action: {predictedAction?.toUpperCase() || "NONE"}
            </Text>
            {prediction && (
              <Text style={styles.statsText}>
                Confidence: {(prediction.confidence * 100).toFixed(0)}%
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.statsText}>Swipe a card to see predictions</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: "#1C1C1E",
    borderBottomWidth: 1,
    borderBottomColor: "#2C2C2E",
  },
  title: {
    fontSize: 16,
    color: "#FFFFFF",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#8E8E93",
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    position: "absolute",
    width: width - 40,
    height: width * 1.2,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardName: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 5,
  },
  cardAge: {
    fontSize: 18,
    color: "#FFFFFF",
    opacity: 0.9,
  },
  choiceContainer: {
    position: "absolute",
    top: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 4,
    borderRadius: 10,
  },
  likeContainer: {
    right: 20,
    borderColor: "#34C759",
    transform: [{ rotate: "20deg" }],
  },
  nopeContainer: {
    left: 20,
    borderColor: "#FF3B30",
    transform: [{ rotate: "-20deg" }],
  },
  choiceText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  emptyState: {
    alignItems: "center",
  },
  emptyText: {
    fontSize: 20,
    color: "#8E8E93",
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  stats: {
    backgroundColor: "#1C1C1E",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#2C2C2E",
  },
  statsText: {
    fontSize: 14,
    color: "#FFFFFF",
    marginBottom: 5,
  },
});
