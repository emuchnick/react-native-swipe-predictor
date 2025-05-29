import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Line, G } from 'react-native-svg';
import type { DebugInfo, Prediction } from '../types';

interface SwipePredictorDebugOverlayProps {
  debugInfo?: DebugInfo;
  prediction?: Prediction | null;
  width: number;
  height: number;
}

export function SwipePredictorDebugOverlay({ 
  debugInfo, 
  prediction,
  width,
  height 
}: SwipePredictorDebugOverlayProps) {
  if (!debugInfo) return null;
  
  const { touchPoints, velocity, fps } = debugInfo;
  
  // Generate path for touch trail
  const pathData = touchPoints
    .map((point, index) => {
      const x = width / 2 + point.x;
      const y = height / 2 + point.y;
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');
  
  // Current position
  const currentPos = touchPoints[touchPoints.length - 1];
  const currentX = currentPos ? width / 2 + currentPos.x : width / 2;
  const currentY = currentPos ? height / 2 + currentPos.y : height / 2;
  
  // Velocity vector
  const velocityScale = 0.1;
  const velocityEndX = currentX + velocity.x * velocityScale;
  const velocityEndY = currentY + velocity.y * velocityScale;
  
  // Predicted position
  const predX = prediction ? width / 2 + prediction.x : currentX;
  const predY = prediction ? height / 2 + prediction.y : currentY;
  
  return (
    <View style={[styles.overlay, { width, height }]} pointerEvents="none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {/* Touch trail */}
        {pathData && (
          <Path
            d={pathData}
            stroke="#007AFF"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        
        {/* Current position */}
        <Circle cx={currentX} cy={currentY} r={8} fill="#007AFF" />
        
        {/* Velocity vector */}
        <G>
          <Line
            x1={currentX}
            y1={currentY}
            x2={velocityEndX}
            y2={velocityEndY}
            stroke="#FF3B30"
            strokeWidth={3}
            markerEnd="url(#arrowhead)"
          />
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#FF3B30" />
            </marker>
          </defs>
        </G>
        
        {/* Predicted position */}
        {prediction && (
          <Circle
            cx={predX}
            cy={predY}
            r={12}
            fill="#34C759"
            opacity={prediction.confidence}
          />
        )}
      </Svg>
      
      {/* Debug info */}
      <View style={styles.infoContainer}>
        <Text style={styles.infoText}>FPS: {fps}</Text>
        <Text style={styles.infoText}>
          Velocity: ({velocity.x.toFixed(0)}, {velocity.y.toFixed(0)}) px/s
        </Text>
        {prediction && (
          <Text style={styles.infoText}>
            Confidence: {(prediction.confidence * 100).toFixed(0)}%
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  infoContainer: {
    position: 'absolute',
    top: 40,
    left: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 8,
  },
  infoText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});