import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import type { Prediction } from '../types';

interface SwipePredictorModuleInterface {
  createPredictor(options: {
    updateInterval: number;
    confidenceThreshold: number;
  }): Promise<number>;
  
  addTouchPoint(predictorId: number, x: number, y: number, timestamp: number): void;
  
  getPrediction(predictorId: number): Promise<Prediction | null>;
  
  resetPredictor(predictorId: number): void;
  
  detectCancellation(predictorId: number): Promise<boolean>;
  
  removePredictor(predictorId: number): void;
}

const { SwipePredictorModule } = NativeModules;

if (!SwipePredictorModule) {
  console.error(
    'SwipePredictorModule is not available. ' +
    'Make sure you have properly linked the native module and rebuilt your app.'
  );
}

export const SwipePredictor = SwipePredictorModule as SwipePredictorModuleInterface;

export const SwipePredictorEventEmitter = SwipePredictorModule 
  ? new NativeEventEmitter(SwipePredictorModule) 
  : null;

export const PHYSICS_PRESETS = {
  ios: {
    decelerationRate: 1500,
    minVelocityThreshold: 50,
    minGestureTimeMs: 30,
    velocitySmoothingFactor: 0.7,
  },
  android: {
    decelerationRate: 1800,
    minVelocityThreshold: 50,
    minGestureTimeMs: 30,
    velocitySmoothingFactor: 0.65,
  },
  custom: {
    decelerationRate: 1500,
    minVelocityThreshold: 50,
    minGestureTimeMs: 30,
    velocitySmoothingFactor: 0.7,
  },
};

export function getPhysicsConfig(physics?: string | Record<string, number>) {
  if (typeof physics === 'string') {
    return PHYSICS_PRESETS[physics as keyof typeof PHYSICS_PRESETS] || PHYSICS_PRESETS.custom;
  }
  
  if (physics && typeof physics === 'object') {
    return {
      ...PHYSICS_PRESETS.custom,
      ...physics,
    };
  }
  
  // Default to platform-specific physics
  return Platform.OS === 'ios' ? PHYSICS_PRESETS.ios : PHYSICS_PRESETS.android;
}