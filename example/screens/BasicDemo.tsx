import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Switch,
} from 'react-native';
import { useSwipePredictor } from 'react-native-swipe-predictor';
import { SwipePredictorDebugOverlay } from 'react-native-swipe-predictor';
import { createGestureEvent, getTouchCoordinates } from '../utils/gestureHelpers';

/**
 * Get device dimensions for responsive layout
 */
const { width, height } = Dimensions.get('window');

/**
 * BasicDemo - Core demonstration of swipe prediction functionality
 * 
 * @description
 * This screen demonstrates the fundamental capabilities of the SwipePredictor library.
 * It provides:
 * - Real-time gesture tracking and prediction
 * - Visual debug overlay showing prediction paths and touch points
 * - Confidence level visualization
 * - Toggle between debug and simple visualization modes
 * 
 * The demo uses the core `useSwipePredictor` hook directly, giving full control
 * over gesture handling and prediction visualization.
 * 
 * @component
 * @returns {JSX.Element} Interactive demo screen with gesture area and controls
 * 
 * @example
 * // Used in navigation:
 * <Tab.Screen name="Basic" component={BasicDemo} />
 */
export default function BasicDemo() {
  const [showDebug, setShowDebug] = useState(true);
  const { prediction, debugInfo, onTouchStart, onTouchMove, onTouchEnd, isActive } = useSwipePredictor({
    debug: true,
    confidenceThreshold: 0.7,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Swipe anywhere to see predictions</Text>
        <View style={styles.switchContainer}>
          <Text style={styles.switchLabel}>Debug Overlay</Text>
          <Switch
            value={showDebug}
            onValueChange={setShowDebug}
            trackColor={{ false: '#3A3A3C', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>

      <View
        style={styles.gestureArea}
        onResponderGrant={() => onTouchStart()}
        onResponderMove={(e) => {
          const coords = getTouchCoordinates(e);
          if (coords) {
            onTouchMove(createGestureEvent(coords.x, coords.y));
          }
        }}
        onResponderRelease={() => onTouchEnd()}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
      >
        {showDebug && debugInfo && (
          <SwipePredictorDebugOverlay
            debugInfo={debugInfo}
            prediction={prediction}
            width={width}
            height={height - 200}
          />
        )}
        
        {!showDebug && prediction && (
          <View 
            pointerEvents="none"
            style={[
              styles.predictionDot,
              {
                transform: [
                  { translateX: prediction.x },
                  { translateY: prediction.y },
                ],
                opacity: prediction.confidence,
              },
            ]}
          />
        )}
      </View>

      <View style={styles.stats}>
        {prediction ? (
          <>
            <Text style={styles.statsText}>
              Prediction: ({Math.round(prediction.x)}, {Math.round(prediction.y)})
            </Text>
            <Text style={styles.statsText}>
              Confidence: {(prediction.confidence * 100).toFixed(0)}%
            </Text>
            <Text style={[styles.statsText, styles.activeText]}>
              {isActive ? 'Gesture Active' : 'Gesture Ended'}
            </Text>
          </>
        ) : (
          <Text style={styles.statsText}>Start swiping to see predictions</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#1C1C1E',
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  title: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 10,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  gestureArea: {
    flex: 1,
    backgroundColor: '#000000',
    position: 'relative',
  },
  predictionDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007AFF',
    marginLeft: -10,
    marginTop: -10,
  },
  stats: {
    backgroundColor: '#1C1C1E',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#2C2C2E',
  },
  statsText: {
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 5,
  },
  activeText: {
    color: '#34C759',
    fontWeight: '600',
  },
});