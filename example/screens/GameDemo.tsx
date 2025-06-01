import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSwipePredictor } from 'react-native-swipe-predictor';
import Slider from '@react-native-community/slider';
import { createGestureEvent, getTouchCoordinates } from '../utils/gestureHelpers';
import type { GestureResponderEvent } from 'react-native';

/**
 * Screen dimensions for responsive layout
 */
const { width, height } = Dimensions.get('window');

/**
 * Ground height for physics simulation
 */
const GROUND_HEIGHT = 100;

/**
 * Playable area height (screen minus controls)
 */
const PLAY_AREA_HEIGHT = height - 300;

/**
 * Physics constants for realistic object motion
 */
const DEFAULT_GRAVITY = 980; // pixels/s² (Earth-like gravity)
const AIR_RESISTANCE = 0.02; // Air friction coefficient
const RESTITUTION = 0.7; // Bounciness factor (0 = no bounce, 1 = perfect bounce)

/**
 * Physics object interface for thrown items
 * @interface PhysicsObject
 */
interface PhysicsObject {
  /** Unique identifier */
  id: number;
  /** Current X position */
  x: number;
  /** Current Y position */
  y: number;
  /** X velocity (pixels/second) */
  vx: number;
  /** Y velocity (pixels/second) */
  vy: number;
  /** Visual type of object */
  type: 'ball' | 'cube' | 'star';
  /** Object color */
  color: string;
  /** Object diameter in pixels */
  size: number;
  /** Motion trail for visual effect */
  trail: Array<{ x: number; y: number }>;
}

/**
 * Target interface for scoring system
 * @interface Target
 */
interface Target {
  /** Unique identifier */
  id: number;
  /** X position on screen */
  x: number;
  /** Y position on screen */
  y: number;
  /** Target radius for hit detection */
  radius: number;
  /** Points awarded for hitting */
  points: number;
  /** Whether target has been hit */
  hit: boolean;
}

/**
 * GameDemo - Interactive physics playground demonstrating gaming applications
 * 
 * @description
 * This screen showcases how SwipePredictor enhances mobile games through:
 * - Real-time trajectory prediction for projectiles
 * - Visual path preview before releasing objects
 * - Predicted impact point visualization
 * - Physics-based gameplay with scoring
 * 
 * Key features:
 * - Throw objects with swipe gestures
 * - See predicted path as blue dots (opacity = confidence)
 * - Predicted landing zone shown as pulsing circle
 * - Hit targets for points with combo multiplier
 * - Adjustable gravity for different physics behaviors
 * - Toggle prediction on/off to compare experiences
 * 
 * The physics simulation includes:
 * - Gravity acceleration
 * - Air resistance
 * - Ground bouncing with energy loss
 * - Wall collisions
 * - Accurate trajectory calculation
 * 
 * @component
 * @returns {JSX.Element} Physics playground with controls and scoring
 * 
 * @example
 * // The prediction system calculates trajectory using:
 * // x = x0 + vx*t
 * // y = y0 + vy*t + 0.5*g*t²
 * // With air resistance: v = v * (1 - resistance)
 */
export default function GameDemo() {
  const [gravity, setGravity] = useState(DEFAULT_GRAVITY);
  const [showPrediction, setShowPrediction] = useState(true);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [objects, setObjects] = useState<PhysicsObject[]>([]);
  const [targets, setTargets] = useState<Target[]>([
    { id: 1, x: width * 0.7, y: PLAY_AREA_HEIGHT - 150, radius: 30, points: 10, hit: false },
    { id: 2, x: width * 0.8, y: PLAY_AREA_HEIGHT - 250, radius: 25, points: 20, hit: false },
    { id: 3, x: width * 0.6, y: PLAY_AREA_HEIGHT - 350, radius: 20, points: 50, hit: false },
  ]);

  const throwStartRef = useRef<{ x: number; y: number } | null>(null);
  const predictionPathRef = useRef<Array<{ x: number; y: number }>>([]);
  const landingPointRef = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);

  const currentObjectX = useSharedValue(50);
  const currentObjectY = useSharedValue(PLAY_AREA_HEIGHT - 100);
  const currentObjectOpacity = useSharedValue(1);
  const trajectoryOpacity = useSharedValue(0);

  const {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    prediction,
    isActive,
  } = useSwipePredictor({
    confidenceThreshold: 0.5,
    onPrediction: (pred) => {
      if (showPrediction && throwStartRef.current) {
        // Calculate predicted trajectory
        const startX = throwStartRef.current.x;
        const startY = throwStartRef.current.y;
        const vx = pred.x * 2; // Velocity multiplier
        const vy = pred.y * 2;

        const path: Array<{ x: number; y: number }> = [];
        const dt = 0.016; // 60fps
        let x = startX;
        let y = startY;
        let vxCurrent = vx;
        let vyCurrent = vy;

        // Simulate trajectory
        for (let i = 0; i < 200; i++) {
          vyCurrent += gravity * dt;
          vxCurrent *= (1 - AIR_RESISTANCE * dt);
          vyCurrent *= (1 - AIR_RESISTANCE * dt);
          
          x += vxCurrent * dt;
          y += vyCurrent * dt;

          path.push({ x, y });

          // Stop at ground
          if (y >= PLAY_AREA_HEIGHT - GROUND_HEIGHT) {
            landingPointRef.current = { x, y: PLAY_AREA_HEIGHT - GROUND_HEIGHT };
            break;
          }

          // Stop at screen edges
          if (x < 0 || x > width) break;
        }

        predictionPathRef.current = path;
        trajectoryOpacity.value = withTiming(pred.confidence);
      }
    },
  });

  /**
   * Handle touch start event to begin throw gesture
   * @param {GestureResponderEvent} e - Touch event
   */
  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    const coords = getTouchCoordinates(e);
    if (coords) {
      throwStartRef.current = { x: coords.x, y: coords.y };
      currentObjectOpacity.value = 1;
      currentObjectX.value = coords.x;
      currentObjectY.value = coords.y;
      onTouchStart(undefined);
    }
  }, [onTouchStart, currentObjectX, currentObjectY, currentObjectOpacity]);

  /**
   * Handle touch move to update prediction
   * @param {GestureResponderEvent} e - Touch event
   */
  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const coords = getTouchCoordinates(e);
    if (coords && throwStartRef.current) {
      const dx = coords.x - throwStartRef.current.x;
      const dy = coords.y - throwStartRef.current.y;
      onTouchMove(createGestureEvent(dx, dy));
    }
  }, [onTouchMove]);

  /**
   * Handle touch end to create physics object and launch it
   */
  const handleTouchEnd = useCallback(() => {
    onTouchEnd(undefined);
    
    if (prediction && throwStartRef.current) {
      // Create new physics object
      const newObject: PhysicsObject = {
        id: Date.now(),
        x: throwStartRef.current.x,
        y: throwStartRef.current.y,
        vx: prediction.x * 2,
        vy: prediction.y * 2,
        type: 'ball',
        color: '#007AFF',
        size: 20,
        trail: [],
      };

      setObjects(prev => [...prev, newObject]);
      currentObjectOpacity.value = withTiming(0);
      trajectoryOpacity.value = withTiming(0);

      // Check prediction accuracy after throw completes
      if (landingPointRef.current) {
        setTimeout(() => {
          // Compare actual landing with prediction
          const actualLanding = objects[objects.length - 1]?.trail.slice(-1)[0];
          if (actualLanding && landingPointRef.current) {
            const distance = Math.sqrt(
              Math.pow(actualLanding.x - landingPointRef.current.x, 2) +
              Math.pow(actualLanding.y - landingPointRef.current.y, 2)
            );
            const accuracyPercent = Math.max(0, 100 - (distance / 5));
            setAccuracy(Math.round(accuracyPercent));
          }
        }, 2000);
      }
    }

    throwStartRef.current = null;
    predictionPathRef.current = [];
    landingPointRef.current = null;
  }, [onTouchEnd, prediction, currentObjectOpacity, trajectoryOpacity, objects]);

  // Physics simulation
  useEffect(() => {
    const animate = () => {
      setObjects(prevObjects => {
        return prevObjects.map(obj => {
          let { x, y, vx, vy, trail } = obj;
          
          // Apply physics
          vy += gravity * 0.016;
          vx *= (1 - AIR_RESISTANCE * 0.016);
          vy *= (1 - AIR_RESISTANCE * 0.016);
          
          x += vx * 0.016;
          y += vy * 0.016;

          // Ground collision
          if (y >= PLAY_AREA_HEIGHT - GROUND_HEIGHT) {
            y = PLAY_AREA_HEIGHT - GROUND_HEIGHT;
            vy = -vy * RESTITUTION;
            vx *= 0.8; // Friction
          }

          // Wall collisions
          if (x <= obj.size || x >= width - obj.size) {
            x = x <= obj.size ? obj.size : width - obj.size;
            vx = -vx * RESTITUTION;
          }

          // Check target hits
          targets.forEach(target => {
            if (!target.hit) {
              const dist = Math.sqrt(Math.pow(x - target.x, 2) + Math.pow(y - target.y, 2));
              if (dist < target.radius + obj.size) {
                setTargets(prev => prev.map(t => 
                  t.id === target.id ? { ...t, hit: true } : t
                ));
                setScore(prev => prev + target.points);
                setCombo(prev => prev + 1);
              }
            }
          });

          // Update trail
          const newTrail = [...trail, { x, y }].slice(-30);

          // Remove if stopped
          if (Math.abs(vx) < 1 && Math.abs(vy) < 1 && y >= PLAY_AREA_HEIGHT - GROUND_HEIGHT - 1) {
            return null;
          }

          return { ...obj, x, y, vx, vy, trail: newTrail };
        }).filter(Boolean) as PhysicsObject[];
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gravity, targets]);

  /**
   * Reset all targets and scores for a new game
   */
  const resetTargets = () => {
    setTargets(prev => prev.map(t => ({ ...t, hit: false })));
    setScore(0);
    setCombo(0);
    setObjects([]);
  };

  const currentObjectStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: currentObjectX.value - 10 },
      { translateY: currentObjectY.value - 10 },
    ],
    opacity: currentObjectOpacity.value,
  }));

  return (
    <View style={styles.container}>
      {/* Game Area */}
      <View
        style={styles.gameArea}
        onResponderGrant={handleTouchStart}
        onResponderMove={handleTouchMove}
        onResponderRelease={handleTouchEnd}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        {/* Targets */}
        {targets.map(target => (
          <View
            key={target.id}
            style={[
              styles.target,
              {
                left: target.x - target.radius,
                top: target.y - target.radius,
                width: target.radius * 2,
                height: target.radius * 2,
                borderRadius: target.radius,
                opacity: target.hit ? 0.3 : 1,
              },
            ]}
          >
            <Text style={styles.targetText}>{target.points}</Text>
          </View>
        ))}

        {/* Physics Objects */}
        {objects.map(obj => (
          <React.Fragment key={obj.id}>
            {/* Trail */}
            {obj.trail.map((point, i) => (
              <View
                key={i}
                style={[
                  styles.trailDot,
                  {
                    left: point.x - 2,
                    top: point.y - 2,
                    opacity: i / obj.trail.length * 0.5,
                  },
                ]}
              />
            ))}
            {/* Object */}
            <View
              style={[
                styles.physicsObject,
                {
                  left: obj.x - obj.size / 2,
                  top: obj.y - obj.size / 2,
                  width: obj.size,
                  height: obj.size,
                  backgroundColor: obj.color,
                  borderRadius: obj.type === 'ball' ? obj.size / 2 : 4,
                },
              ]}
            />
          </React.Fragment>
        ))}

        {/* Current throw object */}
        <Animated.View style={[styles.currentObject, currentObjectStyle]} />

        {/* Prediction trajectory */}
        {showPrediction && isActive && predictionPathRef.current.map((point, i) => (
          <Animated.View
            key={i}
            style={[
              styles.predictionDot,
              {
                left: point.x - 3,
                top: point.y - 3,
                opacity: trajectoryOpacity.value * (1 - i / predictionPathRef.current.length),
              },
            ]}
          />
        ))}

        {/* Landing prediction */}
        {showPrediction && isActive && landingPointRef.current && (
          <Animated.View
            style={[
              styles.landingPreview,
              {
                left: landingPointRef.current.x - 20,
                top: landingPointRef.current.y - 20,
                opacity: trajectoryOpacity.value,
              },
            ]}
          />
        )}

        {/* Ground */}
        <View style={styles.ground} />
      </View>

      {/* HUD */}
      <View style={styles.hud}>
        <View style={styles.hudRow}>
          <Text style={styles.hudLabel}>Score: {score}</Text>
          <Text style={styles.hudLabel}>Combo: x{combo}</Text>
          <Text style={styles.hudLabel}>Accuracy: {accuracy}%</Text>
        </View>
      </View>

      {/* Controls */}
      <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
        <View style={styles.controlSection}>
          <Text style={styles.controlTitle}>Prediction</Text>
          <TouchableOpacity
            style={[styles.toggleButton, showPrediction && styles.toggleButtonActive]}
            onPress={() => setShowPrediction(!showPrediction)}
          >
            <Text style={styles.toggleButtonText}>
              {showPrediction ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.controlSection}>
          <Text style={styles.controlTitle}>Gravity: {(gravity / DEFAULT_GRAVITY).toFixed(1)}x</Text>
          <Slider
            style={styles.slider}
            minimumValue={0.1}
            maximumValue={3}
            value={gravity / DEFAULT_GRAVITY}
            onValueChange={(value) => setGravity(value * DEFAULT_GRAVITY)}
            minimumTrackTintColor="#007AFF"
            maximumTrackTintColor="#3A3A3C"
            thumbTintColor="#FFFFFF"
          />
        </View>

        <TouchableOpacity style={styles.resetButton} onPress={resetTargets}>
          <Text style={styles.resetButtonText}>Reset Game</Text>
        </TouchableOpacity>

        <Text style={styles.instructions}>
          Swipe to throw objects at targets. 
          {showPrediction ? ' Blue dots show predicted path.' : ' Prediction is OFF.'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  gameArea: {
    height: PLAY_AREA_HEIGHT,
    backgroundColor: '#0A0A0A',
    position: 'relative',
    overflow: 'hidden',
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: GROUND_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderTopWidth: 2,
    borderTopColor: '#2C2C2E',
  },
  target: {
    position: 'absolute',
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B60',
  },
  targetText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  physicsObject: {
    position: 'absolute',
  },
  currentObject: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  trailDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  predictionDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#00C7FF',
    borderRadius: 3,
  },
  landingPreview: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: '#00C7FF',
    backgroundColor: 'rgba(0, 199, 255, 0.2)',
  },
  hud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hudLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  controls: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    padding: 20,
  },
  controlSection: {
    marginBottom: 20,
  },
  controlTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  toggleButton: {
    backgroundColor: '#3A3A3C',
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  toggleButtonActive: {
    backgroundColor: '#007AFF',
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  slider: {
    height: 40,
  },
  resetButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    alignSelf: 'center',
    marginVertical: 20,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    color: '#8E8E93',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});