import React, { useState, useCallback } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  Platform,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { useSwipePredictor } from "../../src"; //This would be replaced with 'react-native-swipe-predictor' in your code

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const THRESHOLD = SCREEN_WIDTH * 0.3;

const images = [
  "https://picsum.photos/400/600?random=1",
  "https://picsum.photos/400/600?random=2",
  "https://picsum.photos/400/600?random=3",
  "https://picsum.photos/400/600?random=4",
  "https://picsum.photos/400/600?random=5",
  "https://picsum.photos/400/600?random=6",
  "https://picsum.photos/400/600?random=7",
  "https://picsum.photos/400/600?random=8",
];

interface ImageCardProps {
  imageUrl: string;
  index: number;
  currentIndex: number;
  onSwipe: (direction: "left" | "right") => void;
}

const ImageCard: React.FC<ImageCardProps> = ({
  imageUrl,
  index,
  currentIndex,
  onSwipe,
}) => {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const predictedX = useSharedValue(0);
  const showPrediction = useSharedValue(0);

  const isActive = index === currentIndex;
  const isNext = index === currentIndex + 1;

  const swipeLeft = useCallback(() => {
    translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
    runOnJS(onSwipe)("left");
  }, []);

  const swipeRight = useCallback(() => {
    translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 300 });
    opacity.value = withTiming(0, { duration: 300 });
    runOnJS(onSwipe)("right");
  }, []);

  const reset = useCallback(() => {
    translateX.value = withSpring(0, {
      damping: 20,
      stiffness: 200,
    });
    scale.value = withSpring(1);
    predictedX.value = withSpring(0);
    showPrediction.value = withTiming(0);
  }, []);

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipePredictor({
    confidenceThreshold: 0.6,
    onPrediction: ({ x, confidence }) => {
      "worklet";
      if (confidence > 0.6 && Math.abs(x) > 50) {
        predictedX.value = x;
        showPrediction.value = confidence;

        // Pre-animate scale based on prediction
        const willSwipe = Math.abs(x) > THRESHOLD;
        if (willSwipe) {
          scale.value = withSpring(0.95, {
            damping: 20,
            stiffness: 300,
          });
        }
      }
    },
    physics: Platform.OS === "ios" ? "ios" : "android",
  });

  const gesture = Gesture.Pan()
    .enabled(isActive)
    .onBegin(() => {
      "worklet";
      runOnJS(onTouchStart)();
    })
    .onUpdate((event) => {
      "worklet";
      translateX.value = event.translationX;

      // Scale down slightly when dragging
      scale.value = interpolate(
        Math.abs(event.translationX),
        [0, SCREEN_WIDTH],
        [1, 0.9],
        "clamp"
      );

      runOnJS(onTouchMove)(event);
    })
    .onEnd((event) => {
      "worklet";
      runOnJS(onTouchEnd)();

      const shouldSwipeLeft =
        translateX.value < -THRESHOLD || event.velocityX < -500;
      const shouldSwipeRight =
        translateX.value > THRESHOLD || event.velocityX > 500;

      if (shouldSwipeLeft) {
        runOnJS(swipeLeft)();
      } else if (shouldSwipeRight) {
        runOnJS(swipeRight)();
      } else {
        runOnJS(reset)();
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }, { scale: scale.value }],
      opacity: opacity.value,
    };
  });

  const predictionStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: predictedX.value }],
      opacity: showPrediction.value * 0.3,
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    const inputRange = [-SCREEN_WIDTH, 0, SCREEN_WIDTH];

    return {
      opacity: isNext
        ? interpolate(
            currentIndex === index - 1 ? translateX.value : 0,
            inputRange,
            [1, 0.7, 1],
            "clamp"
          )
        : 1,
      transform: [
        {
          scale: isNext
            ? interpolate(
                currentIndex === index - 1 ? translateX.value : 0,
                inputRange,
                [1, 0.95, 1],
                "clamp"
              )
            : 1,
        },
      ],
    };
  });

  if (index < currentIndex) return null;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={[
          styles.card,
          isActive ? styles.activeCard : styles.inactiveCard,
          animatedStyle,
          isNext && backdropStyle,
        ]}
      >
        {isActive && (
          <Animated.View
            style={[styles.predictionOverlay, predictionStyle]}
            pointerEvents="none"
          >
            <View style={styles.predictionCard}>
              <Image source={{ uri: imageUrl }} style={styles.image} />
              <View style={styles.predictionIndicator}>
                <Text style={styles.predictionText}>Predicted</Text>
              </View>
            </View>
          </Animated.View>
        )}

        <Image source={{ uri: imageUrl }} style={styles.image} />

        <View style={styles.overlay}>
          <Text style={styles.imageNumber}>
            {index + 1} / {images.length}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export default function ImageGallery() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleSwipe = useCallback((direction: "left" | "right") => {
    setTimeout(() => {
      setCurrentIndex((prev) => {
        if (direction === "left" && prev < images.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 300);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar hidden />

      <View style={styles.header}>
        <Text style={styles.title}>Swipe Gallery</Text>
        <Text style={styles.subtitle}>
          Swipe prediction creates smooth transitions
        </Text>
      </View>

      <View style={styles.gallery}>
        {images.map((image, index) => (
          <ImageCard
            key={index}
            imageUrl={image}
            index={index}
            currentIndex={currentIndex}
            onSwipe={handleSwipe}
          />
        ))}
      </View>

      {currentIndex === images.length - 1 && (
        <View style={styles.endMessage}>
          <Text style={styles.endText}>No more images!</Text>
          <Text style={styles.restartHint}>Restart the app to view again</Text>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#888",
  },
  gallery: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_HEIGHT * 0.65,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1a1a1a",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  activeCard: {
    zIndex: 999,
  },
  inactiveCard: {
    zIndex: 1,
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  imageNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  predictionOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  predictionCard: {
    width: "100%",
    height: "100%",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#4CAF50",
  },
  predictionIndicator: {
    position: "absolute",
    top: 20,
    right: 20,
    backgroundColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  predictionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "bold",
  },
  endMessage: {
    position: "absolute",
    top: "50%",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  endText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  restartHint: {
    fontSize: 16,
    color: "#888",
  },
});
