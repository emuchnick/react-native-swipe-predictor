import { useEffect, useRef, useState, useCallback } from 'react';
import { useSwipePredictor } from './useSwipePredictor';
import type { SwipePredictorOptions, SwipePredictorHookResult, Prediction } from '../types';
import type { GestureStateChangeEvent, PanGestureHandlerEventPayload } from 'react-native-gesture-handler';

/**
 * Performance metrics for swipe prediction
 */
export interface SwipePredictorMetrics {
  /** Total number of predictions made */
  totalPredictions: number;
  /** Average confidence score across all predictions */
  averageConfidence: number;
  /** Highest confidence score achieved */
  peakConfidence: number;
  /** Average prediction latency in milliseconds */
  averageLatency: number;
  /** Current predictions per second */
  predictionsPerSecond: number;
  /** Prediction accuracy (requires validation) */
  accuracy?: number;
  /** Number of gesture cancellations detected */
  cancellations: number;
  /** Average gesture duration in milliseconds */
  averageGestureDuration: number;
  /** Total number of gestures tracked */
  totalGestures: number;
}

/**
 * Options for the performance monitoring hook
 */
export interface SwipePredictorWithMetricsOptions extends SwipePredictorOptions {
  /** Callback to validate prediction accuracy (optional) */
  onValidatePrediction?: (prediction: Prediction, actual: { x: number; y: number }) => boolean;
  /** Interval for calculating predictions per second (ms) */
  metricsInterval?: number;
}

/**
 * Result from the performance monitoring hook
 */
export interface SwipePredictorWithMetricsResult extends SwipePredictorHookResult {
  /** Current performance metrics */
  metrics: SwipePredictorMetrics;
  /** Reset all metrics to initial values */
  resetMetrics: () => void;
  /** Get metrics snapshot as JSON */
  getMetricsSnapshot: () => string;
}

/**
 * Enhanced swipe predictor hook with performance monitoring
 * 
 * @description
 * This hook wraps the standard useSwipePredictor with comprehensive performance
 * monitoring capabilities. Use it to analyze prediction accuracy, latency, and
 * other metrics during development or in production.
 * 
 * @param {SwipePredictorWithMetricsOptions} options - Configuration with metrics options
 * @returns {SwipePredictorWithMetricsResult} Hook result with metrics
 * 
 * @example
 * ```tsx
 * const { 
 *   onTouchMove, 
 *   onTouchStart, 
 *   onTouchEnd, 
 *   metrics,
 *   resetMetrics 
 * } = useSwipePredictorWithMetrics({
 *   onPrediction: ({ x, y, confidence }) => {
 *     'worklet';
 *     // Your prediction handler
 *   },
 *   onValidatePrediction: (prediction, actual) => {
 *     // Return true if prediction was accurate
 *     const distance = Math.sqrt(
 *       Math.pow(prediction.x - actual.x, 2) + 
 *       Math.pow(prediction.y - actual.y, 2)
 *     );
 *     return distance < 50; // Within 50 pixels
 *   }
 * });
 * 
 * // Display metrics
 * console.log(`Average confidence: ${metrics.averageConfidence.toFixed(2)}`);
 * console.log(`Predictions/sec: ${metrics.predictionsPerSecond.toFixed(1)}`);
 * console.log(`Accuracy: ${(metrics.accuracy * 100).toFixed(1)}%`);
 * ```
 */
export function useSwipePredictorWithMetrics({
  onValidatePrediction,
  metricsInterval = 1000,
  ...swipePredictorOptions
}: SwipePredictorWithMetricsOptions = {}): SwipePredictorWithMetricsResult {
  const [metrics, setMetrics] = useState<SwipePredictorMetrics>({
    totalPredictions: 0,
    averageConfidence: 0,
    peakConfidence: 0,
    averageLatency: 0,
    predictionsPerSecond: 0,
    accuracy: undefined,
    cancellations: 0,
    averageGestureDuration: 0,
    totalGestures: 0,
  });

  const metricsRef = useRef({
    predictions: [] as Array<{ timestamp: number; confidence: number; latency: number }>,
    accuracyData: [] as Array<{ correct: boolean }>,
    gestureDurations: [] as number[],
    lastIntervalTime: Date.now(),
    intervalPredictionCount: 0,
    gestureStartTime: 0,
    lastPredictionTime: 0,
    lastActualPosition: null as { x: number; y: number } | null,
  });

  // Calculate predictions per second
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - metricsRef.current.lastIntervalTime) / 1000;
      const pps = metricsRef.current.intervalPredictionCount / elapsed;

      setMetrics(prev => ({
        ...prev,
        predictionsPerSecond: pps,
      }));

      metricsRef.current.intervalPredictionCount = 0;
      metricsRef.current.lastIntervalTime = now;
    }, metricsInterval);

    return () => clearInterval(interval);
  }, [metricsInterval]);

  // Enhanced prediction handler
  const handlePrediction = useCallback((prediction: Prediction) => {
    const now = Date.now();
    const latency = metricsRef.current.lastPredictionTime 
      ? now - metricsRef.current.lastPredictionTime 
      : 0;
    
    metricsRef.current.lastPredictionTime = now;
    metricsRef.current.intervalPredictionCount++;

    // Store prediction data
    metricsRef.current.predictions.push({
      timestamp: now,
      confidence: prediction.confidence,
      latency,
    });

    // Keep only last 100 predictions for performance
    if (metricsRef.current.predictions.length > 100) {
      metricsRef.current.predictions.shift();
    }

    // Update metrics
    const predictions = metricsRef.current.predictions;
    const totalConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0);
    const totalLatency = predictions.reduce((sum, p) => sum + p.latency, 0);
    const peakConfidence = Math.max(...predictions.map(p => p.confidence));

    setMetrics(prev => ({
      ...prev,
      totalPredictions: prev.totalPredictions + 1,
      averageConfidence: totalConfidence / predictions.length,
      peakConfidence,
      averageLatency: totalLatency / predictions.length,
    }));

    // Call original handler
    if (swipePredictorOptions.onPrediction) {
      swipePredictorOptions.onPrediction(prediction);
    }
  }, [swipePredictorOptions]);

  // Use the base hook with our enhanced handler
  const basePredictorResult = useSwipePredictor({
    ...swipePredictorOptions,
    onPrediction: handlePrediction,
  });

  // Enhanced touch start handler
  const onTouchStart = useCallback((event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
    metricsRef.current.gestureStartTime = Date.now();
    metricsRef.current.lastPredictionTime = Date.now();
    basePredictorResult.onTouchStart(event);
  }, [basePredictorResult.onTouchStart]);

  // Enhanced touch end handler
  const onTouchEnd = useCallback((event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
    const gestureDuration = Date.now() - metricsRef.current.gestureStartTime;
    metricsRef.current.gestureDurations.push(gestureDuration);

    // Keep only last 50 gestures
    if (metricsRef.current.gestureDurations.length > 50) {
      metricsRef.current.gestureDurations.shift();
    }

    // Update average gesture duration
    const avgDuration = metricsRef.current.gestureDurations.reduce((a, b) => a + b, 0) 
      / metricsRef.current.gestureDurations.length;

    setMetrics(prev => ({
      ...prev,
      totalGestures: prev.totalGestures + 1,
      averageGestureDuration: avgDuration,
    }));

    // Validate prediction if handler provided and we have a prediction
    if (onValidatePrediction && basePredictorResult.prediction && event && 'translationX' in event && 'translationY' in event) {
      const actual = {
        x: event.translationX || 0,
        y: event.translationY || 0,
      };
      
      const isCorrect = onValidatePrediction(basePredictorResult.prediction, actual);
      metricsRef.current.accuracyData.push({ correct: isCorrect });

      // Keep only last 50 validations
      if (metricsRef.current.accuracyData.length > 50) {
        metricsRef.current.accuracyData.shift();
      }

      // Calculate accuracy
      const correctCount = metricsRef.current.accuracyData.filter(d => d.correct).length;
      const accuracy = correctCount / metricsRef.current.accuracyData.length;

      setMetrics(prev => ({
        ...prev,
        accuracy,
      }));
    }

    basePredictorResult.onTouchEnd(event);
  }, [basePredictorResult.onTouchEnd, basePredictorResult.prediction, onValidatePrediction]);

  // Track cancellations
  useEffect(() => {
    if (!basePredictorResult.isActive && basePredictorResult.prediction === null && metricsRef.current.gestureStartTime > 0) {
      // Gesture ended without prediction - might be a cancellation
      const gestureDuration = Date.now() - metricsRef.current.gestureStartTime;
      if (gestureDuration > 100) { // Only count if gesture lasted more than 100ms
        setMetrics(prev => ({
          ...prev,
          cancellations: prev.cancellations + 1,
        }));
      }
    }
  }, [basePredictorResult.isActive, basePredictorResult.prediction]);

  const resetMetrics = useCallback(() => {
    setMetrics({
      totalPredictions: 0,
      averageConfidence: 0,
      peakConfidence: 0,
      averageLatency: 0,
      predictionsPerSecond: 0,
      accuracy: undefined,
      cancellations: 0,
      averageGestureDuration: 0,
      totalGestures: 0,
    });
    
    metricsRef.current = {
      predictions: [],
      accuracyData: [],
      gestureDurations: [],
      lastIntervalTime: Date.now(),
      intervalPredictionCount: 0,
      gestureStartTime: 0,
      lastPredictionTime: 0,
      lastActualPosition: null,
    };
  }, []);

  const getMetricsSnapshot = useCallback(() => {
    return JSON.stringify({
      ...metrics,
      timestamp: new Date().toISOString(),
      sessionDuration: Date.now() - metricsRef.current.lastIntervalTime,
    }, null, 2);
  }, [metrics]);

  return {
    ...basePredictorResult,
    onTouchStart,
    onTouchEnd,
    metrics,
    resetMetrics,
    getMetricsSnapshot,
  };
}