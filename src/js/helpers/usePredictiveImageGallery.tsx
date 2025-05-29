import { useCallback, useRef } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { useSwipePredictor } from '../hooks/useSwipePredictor';
import type { SwipePredictorOptions } from '../types';

/**
 * Configuration for predictive image gallery
 */
export interface PredictiveImageGalleryOptions extends Omit<SwipePredictorOptions, 'onPrediction'> {
  /** Array of image URIs to display */
  images: string[];
  /** Callback to preload images */
  onPreload: (indices: number[], priority: 'high' | 'low') => void;
  /** Number of images to preload in each direction */
  preloadRadius?: number;
  /** Width of each image/screen */
  imageWidth: number;
  /** Current index (controlled) */
  currentIndex: number;
  /** Minimum confidence to trigger preloading */
  preloadConfidenceThreshold?: number;
}

/**
 * Hook for creating image galleries with predictive preloading
 * 
 * @description
 * This hook enhances image galleries by predicting which images the user
 * will navigate to and preloading them before the swipe completes.
 * 
 * @param {PredictiveImageGalleryOptions} options - Gallery configuration
 * @returns {object} Swipe predictor handlers and prediction data
 * 
 * @example
 * ```tsx
 * const [currentIndex, setCurrentIndex] = useState(0);
 * 
 * const { onTouchMove, onTouchStart, onTouchEnd } = usePredictiveImageGallery({
 *   images: imageUrls,
 *   currentIndex,
 *   imageWidth: SCREEN_WIDTH,
 *   onPreload: (indices, priority) => {
 *     indices.forEach(index => {
 *       if (priority === 'high') {
 *         Image.prefetch(imageUrls[index], 'high');
 *       } else {
 *         Image.prefetch(imageUrls[index]);
 *       }
 *     });
 *   },
 *   preloadRadius: 2
 * });
 * ```
 */
export function usePredictiveImageGallery({
  images,
  onPreload,
  preloadRadius = 2,
  imageWidth,
  currentIndex,
  preloadConfidenceThreshold = 0.6,
  ...swipePredictorOptions
}: PredictiveImageGalleryOptions) {
  const lastPredictedIndexRef = useRef<number | null>(null);
  const preloadedIndicesRef = useRef<Set<number>>(new Set());

  const handlePrediction = useCallback(({ x, confidence }: { x: number; confidence: number }) => {
    'worklet';
    
    if (confidence < preloadConfidenceThreshold) {
      return;
    }

    // Calculate which image index we're heading towards
    const predictedOffset = Math.round(x / imageWidth);
    const predictedIndex = currentIndex - predictedOffset; // Negative because swipe left = positive X

    // Clamp to valid range
    const clampedIndex = Math.max(0, Math.min(images.length - 1, predictedIndex));

    runOnJS(() => {
      // Only preload if prediction changed
      if (lastPredictedIndexRef.current === clampedIndex) {
        return;
      }

      lastPredictedIndexRef.current = clampedIndex;

      // Calculate indices to preload
      const indicesToPreload: number[] = [];
      const highPriorityIndices: number[] = [];

      // High priority: the predicted target
      if (!preloadedIndicesRef.current.has(clampedIndex)) {
        highPriorityIndices.push(clampedIndex);
        preloadedIndicesRef.current.add(clampedIndex);
      }

      // Lower priority: surrounding images
      for (let i = 1; i <= preloadRadius; i++) {
        const prevIndex = clampedIndex - i;
        const nextIndex = clampedIndex + i;

        if (prevIndex >= 0 && !preloadedIndicesRef.current.has(prevIndex)) {
          indicesToPreload.push(prevIndex);
          preloadedIndicesRef.current.add(prevIndex);
        }

        if (nextIndex < images.length && !preloadedIndicesRef.current.has(nextIndex)) {
          indicesToPreload.push(nextIndex);
          preloadedIndicesRef.current.add(nextIndex);
        }
      }

      // Trigger preloading
      if (highPriorityIndices.length > 0) {
        onPreload(highPriorityIndices, 'high');
      }
      if (indicesToPreload.length > 0) {
        onPreload(indicesToPreload, 'low');
      }
    })();
  }, [currentIndex, imageWidth, images.length, onPreload, preloadRadius, preloadConfidenceThreshold]);

  const swipePredictorResult = useSwipePredictor({
    ...swipePredictorOptions,
    onPrediction: handlePrediction,
  });

  // Reset preloaded indices when current index changes
  const originalOnTouchStart = swipePredictorResult.onTouchStart;
  const onTouchStart = useCallback(() => {
    lastPredictedIndexRef.current = null;
    // Clear preloaded set but keep nearby images
    const nearbyIndices = new Set<number>();
    for (let i = -preloadRadius; i <= preloadRadius; i++) {
      const index = currentIndex + i;
      if (index >= 0 && index < images.length && preloadedIndicesRef.current.has(index)) {
        nearbyIndices.add(index);
      }
    }
    preloadedIndicesRef.current = nearbyIndices;
    
    originalOnTouchStart();
  }, [currentIndex, images.length, preloadRadius, originalOnTouchStart]);

  return {
    ...swipePredictorResult,
    onTouchStart,
  };
}