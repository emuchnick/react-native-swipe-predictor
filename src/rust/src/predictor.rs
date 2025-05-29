use std::collections::VecDeque;

use crate::error::{PredictorError, Result};
use crate::physics::PhysicsConfig;
use crate::types::{Point2D, Prediction, Timestamp, TouchPoint, Velocity2D};

const MIN_BUFFER_SIZE: usize = 2;
const MAX_BUFFER_SIZE: usize = 100;
const DEFAULT_BUFFER_SIZE: usize = 10;

const DECELERATION_FACTOR: f64 = 0.9;
const SPEED_CONFIDENCE_SCALE: f64 = 500.0;
const DURATION_CONFIDENCE_SCALE: f64 = 100.0;

pub struct GesturePredictor {
    touch_buffer: VecDeque<TouchPoint>,
    buffer_size: usize,
    physics_config: PhysicsConfig,
    gesture_start_time: Option<Timestamp>,
}

impl GesturePredictor {
    pub fn new(physics_config: PhysicsConfig) -> Result<Self> {
        physics_config.validate()?;
        Ok(Self::new_unchecked(physics_config))
    }

    fn new_unchecked(physics_config: PhysicsConfig) -> Self {
        Self::with_buffer_size_unchecked(physics_config, DEFAULT_BUFFER_SIZE)
    }

    pub fn with_buffer_size(physics_config: PhysicsConfig, buffer_size: usize) -> Result<Self> {
        physics_config.validate()?;
        Ok(Self::with_buffer_size_unchecked(physics_config, buffer_size))
    }

    fn with_buffer_size_unchecked(physics_config: PhysicsConfig, buffer_size: usize) -> Self {
        let buffer_size = buffer_size.clamp(MIN_BUFFER_SIZE, MAX_BUFFER_SIZE);
        Self {
            touch_buffer: VecDeque::with_capacity(buffer_size),
            buffer_size,
            physics_config,
            gesture_start_time: None,
        }
    }

    pub fn add_touch_point(&mut self, x: f64, y: f64, timestamp_ms: f64) -> Result<()> {
        let touch_point = TouchPoint::new(x, y, timestamp_ms)
            .ok_or(PredictorError::InvalidTimestamp {
                timestamp: timestamp_ms,
                reason: "must be non-negative and finite",
            })?;

        // Check timestamp ordering
        if let Some(last) = self.touch_buffer.back() {
            if touch_point.timestamp < last.timestamp {
                return Err(PredictorError::TimestampOutOfOrder {
                    previous: last.timestamp.as_millis(),
                    current: touch_point.timestamp.as_millis(),
                });
            }
        }

        // Set gesture start time
        if self.gesture_start_time.is_none() {
            self.gesture_start_time = Some(touch_point.timestamp);
        }

        // Maintain buffer size
        if self.touch_buffer.len() >= self.buffer_size {
            self.touch_buffer.pop_front();
        }

        self.touch_buffer.push_back(touch_point);
        Ok(())
    }

    pub fn predict(&self) -> Result<Prediction> {
        // Check minimum data requirements
        if self.touch_buffer.len() < 2 {
            return Err(PredictorError::InsufficientData {
                required: 2,
                actual: self.touch_buffer.len(),
            });
        }

        // Check gesture duration
        let gesture_duration = self.calculate_gesture_duration()?;
        if gesture_duration < self.physics_config.min_gesture_time_ms {
            return Err(PredictorError::GestureTooShort {
                duration_ms: gesture_duration,
                minimum_ms: self.physics_config.min_gesture_time_ms,
            });
        }

        // Calculate weighted velocity
        let velocity = self.calculate_weighted_velocity()?;
        let speed = velocity.speed();

        if speed < self.physics_config.min_velocity_threshold {
            return Err(PredictorError::VelocityTooLow {
                velocity: speed,
                minimum: self.physics_config.min_velocity_threshold,
            });
        }

        // Get current position
        let current_point = self.touch_buffer.back().unwrap();

        // Calculate stopping distance
        let (distance_x, distance_y, _) = self.physics_config
            .calculate_stopping_distance(velocity.x, velocity.y)?;

        // Calculate predicted position
        let predicted_position = Point2D::new(
            current_point.position.x + distance_x,
            current_point.position.y + distance_y,
        );

        // Calculate confidence
        let confidence = self.calculate_confidence(speed, gesture_duration);

        Ok(Prediction::new(predicted_position, confidence))
    }

    fn calculate_gesture_duration(&self) -> Result<f64> {
        match (self.gesture_start_time, self.touch_buffer.back()) {
            (Some(start), Some(last)) => {
                Ok(last.timestamp.duration_since(&start).unwrap_or(0.0))
            }
            _ => Ok(0.0),
        }
    }

    fn calculate_weighted_velocity(&self) -> Result<Velocity2D> {
        if self.touch_buffer.len() < 2 {
            return Err(PredictorError::InsufficientData {
                required: 2,
                actual: self.touch_buffer.len(),
            });
        }

        let mut total_velocity_x = 0.0;
        let mut total_velocity_y = 0.0;
        let mut total_weight = 0.0;

        let n = self.touch_buffer.len();
        let points: Vec<&TouchPoint> = self.touch_buffer.iter().collect();

        for i in 1..n {
            let prev = &points[i - 1];
            let curr = &points[i];

            if let Some(dt) = curr.timestamp.duration_since(&prev.timestamp) {
                if dt > 0.0 {
                    if let Some(velocity) = Velocity2D::from_points_and_time(
                        prev.position,
                        curr.position,
                        dt,
                    ) {
                        // Weight more recent velocities higher
                        let weight = (i as f64 / n as f64).powi(2);

                        total_velocity_x += velocity.x * weight;
                        total_velocity_y += velocity.y * weight;
                        total_weight += weight;
                    }
                }
            }
        }

        if total_weight > 0.0 {
            Ok(Velocity2D::new(
                total_velocity_x / total_weight,
                total_velocity_y / total_weight,
            ))
        } else {
            Err(PredictorError::NumericalError {
                operation: "velocity calculation",
                details: "no valid velocity measurements",
            })
        }
    }

    fn calculate_confidence(&self, speed: f64, gesture_duration: f64) -> f64 {
        // Speed confidence (0 to 1)
        let speed_confidence = (speed / SPEED_CONFIDENCE_SCALE).min(1.0);

        // Duration confidence (0 to 1)
        let duration_confidence = ((gesture_duration - self.physics_config.min_gesture_time_ms)
            / DURATION_CONFIDENCE_SCALE)
            .clamp(0.0, 1.0);

        // Straightness score (0 to 1)
        let straightness_score = self.calculate_straightness_score();

        // Deceleration penalty
        let deceleration_penalty = if self.is_gesture_decelerating() {
            0.5
        } else {
            1.0
        };

        // Combine factors
        speed_confidence * duration_confidence * straightness_score * deceleration_penalty
    }

    fn calculate_straightness_score(&self) -> f64 {
        if self.touch_buffer.len() < 3 {
            return 1.0;
        }

        let first = &self.touch_buffer.front().unwrap().position;
        let last = &self.touch_buffer.back().unwrap().position;

        let direct_distance = first.distance_to(last);

        if direct_distance < 1.0 {
            return 0.0;
        }

        let mut path_distance = 0.0;
        let points: Vec<&TouchPoint> = self.touch_buffer.iter().collect();

        for i in 1..points.len() {
            path_distance += points[i - 1].position.distance_to(&points[i].position);
        }

        (direct_distance / path_distance).clamp(0.0, 1.0)
    }

    fn is_gesture_decelerating(&self) -> bool {
        if self.touch_buffer.len() < 4 {
            return false;
        }

        let n = self.touch_buffer.len();
        let start_idx = n.saturating_sub(4);

        let mut recent_speeds = Vec::new();
        let points: Vec<&TouchPoint> = self.touch_buffer.iter().skip(start_idx).collect();

        for i in 1..points.len() {
            if let Some(dt) = points[i].timestamp.duration_since(&points[i - 1].timestamp) {
                if dt > 0.0 {
                    let distance = points[i - 1].position.distance_to(&points[i].position);
                    let speed = distance / dt * 1000.0; // Convert to pixels/second
                    recent_speeds.push(speed);
                }
            }
        }

        if recent_speeds.len() >= 2 {
            recent_speeds
                .windows(2)
                .all(|w| w[1] < w[0] * DECELERATION_FACTOR)
        } else {
            false
        }
    }

    pub fn reset(&mut self) {
        self.touch_buffer.clear();
        self.gesture_start_time = None;
    }

    pub fn detect_cancellation(&self) -> bool {
        if self.touch_buffer.len() < 3 {
            return false;
        }

        let points: Vec<&TouchPoint> = self.touch_buffer.iter().collect();
        let n = points.len();

        // Check for direction reversal
        if n >= 3 {
            let v1 = points[n - 2].position - points[n - 3].position;
            let v2 = points[n - 1].position - points[n - 2].position;

            // Dot product < 0 means angle > 90 degrees
            let dot_product = v1.x * v2.x + v1.y * v2.y;
            if dot_product < 0.0 {
                return true;
            }
        }

        // Check for deceleration below threshold
        if self.is_gesture_decelerating() {
            if let Ok(velocity) = self.calculate_weighted_velocity() {
                let speed = velocity.speed();
                return speed < self.physics_config.min_velocity_threshold * 0.5;
            }
        }

        false
    }

    pub fn buffer_size(&self) -> usize {
        self.buffer_size
    }

    pub fn point_count(&self) -> usize {
        self.touch_buffer.len()
    }

    pub fn is_active(&self) -> bool {
        !self.touch_buffer.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_prediction() {
        let config = PhysicsConfig::default();
        let mut predictor = GesturePredictor::new(config).unwrap();

        // Add points moving horizontally at 1000 px/s
        for i in 0..6 {
            let _ = predictor.add_touch_point(i as f64 * 20.0, 0.0, i as f64 * 20.0);
        }

        let prediction = predictor.predict().unwrap();
        assert!(prediction.position.x > 100.0);
        assert!(prediction.confidence > 0.0);
    }

    #[test]
    fn test_insufficient_data() {
        let config = PhysicsConfig::default();
        let mut predictor = GesturePredictor::new(config).unwrap();

        let _ = predictor.add_touch_point(0.0, 0.0, 0.0);

        let result = predictor.predict();
        assert!(matches!(
            result,
            Err(PredictorError::InsufficientData { required: 2, actual: 1 })
        ));
    }

    #[test]
    fn test_timestamp_validation() {
        let config = PhysicsConfig::default();
        let mut predictor = GesturePredictor::new(config).unwrap();

        // Valid timestamp
        assert!(predictor.add_touch_point(0.0, 0.0, 0.0).is_ok());

        // Invalid negative timestamp
        assert!(predictor.add_touch_point(10.0, 0.0, -10.0).is_err());

        // Out of order timestamp
        assert!(predictor.add_touch_point(20.0, 0.0, 10.0).is_ok());
        assert!(predictor.add_touch_point(30.0, 0.0, 5.0).is_err());
    }

    #[test]
    fn test_gesture_cancellation() {
        let config = PhysicsConfig::default();
        let mut predictor = GesturePredictor::new(config).unwrap();

        // Moving forward
        let _ = predictor.add_touch_point(0.0, 0.0, 0.0);
        let _ = predictor.add_touch_point(10.0, 0.0, 10.0);
        let _ = predictor.add_touch_point(20.0, 0.0, 20.0);

        assert!(!predictor.detect_cancellation());

        // Reverse direction
        let _ = predictor.add_touch_point(15.0, 0.0, 30.0);

        assert!(predictor.detect_cancellation());
    }

    #[test]
    fn test_buffer_size_limits() {
        let config = PhysicsConfig::default();

        let predictor = GesturePredictor::with_buffer_size(config, 0).unwrap();
        assert_eq!(predictor.buffer_size(), MIN_BUFFER_SIZE);

        let predictor = GesturePredictor::with_buffer_size(config, 1000).unwrap();
        assert_eq!(predictor.buffer_size(), MAX_BUFFER_SIZE);

        let predictor = GesturePredictor::with_buffer_size(config, 20).unwrap();
        assert_eq!(predictor.buffer_size(), 20);
    }

    #[test]
    fn test_reset() {
        let config = PhysicsConfig::default();
        let mut predictor = GesturePredictor::new(config).unwrap();

        let _ = predictor.add_touch_point(0.0, 0.0, 0.0);
        let _ = predictor.add_touch_point(10.0, 0.0, 10.0);

        assert_eq!(predictor.point_count(), 2);
        assert!(predictor.is_active());

        predictor.reset();

        assert_eq!(predictor.point_count(), 0);
        assert!(!predictor.is_active());
    }
}