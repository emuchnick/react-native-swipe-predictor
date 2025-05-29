import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  SafeAreaView,
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
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { useSwipePredictor } from "../../src"; //This would be replaced with 'react-native-swipe-predictor' in your code

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");
const CARD_WIDTH = screenWidth * 0.9;
const CARD_HEIGHT = screenHeight * 0.7;
const SWIPE_THRESHOLD = screenWidth * 0.25;

interface Profile {
  id: number;
  name: string;
  age: number;
  bio: string;
  image: string;
}

const profiles: Profile[] = [
  {
    id: 1,
    name: "Emma",
    age: 28,
    bio: "Love hiking and coffee ☕",
    image: "https://picsum.photos/400/600?random=1",
  },
  {
    id: 2,
    name: "James",
    age: 32,
    bio: "Musician and dog lover 🎸🐕",
    image: "https://picsum.photos/400/600?random=2",
  },
  {
    id: 3,
    name: "Sofia",
    age: 26,
    bio: "Travel enthusiast ✈️",
    image: "https://picsum.photos/400/600?random=3",
  },
  {
    id: 4,
    name: "Alex",
    age: 29,
    bio: "Foodie and chef 👨‍🍳",
    image: "https://picsum.photos/400/600?random=4",
  },
];

function TinderCard({
  profile,
  onSwipe,
  index,
}: {
  profile: Profile;
  onSwipe: (direction: "left" | "right") => void;
  index: number;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const predictedX = useSharedValue(0);
  const scale = useSharedValue(1);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(
    null
  );

  const { onTouchStart, onTouchMove, onTouchEnd, prediction } =
    useSwipePredictor({
      confidenceThreshold: 0.6,
      updateInterval: 16,
      onPrediction: ({ x, confidence }) => {
        "worklet";
        if (confidence > 0.6) {
          predictedX.value = x;

          // Update swipe direction based on prediction
          runOnJS(setSwipeDirection)(
            x > SWIPE_THRESHOLD ? "right" : x < -SWIPE_THRESHOLD ? "left" : null
          );
        }
      },
    });

  const gesture = Gesture.Pan()
    .onBegin((e) => {
      onTouchStart(e);
      scale.value = withSpring(0.95);
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      runOnJS(onTouchMove)(e);
    })
    .onEnd((e) => {
      onTouchEnd(e);
      scale.value = withSpring(1);

      const shouldSwipeRight = e.translationX > SWIPE_THRESHOLD;
      const shouldSwipeLeft = e.translationX < -SWIPE_THRESHOLD;

      if (shouldSwipeRight || shouldSwipeLeft) {
        const direction = shouldSwipeRight ? "right" : "left";

        translateX.value = withTiming(
          shouldSwipeRight ? screenWidth : -screenWidth,
          {
            duration: 300,
          }
        );
        translateY.value = withTiming(e.translationY * 2, { duration: 300 });

        runOnJS(onSwipe)(direction);
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        runOnJS(setSwipeDirection)(null);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-screenWidth / 2, 0, screenWidth / 2],
      [-15, 0, 15]
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
        { scale: scale.value },
      ],
      opacity: interpolate(
        Math.abs(translateX.value),
        [0, screenWidth],
        [1, 0.5]
      ),
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      "clamp"
    ),
  }));

  const nopeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      "clamp"
    ),
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle, { zIndex: -index }]}>
        <Image source={{ uri: profile.image }} style={styles.image} />

        <View style={styles.cardContent}>
          <Text style={styles.name}>
            {profile.name}, {profile.age}
          </Text>
          <Text style={styles.bio}>{profile.bio}</Text>
        </View>

        {/* Like stamp */}
        <Animated.View style={[styles.stamp, styles.likeStamp, likeOpacity]}>
          <Text style={styles.stampText}>LIKE</Text>
        </Animated.View>

        {/* Nope stamp */}
        <Animated.View style={[styles.stamp, styles.nopeStamp, nopeOpacity]}>
          <Text style={styles.stampText}>NOPE</Text>
        </Animated.View>

        {/* Prediction indicator */}
        {prediction && swipeDirection && (
          <View
            style={[
              styles.predictionIndicator,
              swipeDirection === "right"
                ? styles.rightIndicator
                : styles.leftIndicator,
            ]}
          >
            <Text style={styles.predictionText}>
              {swipeDirection === "right" ? "→ Swipe Right" : "← Swipe Left"}
            </Text>
            <Text style={styles.confidenceText}>
              {(prediction.confidence * 100).toFixed(0)}% sure
            </Text>
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

export default function TinderCardsExample() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeHistory, setSwipeHistory] = useState<
    Array<{ profile: Profile; direction: "left" | "right" }>
  >([]);

  const handleSwipe = (direction: "left" | "right") => {
    const profile = profiles[currentIndex];
    setSwipeHistory([...swipeHistory, { profile, direction }]);

    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % profiles.length);
    }, 300);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Swipe Predictor</Text>
          <Text style={styles.subtitle}>Tinder Cards Example</Text>
        </View>

        <View style={styles.cardContainer}>
          {profiles
            .map((profile, i) => {
              const relativeIndex =
                (i - currentIndex + profiles.length) % profiles.length;
              if (relativeIndex > 2) return null; // Only render 3 cards at a time

              return (
                <TinderCard
                  key={profile.id}
                  profile={profile}
                  onSwipe={handleSwipe}
                  index={relativeIndex}
                />
              );
            })
            .reverse()}
        </View>

        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Swipes:</Text>
          {swipeHistory
            .slice(-3)
            .reverse()
            .map((item, index) => (
              <Text key={index} style={styles.historyItem}>
                {item.profile.name} -{" "}
                {item.direction === "right" ? "❤️ Liked" : "❌ Passed"}
              </Text>
            ))}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  cardContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: "white",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  image: {
    width: "100%",
    height: "80%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  cardContent: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  bio: {
    fontSize: 16,
    color: "#666",
    marginTop: 4,
  },
  stamp: {
    position: "absolute",
    top: 50,
    padding: 10,
    borderWidth: 4,
    borderRadius: 8,
  },
  likeStamp: {
    right: 20,
    borderColor: "#4CAF50",
    transform: [{ rotate: "20deg" }],
  },
  nopeStamp: {
    left: 20,
    borderColor: "#F44336",
    transform: [{ rotate: "-20deg" }],
  },
  stampText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#4CAF50",
  },
  nopeStampText: {
    color: "#F44336",
  },
  predictionIndicator: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  rightIndicator: {
    backgroundColor: "rgba(76, 175, 80, 0.9)",
  },
  leftIndicator: {
    backgroundColor: "rgba(244, 67, 54, 0.9)",
  },
  predictionText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  confidenceText: {
    color: "white",
    fontSize: 14,
    opacity: 0.8,
    textAlign: "center",
  },
  historyContainer: {
    padding: 20,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#333",
  },
  historyItem: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
  },
});
