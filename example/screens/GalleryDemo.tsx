import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Switch,
} from 'react-native';
import { usePredictiveImageGallery } from 'react-native-swipe-predictor';
import { createGestureEvent, getTouchCoordinates } from '../utils/gestureHelpers';

/**
 * Device width for responsive sizing
 */
const { width } = Dimensions.get('window');

/**
 * Size for gallery images (80% of screen width)
 */
const IMAGE_SIZE = width * 0.8;

/**
 * Generate placeholder images with different colors
 * In a real app, these would be actual image URLs to preload
 * @constant {Array<{id: number, color: string, title: string}>}
 */
const GALLERY_IMAGES = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  color: `hsl(${i * 24}, 70%, 50%)`,
  title: `Image ${i + 1}`,
}));

/**
 * GalleryDemo - Predictive image preloading demonstration
 * 
 * @description
 * This screen showcases how SwipePredictor can enhance image galleries
 * by preloading images before users scroll to them. Features:
 * - Predictive preloading based on scroll direction and velocity
 * - Visual indicators showing which images are preloaded
 * - Toggle to compare predictive vs standard scrolling
 * - Real-time preload status display
 * 
 * The demo uses `usePredictiveImageGallery` hook which:
 * - Predicts which images user will scroll to
 * - Triggers preload callbacks with priority levels
 * - Manages preload state based on gesture predictions
 * 
 * In production, this would trigger actual image downloads,
 * significantly improving perceived performance.
 * 
 * @component
 * @returns {JSX.Element} Horizontal scrollable gallery with preload indicators
 * 
 * @example
 * // The preload callback would typically trigger image loading:
 * onPreload: (indices, priority) => {
 *   indices.forEach(index => {
 *     Image.prefetch(imageUrls[index], priority);
 *   });
 * }
 */
export default function GalleryDemo() {
  const [predictiveMode, setPredictiveMode] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [preloadedIndices, setPreloadedIndices] = useState<number[]>([]);
  
  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    prediction: _prediction,
  } = usePredictiveImageGallery({
    images: GALLERY_IMAGES.map(img => img.id.toString()),
    currentIndex,
    imageWidth: width,
    onPreload: (indices, priority) => {
      console.log(`Preloading images at indices ${indices} with ${priority} priority`);
      setPreloadedIndices(prev => [...new Set([...prev, ...indices])]);
    },
    preloadRadius: 2,
  });

  const renderImage = (image: typeof GALLERY_IMAGES[0], index: number) => {
    const isPreloaded = preloadedIndices.includes(index);
    const isCurrent = index === currentIndex;

    return (
      <View key={image.id} style={styles.imageContainer}>
        <View
          style={[
            styles.imagePlaceholder,
            { backgroundColor: image.color },
            isPreloaded && styles.preloadedBorder,
            isCurrent && styles.currentBorder,
          ]}
        >
          <Text style={styles.imageText}>{image.title}</Text>
          {isPreloaded && !isCurrent && (
            <Text style={styles.preloadedText}>Preloaded</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Swipe to see predictive preloading</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Predictive Mode</Text>
          <Switch
            value={predictiveMode}
            onValueChange={setPredictiveMode}
            trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          const offsetX = event.nativeEvent.contentOffset.x;
          const newIndex = Math.round(offsetX / width);
          setCurrentIndex(newIndex);
        }}
        onResponderGrant={predictiveMode ? () => onTouchStart() : undefined}
        onResponderMove={predictiveMode ? (e) => {
          const coords = getTouchCoordinates(e);
          if (coords) {
            onTouchMove(createGestureEvent(coords.x - width / 2, 0));
          }
        } : undefined}
        onResponderRelease={predictiveMode ? () => onTouchEnd() : undefined}
        onStartShouldSetResponder={() => predictiveMode}
        onMoveShouldSetResponder={() => predictiveMode}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        {GALLERY_IMAGES.map((image, index) => renderImage(image, index))}
      </ScrollView>

      <View style={styles.stats}>
        <Text style={styles.statsText}>
          Current: Image {currentIndex + 1} of {GALLERY_IMAGES.length}
        </Text>
        <Text style={styles.statsText}>
          Mode: {predictiveMode ? 'Predictive' : 'Standard'}
        </Text>
        {predictiveMode && (
          <Text style={styles.statsText}>
            Preloaded: {preloadedIndices.length} images
          </Text>
        )}
      </View>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.currentBorder]} />
          <Text style={styles.legendText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBox, styles.preloadedBorder]} />
          <Text style={styles.legendText}>Preloaded</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
  },
  imageContainer: {
    width: width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  imagePlaceholder: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'transparent',
  },
  preloadedBorder: {
    borderColor: '#34C759',
  },
  currentBorder: {
    borderColor: '#007AFF',
  },
  imageText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  preloadedText: {
    position: 'absolute',
    bottom: 20,
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: '#34C759',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stats: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  statsText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 5,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    paddingBottom: 20,
    gap: 30,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  legendText: {
    fontSize: 12,
    color: '#8E8E93',
  },
});