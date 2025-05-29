import { useCallback, useRef } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { useSwipePredictor } from '../hooks/useSwipePredictor';
import type { SwipePredictorOptions } from '../types';

/**
 * Navigation direction
 */
export type NavigationDirection = 'left' | 'right' | 'up' | 'down' | null;

/**
 * Configuration for predictive navigation
 */
export interface PredictiveNavigationOptions extends Omit<SwipePredictorOptions, 'onPrediction'> {
  /** Callback when navigation is predicted */
  onNavigationPredicted: (direction: NavigationDirection, confidence: number) => void;
  /** Threshold distance to trigger navigation (pixels) */
  navigationThreshold?: number;
  /** Whether to support vertical navigation */
  enableVertical?: boolean;
  /** Minimum confidence to trigger navigation prediction */
  navigationConfidenceThreshold?: number;
}

/**
 * Hook for predictive navigation transitions
 * 
 * @description
 * This hook predicts navigation intent (left/right/up/down) and allows you to
 * start loading the next screen or prepare transitions before the gesture completes.
 * 
 * @param {PredictiveNavigationOptions} options - Navigation configuration
 * @returns {object} Swipe predictor handlers and navigation state
 * 
 * @example
 * ```tsx
 * const navigation = useNavigation();
 * 
 * const { onTouchMove, onTouchStart, onTouchEnd, predictedDirection } = usePredictiveNavigation({
 *   onNavigationPredicted: (direction, confidence) => {
 *     if (confidence > 0.8) {
 *       switch (direction) {
 *         case 'left':
 *           // Preload next screen
 *           prefetchScreen('ProfileScreen');
 *           break;
 *         case 'right':
 *           // Prepare to go back
 *           prepareGoBack();
 *           break;
 *       }
 *     }
 *   },
 *   navigationThreshold: 100,
 *   enableVertical: false
 * });
 * ```
 */
export function usePredictiveNavigation({
  onNavigationPredicted,
  navigationThreshold = 100,
  enableVertical = false,
  navigationConfidenceThreshold = 0.7,
  ...swipePredictorOptions
}: PredictiveNavigationOptions) {
  const lastPredictedDirectionRef = useRef<NavigationDirection>(null);
  const predictedDirectionRef = useRef<NavigationDirection>(null);

  const handlePrediction = useCallback(({ x, y, confidence }: { x: number; y: number; confidence: number }) => {
    'worklet';
    
    if (confidence < navigationConfidenceThreshold) {
      return;
    }

    let direction: NavigationDirection = null;

    // Determine direction based on predicted endpoint
    if (Math.abs(x) > navigationThreshold || (enableVertical && Math.abs(y) > navigationThreshold)) {
      if (!enableVertical || Math.abs(x) > Math.abs(y)) {
        // Horizontal navigation
        direction = x > 0 ? 'right' : 'left';
      } else {
        // Vertical navigation
        direction = y > 0 ? 'down' : 'up';
      }
    }

    runOnJS(() => {
      predictedDirectionRef.current = direction;

      // Only trigger callback if direction changed
      if (direction !== lastPredictedDirectionRef.current) {
        lastPredictedDirectionRef.current = direction;
        onNavigationPredicted(direction, confidence);
      }
    })();
  }, [navigationThreshold, enableVertical, navigationConfidenceThreshold, onNavigationPredicted]);

  const swipePredictorResult = useSwipePredictor({
    ...swipePredictorOptions,
    onPrediction: handlePrediction,
  });

  // Reset on touch start
  const originalOnTouchStart = swipePredictorResult.onTouchStart;
  const onTouchStart = useCallback(() => {
    lastPredictedDirectionRef.current = null;
    predictedDirectionRef.current = null;
    originalOnTouchStart();
  }, [originalOnTouchStart]);

  return {
    ...swipePredictorResult,
    onTouchStart,
    predictedDirection: predictedDirectionRef.current,
  };
}

/**
 * Hook for predictive drawer/panel gestures
 * 
 * @description
 * Specialized version of predictive navigation for drawer and panel components.
 * Predicts open/close intent and allows smooth transitions.
 * 
 * @example
 * ```tsx
 * const { onTouchMove, onTouchStart, onTouchEnd } = usePredictiveDrawer({
 *   drawerWidth: 300,
 *   isOpen,
 *   onOpenPredicted: (confidence) => {
 *     if (confidence > 0.7) {
 *       // Start opening animation
 *       drawerAnimation.value = withSpring(0);
 *     }
 *   },
 *   onClosePredicted: (confidence) => {
 *     if (confidence > 0.7) {
 *       // Start closing animation
 *       drawerAnimation.value = withSpring(-300);
 *     }
 *   }
 * });
 * ```
 */
export interface PredictiveDrawerOptions extends Omit<SwipePredictorOptions, 'onPrediction'> {
  /** Width of the drawer */
  drawerWidth: number;
  /** Current open state */
  isOpen: boolean;
  /** Called when drawer open is predicted */
  onOpenPredicted: (confidence: number) => void;
  /** Called when drawer close is predicted */
  onClosePredicted: (confidence: number) => void;
  /** Minimum swipe distance to trigger prediction */
  minSwipeDistance?: number;
}

export function usePredictiveDrawer({
  drawerWidth,
  isOpen,
  onOpenPredicted,
  onClosePredicted,
  minSwipeDistance = 50,
  ...swipePredictorOptions
}: PredictiveDrawerOptions) {
  const lastPredictionRef = useRef<'open' | 'close' | null>(null);

  const handlePrediction = useCallback(({ x, confidence }: { x: number; confidence: number }) => {
    'worklet';
    
    if (Math.abs(x) < minSwipeDistance) {
      return;
    }

    const predictedPosition = isOpen ? drawerWidth + x : x;
    const shouldOpen = predictedPosition > drawerWidth / 2;

    runOnJS(() => {
      const prediction = shouldOpen ? 'open' : 'close';
      
      if (prediction !== lastPredictionRef.current) {
        lastPredictionRef.current = prediction;
        
        if (shouldOpen && !isOpen) {
          onOpenPredicted(confidence);
        } else if (!shouldOpen && isOpen) {
          onClosePredicted(confidence);
        }
      }
    })();
  }, [drawerWidth, isOpen, minSwipeDistance, onOpenPredicted, onClosePredicted]);

  return useSwipePredictor({
    ...swipePredictorOptions,
    onPrediction: handlePrediction,
  });
}