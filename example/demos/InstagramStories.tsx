import React, { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';
import { usePredictiveNavigation } from 'react-native-swipe-predictor';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Mock story data
const STORIES = [
  {
    id: 1,
    username: 'travel_photographer',
    userAvatar: 'https://picsum.photos/100/100?random=1',
    image: 'https://picsum.photos/400/800?random=1',
    timestamp: '2 hours ago',
  },
  {
    id: 2,
    username: 'food_lover',
    userAvatar: 'https://picsum.photos/100/100?random=2',
    image: 'https://picsum.photos/400/800?random=2',
    timestamp: '5 hours ago',
  },
  {
    id: 3,
    username: 'adventure_seeker',
    userAvatar: 'https://picsum.photos/100/100?random=3',
    image: 'https://picsum.photos/400/800?random=3',
    timestamp: '8 hours ago',
  },
  {
    id: 4,
    username: 'art_enthusiast',
    userAvatar: 'https://picsum.photos/100/100?random=4',
    image: 'https://picsum.photos/400/800?random=4',
    timestamp: '12 hours ago',
  },
  {
    id: 5,
    username: 'nature_lover',
    userAvatar: 'https://picsum.photos/100/100?random=5',
    image: 'https://picsum.photos/400/800?random=5',
    timestamp: '1 day ago',
  },
];

export default function InstagramStoriesDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(1);
  const imageCache = useRef<Record<number, boolean>>({});

  // Preload an image
  const preloadImage = useCallback((index: number) => {
    if (index < 0 || index >= STORIES.length || imageCache.current[index]) {
      return;
    }

    console.log(`Preloading story ${index + 1}`);
    setLoadingStates(prev => ({ ...prev, [index]: true }));
    
    Image.prefetch(STORIES[index].image)
      .then(() => {
        imageCache.current[index] = true;
        setLoadingStates(prev => ({ ...prev, [index]: false }));
        console.log(`Story ${index + 1} preloaded successfully`);
      })
      .catch(error => {
        console.error(`Failed to preload story ${index + 1}:`, error);
        setLoadingStates(prev => ({ ...prev, [index]: false }));
      });
  }, []);

  // Use predictive navigation for story transitions
  const { onTouchStart, onTouchMove, onTouchEnd } = usePredictiveNavigation({
    onNavigationPredicted: (direction, confidence) => {
      if (confidence > 0.6) {
        // Predict which story the user is navigating to
        let targetIndex = currentIndex;
        
        if (direction === 'left' && currentIndex < STORIES.length - 1) {
          targetIndex = currentIndex + 1;
          // Start fade animation early
          opacity.value = withTiming(0.7, { duration: 200 });
        } else if (direction === 'right' && currentIndex > 0) {
          targetIndex = currentIndex - 1;
          // Start fade animation early
          opacity.value = withTiming(0.7, { duration: 200 });
        }
        
        // Preload the target story and adjacent ones
        if (targetIndex !== currentIndex) {
          preloadImage(targetIndex);
          preloadImage(targetIndex - 1);
          preloadImage(targetIndex + 1);
        }
      }
    },
    navigationThreshold: SCREEN_WIDTH * 0.2,
    enableVertical: false,
  });

  const handleSwipeEnd = useCallback((translationX: number) => {
    const shouldNavigate = Math.abs(translationX) > SCREEN_WIDTH * 0.3;
    
    if (shouldNavigate) {
      if (translationX > 0 && currentIndex > 0) {
        // Navigate to previous story
        setCurrentIndex(currentIndex - 1);
      } else if (translationX < 0 && currentIndex < STORIES.length - 1) {
        // Navigate to next story
        setCurrentIndex(currentIndex + 1);
      }
    }
    
    // Reset position and opacity
    translateX.value = withSpring(0);
    opacity.value = withTiming(1);
  }, [currentIndex]);

  const gesture = Gesture.Pan()
    .onBegin(onTouchStart)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      onTouchMove(e);
    })
    .onEnd((e) => {
      onTouchEnd(e);
      runOnJS(handleSwipeEnd)(e.translationX);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${((currentIndex + 1) / STORIES.length) * 100}%`,
  }));

  const currentStory = STORIES[currentIndex];

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, progressBarStyle]} />
        </View>
      </View>

      {/* Story header */}
      <View style={styles.header}>
        <Image source={{ uri: currentStory.userAvatar }} style={styles.avatar} />
        <View style={styles.headerText}>
          <Text style={styles.username}>{currentStory.username}</Text>
          <Text style={styles.timestamp}>{currentStory.timestamp}</Text>
        </View>
      </View>

      {/* Story content */}
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.storyContainer, animatedStyle]}>
          <Image 
            source={{ uri: currentStory.image }} 
            style={styles.storyImage}
            resizeMode="cover"
          />
          
          {/* Navigation hints */}
          {currentIndex > 0 && (
            <View style={[styles.navigationHint, styles.leftHint]}>
              <Text style={styles.navigationHintText}>←</Text>
            </View>
          )}
          {currentIndex < STORIES.length - 1 && (
            <View style={[styles.navigationHint, styles.rightHint]}>
              <Text style={styles.navigationHintText}>→</Text>
            </View>
          )}
        </Animated.View>
      </GestureDetector>

      {/* Loading indicator for preloading */}
      {Object.values(loadingStates).some(loading => loading) && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator color="white" size="small" />
          <Text style={styles.loadingText}>Preloading next story...</Text>
        </View>
      )}

      {/* Story counter */}
      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {currentIndex + 1} / {STORIES.length}
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 100,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
  },
  header: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 100,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
  },
  headerText: {
    marginLeft: 12,
  },
  username: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  storyContainer: {
    flex: 1,
  },
  storyImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  navigationHint: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leftHint: {
    left: 0,
  },
  rightHint: {
    right: 0,
  },
  navigationHintText: {
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 30,
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 12,
    marginTop: 8,
    opacity: 0.8,
  },
  counter: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  counterText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
});