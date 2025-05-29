import type { 
  GestureUpdateEvent, 
  GestureStateChangeEvent,
  PanGestureHandlerEventPayload 
} from 'react-native-gesture-handler';

export interface Prediction {
  x: number;
  y: number;
  confidence: number;
}

export interface PhysicsConfig {
  decelerationRate?: number;
  minVelocityThreshold?: number;
  minGestureTimeMs?: number;
  velocitySmoothingFactor?: number;
}

export type PhysicsPreset = 'ios' | 'android' | 'custom';

export interface SwipePredictorOptions {
  confidenceThreshold?: number;
  updateInterval?: number;
  onPrediction?: (prediction: Prediction) => void;
  physics?: PhysicsPreset | PhysicsConfig;
  debug?: boolean;
}

export interface SwipePredictorHookResult {
  onTouchStart: (event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  onTouchMove: (event: GestureUpdateEvent<PanGestureHandlerEventPayload>) => void;
  onTouchEnd: (event?: GestureStateChangeEvent<PanGestureHandlerEventPayload>) => void;
  prediction: Prediction | null;
  isActive: boolean;
  debugInfo?: DebugInfo;
}

export interface DebugInfo {
  touchPoints: Array<{ x: number; y: number; timestamp: number }>;
  velocity: { x: number; y: number };
  fps: number;
  gestureStartTime: number;
}