import type { 
  GestureUpdateEvent, 
  GestureStateChangeEvent,
  PanGestureHandlerEventPayload 
} from 'react-native-gesture-handler';

/**
 * Represents a predicted endpoint for a gesture
 * @interface Prediction
 */
export interface Prediction {
  /** Predicted X coordinate where the gesture will end */
  x: number;
  /** Predicted Y coordinate where the gesture will end */
  y: number;
  /** Confidence score between 0 and 1 indicating prediction reliability */
  confidence: number;
}

/**
 * Physics configuration for gesture prediction
 * @interface PhysicsConfig
 */
export interface PhysicsConfig {
  /** 
   * Rate at which velocity decreases (pixels/second²)
   * @default 1500.0 for iOS, 2000.0 for Android
   */
  decelerationRate?: number;
  /** 
   * Minimum velocity threshold below which prediction stops (pixels/second)
   * @default 50.0
   */
  minVelocityThreshold?: number;
  /** 
   * Minimum gesture duration required for prediction (milliseconds)
   * @default 30.0
   */
  minGestureTimeMs?: number;
  /** 
   * Factor for exponential moving average velocity smoothing (0-1)
   * @default 0.7
   */
  velocitySmoothingFactor?: number;
}

/**
 * Preset physics configurations optimized for different platforms
 * @type PhysicsPreset
 */
export type PhysicsPreset = 'ios' | 'android' | 'custom';

/**
 * Configuration options for the swipe predictor
 * @interface SwipePredictorOptions
 */
export interface SwipePredictorOptions {
  /** 
   * Minimum confidence threshold for predictions (0-1)
   * @default 0.7
   */
  confidenceThreshold?: number;
  /** 
   * Update interval for predictions in seconds
   * @default 0.016 (60 FPS)
   */
  updateInterval?: number;
  /** 
   * Callback invoked when a new prediction is available
   * @param prediction - The prediction data
   */
  onPrediction?: (prediction: Prediction) => void;
  /** 
   * Physics configuration preset or custom settings
   * @default 'ios' on iOS, 'android' on Android
   */
  physics?: PhysicsPreset | PhysicsConfig;
  /** 
   * Enable debug mode to collect additional gesture information
   * @default false
   */
  debug?: boolean;
}

/**
 * Result returned by the useSwipePredictor hook
 * @interface SwipePredictorHookResult
 */
export interface SwipePredictorHookResult {
  /** Handler for gesture start events */
  onTouchStart: (event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  /** Handler for gesture move events */
  onTouchMove: (event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => void;
  /** Handler for gesture end events */
  onTouchEnd: (event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  /** Current prediction or null if no prediction available */
  prediction: Prediction | null;
  /** Whether a gesture is currently active */
  isActive: boolean;
  /** Debug information when debug mode is enabled */
  debugInfo?: DebugInfo;
}

/**
 * Debug information for gesture analysis
 * @interface DebugInfo
 */
export interface DebugInfo {
  /** Array of all touch points collected during the gesture */
  touchPoints: Array<{ x: number; y: number; timestamp: number }>;
  /** Current velocity vector */
  velocity: { x: number; y: number };
  /** Current frame rate of predictions */
  fps: number;
  /** Timestamp when the gesture started */
  gestureStartTime: number;
}