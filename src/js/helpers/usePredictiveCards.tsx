import { useCallback, useRef } from 'react';
import { runOnJS } from 'react-native-reanimated';
import { useSwipePredictor } from '../hooks/useSwipePredictor';
import type { SwipePredictorOptions } from '../types';

/**
 * Card action types
 */
export type CardAction = 'like' | 'dislike' | 'superlike' | null;

/**
 * Configuration for predictive card swipes
 */
export interface PredictiveCardsOptions extends Omit<SwipePredictorOptions, 'onPrediction'> {
  /** Called when an action is predicted */
  onActionPredicted: (action: CardAction, confidence: number) => void;
  /** Horizontal threshold for like/dislike (pixels) */
  horizontalThreshold?: number;
  /** Vertical threshold for superlike (pixels) */
  verticalThreshold?: number;
  /** Whether to enable superlike gesture */
  enableSuperlike?: boolean;
  /** Minimum confidence to trigger action prediction */
  actionConfidenceThreshold?: number;
}

/**
 * Hook for Tinder-style card swipe predictions
 * 
 * @description
 * This hook predicts card swipe actions (like/dislike/superlike) and allows
 * you to start animations and provide visual feedback before the gesture completes.
 * 
 * @param {PredictiveCardsOptions} options - Card swipe configuration
 * @returns {object} Swipe predictor handlers and predicted action
 * 
 * @example
 * ```tsx
 * const { onTouchMove, onTouchStart, onTouchEnd, predictedAction } = usePredictiveCards({
 *   onActionPredicted: (action, confidence) => {
 *     'worklet';
 *     switch (action) {
 *       case 'like':
 *         // Start like animation
 *         cardRotation.value = withSpring(15);
 *         cardOpacity.value = withTiming(0.5);
 *         runOnJS(preloadNextCard)();
 *         break;
 *       case 'dislike':
 *         // Start dislike animation
 *         cardRotation.value = withSpring(-15);
 *         cardOpacity.value = withTiming(0.5);
 *         runOnJS(preloadNextCard)();
 *         break;
 *       case 'superlike':
 *         // Start superlike animation
 *         cardScale.value = withSpring(1.2);
 *         break;
 *     }
 *   },
 *   horizontalThreshold: 120,
 *   verticalThreshold: -100,
 *   enableSuperlike: true
 * });
 * ```
 */
export function usePredictiveCards({
  onActionPredicted,
  horizontalThreshold = 120,
  verticalThreshold = -100,
  enableSuperlike = true,
  actionConfidenceThreshold = 0.65,
  ...swipePredictorOptions
}: PredictiveCardsOptions) {
  const lastPredictedActionRef = useRef<CardAction>(null);
  const predictedActionRef = useRef<CardAction>(null);

  const handlePrediction = useCallback(({ x, y, confidence }: { x: number; y: number; confidence: number }) => {
    'worklet';
    
    if (confidence < actionConfidenceThreshold) {
      return;
    }

    let action: CardAction = null;

    // Determine action based on predicted endpoint
    if (enableSuperlike && y < verticalThreshold) {
      action = 'superlike';
    } else if (x > horizontalThreshold) {
      action = 'like';
    } else if (x < -horizontalThreshold) {
      action = 'dislike';
    }

    runOnJS(() => {
      predictedActionRef.current = action;

      // Only trigger callback if action changed
      if (action !== lastPredictedActionRef.current) {
        lastPredictedActionRef.current = action;
        onActionPredicted(action, confidence);
      }
    })();
  }, [horizontalThreshold, verticalThreshold, enableSuperlike, actionConfidenceThreshold, onActionPredicted]);

  const swipePredictorResult = useSwipePredictor({
    ...swipePredictorOptions,
    onPrediction: handlePrediction,
  });

  // Reset on touch start
  const originalOnTouchStart = swipePredictorResult.onTouchStart;
  const onTouchStart = useCallback(() => {
    lastPredictedActionRef.current = null;
    predictedActionRef.current = null;
    originalOnTouchStart();
  }, [originalOnTouchStart]);

  return {
    ...swipePredictorResult,
    onTouchStart,
    predictedAction: predictedActionRef.current,
  };
}

/**
 * Helper to calculate visual properties based on card position
 * 
 * @param x - Current X position
 * @param y - Current Y position
 * @param action - Predicted action
 * @returns Visual properties for the card
 */
export function getCardVisualProps(
  x: number,
  y: number,
  action: CardAction,
  options: {
    maxRotation?: number;
    maxOpacity?: number;
    superlikeScale?: number;
  } = {}
) {
  const {
    maxRotation = 20,
    maxOpacity = 1,
    superlikeScale = 1.2,
  } = options;

  // Calculate rotation based on horizontal movement
  const rotation = (x / 200) * maxRotation;

  // Calculate opacity based on distance from center
  const distance = Math.sqrt(x * x + y * y);
  const opacity = Math.max(0, 1 - (distance / 300) * (1 - maxOpacity));

  // Scale for superlike
  const scale = action === 'superlike' ? superlikeScale : 1;

  // Action indicator opacity
  const likeOpacity = action === 'like' ? 1 : 0;
  const dislikeOpacity = action === 'dislike' ? 1 : 0;
  const superlikeOpacity = action === 'superlike' ? 1 : 0;

  return {
    rotation,
    opacity,
    scale,
    likeOpacity,
    dislikeOpacity,
    superlikeOpacity,
  };
}