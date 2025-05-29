import React, { useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
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
import { usePredictiveImageGallery } from 'react-native-swipe-predictor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// High-resolution image URLs
const IMAGES = [
  'https://picsum.photos/800/1200?random=20',
  'https://picsum.photos/800/1200?random=21', 
  'https://picsum.photos/800/1200?random=22',
  'https://picsum.photos/800/1200?random=23',
  'https://picsum.photos/800/1200?random=24',
  'https://picsum.photos/800/1200?random=25',
  'https://picsum.photos/800/1200?random=26',
  'https://picsum.photos/800/1200?random=27',
  'https://picsum.photos/800/1200?random=28',
  'https://picsum.photos/800/1200?random=29',
];

export default function ImageGalleryDemo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set([0]));
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  // Track which images are being preloaded
  const preloadingRef = useRef<Set<number>>(new Set());

  const handlePreload = useCallback((indices: number[], priority: 'high' | 'low') => {
    indices.forEach(index => {
      if (preloadingRef.current.has(index) || loadedImages.has(index)) {
        return;
      }

      preloadingRef.current.add(index);
      setLoadingStates(prev => ({ ...prev, [index]: true }));

      console.log(`Preloading image ${index + 1} with ${priority} priority`);

      // Simulate image loading with different priorities
      const delay = priority === 'high' ? 100 : 500;
      
      Image.prefetch(IMAGES[index])
        .then(() => {
          setTimeout(() => {
            setLoadedImages(prev => new Set([...prev, index]));
            setLoadingStates(prev => ({ ...prev, [index]: false }));
            preloadingRef.current.delete(index);
            console.log(`Image ${index + 1} loaded successfully`);
          }, delay);
        })
        .catch(error => {
          console.error(`Failed to load image ${index + 1}:`, error);
          setLoadingStates(prev => ({ ...prev, [index]: false }));
          preloadingRef.current.delete(index);
        });
    });
  }, [loadedImages]);

  const { onTouchStart, onTouchMove, onTouchEnd, prediction } = usePredictiveImageGallery({
    images: IMAGES,
    currentIndex,
    imageWidth: SCREEN_WIDTH,
    onPreload: handlePreload,
    preloadRadius: 2,
    preloadConfidenceThreshold: 0.5,
    confidenceThreshold: 0.6,
    updateInterval: 32, // 30fps for smoother performance
  });

  const handleSwipeEnd = useCallback((translationX: number) => {
    const threshold = SCREEN_WIDTH * 0.3;
    
    if (Math.abs(translationX) > threshold) {
      if (translationX > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (translationX < 0 && currentIndex < IMAGES.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }
    
    // Reset animations
    translateX.value = withSpring(0);
    scale.value = withSpring(1);
    opacity.value = withTiming(1);
  }, [currentIndex]);

  const gesture = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      runOnJS(onTouchStart)();
      scale.value = withSpring(0.95);
    })
    .onUpdate((e) => {
      'worklet';
      translateX.value = e.translationX;
      runOnJS(onTouchMove)(e);
      
      // Add visual feedback based on swipe distance
      const progress = Math.abs(e.translationX) / SCREEN_WIDTH;
      opacity.value = interpolate(progress, [0, 0.5], [1, 0.7]);
    })
    .onEnd((e) => {
      'worklet';
      runOnJS(onTouchEnd)(e);
      runOnJS(handleSwipeEnd)(e.translationX);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  // Preload status indicator
  const preloadingCount = Object.values(loadingStates).filter(Boolean).length;
  const loadedCount = loadedImages.size;

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Predictive Image Gallery</Text>
        <Text style={styles.subtitle}>
          Swipe to browse high-res images with predictive preloading
        </Text>
      </View>

      {/* Image viewer */}
      <View style={styles.imageContainer}>
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.imageWrapper, animatedStyle]}>
            <Image
              source={{ uri: IMAGES[currentIndex] }}
              style={styles.image}
              resizeMode="contain"
            />
            
            {/* Show loading indicator if image not loaded */}
            {!loadedImages.has(currentIndex) && (
              <View style={styles.imageLoading}>
                <ActivityIndicator size="large" color="white" />
                <Text style={styles.loadingText}>Loading image...</Text>
              </View>
            )}
          </Animated.View>
        </GestureDetector>

        {/* Navigation dots */}
        <View style={styles.pagination}>
          {IMAGES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
                loadedImages.has(index) && styles.loadedDot,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Preload status */}
      <View style={styles.status}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Current:</Text>
          <Text style={styles.statusValue}>Image {currentIndex + 1} of {IMAGES.length}</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Loaded:</Text>
          <Text style={styles.statusValue}>{loadedCount} images</Text>
        </View>
        {preloadingCount > 0 && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Preloading:</Text>
            <Text style={styles.statusValue}>{preloadingCount} images</Text>
          </View>
        )}
        {prediction && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Prediction:</Text>
            <Text style={styles.statusValue}>
              {prediction.confidence > 0.6 ? '✓' : '○'} {(prediction.confidence * 100).toFixed(0)}% confident
            </Text>
          </View>
        )}
      </View>

      {/* Thumbnail strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.thumbnailContainer}
      >
        {IMAGES.map((uri, index) => (
          <View
            key={index}
            style={[
              styles.thumbnail,
              index === currentIndex && styles.activeThumbnail,
            ]}
          >
            <Image source={{ uri }} style={styles.thumbnailImage} />
            {loadingStates[index] && (
              <View style={styles.thumbnailLoading}>
                <ActivityIndicator size="small" color="white" />
              </View>
            )}
            {loadedImages.has(index) && !loadingStates[index] && (
              <View style={styles.thumbnailLoaded}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  imageLoading: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 10,
  },
  pagination: {
    position: 'absolute',
    bottom: 30,
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeDot: {
    backgroundColor: 'white',
    width: 24,
  },
  loadedDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  status: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
  },
  statusValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  thumbnailContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
  },
  thumbnail: {
    width: 60,
    height: 80,
    marginRight: 10,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  activeThumbnail: {
    borderColor: 'white',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailLoaded: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
});