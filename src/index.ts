/**
 * @module react-native-swipe-predictor
 * @description High-performance React Native library for predicting swipe gesture endpoints
 * 
 * @example
 * ```tsx
 * import { useSwipePredictor } from 'react-native-swipe-predictor';
 * 
 * function SwipeableCard() {
 *   const translateX = useSharedValue(0);
 *   const { onTouchMove, onTouchStart, onTouchEnd } = useSwipePredictor({
 *     onPrediction: ({ x, confidence }) => {
 *       'worklet';
 *       if (confidence > 0.7) {
 *         translateX.value = withSpring(x);
 *       }
 *     }
 *   });
 *   
 *   // ... rest of component
 * }
 * ```
 */

export { useSwipePredictor } from './js/hooks/useSwipePredictor';
export { 
  useSwipePredictorWithMetrics,
  type SwipePredictorMetrics,
  type SwipePredictorWithMetricsOptions,
  type SwipePredictorWithMetricsResult
} from './js/hooks/useSwipePredictorWithMetrics';
export { SwipePredictorDebugOverlay } from './js/components/SwipePredictorDebugOverlay';
export type { 
  Prediction,
  PhysicsConfig,
  SwipePredictorOptions,
  SwipePredictorHookResult 
} from './js/types';

// Helper hooks for common use cases
export {
  usePredictiveImageGallery,
  usePredictiveNavigation,
  usePredictiveDrawer,
  usePredictiveCards,
  getCardVisualProps,
  type PredictiveImageGalleryOptions,
  type NavigationDirection,
  type PredictiveNavigationOptions,
  type PredictiveDrawerOptions,
  type CardAction,
  type PredictiveCardsOptions
} from './js/helpers';