import { useEffect, useRef, useState, useCallback } from 'react';
import { runOnJS } from 'react-native-reanimated';
import type { 
  GestureUpdateEvent, 
  GestureStateChangeEvent,
  PanGestureHandlerEventPayload 
} from 'react-native-gesture-handler';
import { SwipePredictor, SwipePredictorEventEmitter } from '../native/SwipePredictorModule';
import type { 
  Prediction, 
  SwipePredictorOptions, 
  SwipePredictorHookResult,
  DebugInfo 
} from '../types';

export function useSwipePredictor(options: SwipePredictorOptions = {}): SwipePredictorHookResult {
  const {
    confidenceThreshold = 0.7,
    updateInterval = 16, // 60fps default
    onPrediction,
    debug = false,
  } = options;
  
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | undefined>();
  
  const predictorIdRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const touchPointsRef = useRef<Array<{ x: number; y: number; timestamp: number }>>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const fpsRef = useRef<number>(0);
  
  // Initialize predictor
  useEffect(() => {
    let mounted = true;
    
    const initializePredictor = async () => {
      if (!SwipePredictor) {
        console.warn('SwipePredictor native module is not available');
        return;
      }
      
      try {
        const predictorId = await SwipePredictor.createPredictor({
          updateInterval: updateInterval / 1000, // Convert to seconds
          confidenceThreshold,
        });
        
        if (mounted) {
          predictorIdRef.current = predictorId;
        }
      } catch (error) {
        console.error('Failed to initialize SwipePredictor:', error);
      }
    };
    
    initializePredictor();
    
    // Set up event listeners
    const predictionListener = SwipePredictorEventEmitter?.addListener(
      'onPrediction',
      (event: Prediction & { predictorId: number }) => {
        if (event.predictorId === predictorIdRef.current) {
          setPrediction({
            x: event.x,
            y: event.y,
            confidence: event.confidence,
          });
          
          if (onPrediction) {
            onPrediction({
              x: event.x,
              y: event.y,
              confidence: event.confidence,
            });
          }
          
          // Update FPS in debug mode
          if (debug) {
            const now = Date.now();
            frameCountRef.current++;
            
            if (now - lastFrameTimeRef.current >= 1000) {
              fpsRef.current = frameCountRef.current;
              frameCountRef.current = 0;
              lastFrameTimeRef.current = now;
            }
          }
        }
      }
    );
    
    const cancellationListener = SwipePredictorEventEmitter?.addListener(
      'onCancellation',
      (event: { predictorId: number }) => {
        if (event.predictorId === predictorIdRef.current) {
          setPrediction(null);
          setIsActive(false);
        }
      }
    );
    
    return () => {
      mounted = false;
      predictionListener?.remove();
      cancellationListener?.remove();
      
      if (predictorIdRef.current !== null && SwipePredictor) {
        SwipePredictor.removePredictor(predictorIdRef.current);
      }
    };
  }, [confidenceThreshold, updateInterval, onPrediction, debug]);
  
  const onTouchStart = useCallback((_event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
    'worklet';
    
    if (predictorIdRef.current === null) return;
    
    runOnJS(() => {
      setIsActive(true);
      setPrediction(null);
      startTimeRef.current = Date.now();
      touchPointsRef.current = [];
      frameCountRef.current = 0;
      
      if (predictorIdRef.current !== null && SwipePredictor) {
        SwipePredictor.resetPredictor(predictorIdRef.current);
      }
    })();
  }, []);
  
  const onTouchMove = useCallback((event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => {
    'worklet';
    
    if (predictorIdRef.current === null) return;
    
    const { translationX, translationY } = event;
    const timestamp = Date.now() - startTimeRef.current; // Convert to ms since start
    
    runOnJS(() => {
      if (predictorIdRef.current !== null && SwipePredictor) {
        SwipePredictor.addTouchPoint(
          predictorIdRef.current,
          translationX as number,
          translationY as number,
          timestamp
        );
        
        if (debug) {
          touchPointsRef.current.push({
            x: translationX as number,
            y: translationY as number,
            timestamp,
          });
          
          // Keep only last 20 points for performance
          if (touchPointsRef.current.length > 20) {
            touchPointsRef.current.shift();
          }
          
          // Calculate velocity from last few points
          const points = touchPointsRef.current;
          if (points.length >= 2) {
            const n = points.length;
            const dt = points[n - 1].timestamp - points[n - 2].timestamp;
            
            if (dt > 0) {
              const vx = (points[n - 1].x - points[n - 2].x) / dt * 1000;
              const vy = (points[n - 1].y - points[n - 2].y) / dt * 1000;
              
              setDebugInfo({
                touchPoints: [...touchPointsRef.current],
                velocity: { x: vx, y: vy },
                fps: fpsRef.current,
                gestureStartTime: startTimeRef.current,
              });
            }
          }
        }
      }
    })();
  }, [debug]);
  
  const onTouchEnd = useCallback((_event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => {
    'worklet';
    
    runOnJS(() => {
      setIsActive(false);
      
      // Keep prediction visible for a short time after gesture ends
      setTimeout(() => {
        if (!isActive) {
          setPrediction(null);
          setDebugInfo(undefined);
        }
      }, 300);
    })();
  }, [isActive]);
  
  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    prediction,
    isActive,
    debugInfo: debug ? debugInfo : undefined,
  };
}