use crate::error::{PredictorError, Result};

#[derive(Debug, Clone, Copy)]
pub struct PhysicsConfig {
    /// Deceleration rate in pixels/second²
    pub deceleration_rate: f64,
    /// Minimum velocity threshold in pixels/second
    pub min_velocity_threshold: f64,
    /// Minimum gesture time in milliseconds
    pub min_gesture_time_ms: f64,
}

impl Default for PhysicsConfig {
    fn default() -> Self {
        Self {
            deceleration_rate: 1500.0,      // pixels/second²
            min_velocity_threshold: 50.0,   // pixels/second
            min_gesture_time_ms: 30.0,      // milliseconds
        }
    }
}

impl PhysicsConfig {
    pub fn new(
        deceleration_rate: f64,
        min_velocity_threshold: f64,
        min_gesture_time_ms: f64,
    ) -> Result<Self> {
        let config = Self {
            deceleration_rate,
            min_velocity_threshold,
            min_gesture_time_ms,
        };
        config.validate()?;
        Ok(config)
    }

    pub fn validate(&self) -> Result<()> {
        if self.deceleration_rate <= 0.0 {
            return Err(PredictorError::InvalidConfiguration {
                field: "deceleration_rate",
                value: self.deceleration_rate,
                reason: "must be positive",
            });
        }
        
        if !self.deceleration_rate.is_finite() {
            return Err(PredictorError::InvalidConfiguration {
                field: "deceleration_rate",
                value: self.deceleration_rate,
                reason: "must be finite",
            });
        }
        
        if self.min_velocity_threshold < 0.0 {
            return Err(PredictorError::InvalidConfiguration {
                field: "min_velocity_threshold",
                value: self.min_velocity_threshold,
                reason: "cannot be negative",
            });
        }
        
        if !self.min_velocity_threshold.is_finite() {
            return Err(PredictorError::InvalidConfiguration {
                field: "min_velocity_threshold",
                value: self.min_velocity_threshold,
                reason: "must be finite",
            });
        }
        
        if self.min_gesture_time_ms < 0.0 {
            return Err(PredictorError::InvalidConfiguration {
                field: "min_gesture_time_ms",
                value: self.min_gesture_time_ms,
                reason: "cannot be negative",
            });
        }
        
        if !self.min_gesture_time_ms.is_finite() {
            return Err(PredictorError::InvalidConfiguration {
                field: "min_gesture_time_ms",
                value: self.min_gesture_time_ms,
                reason: "must be finite",
            });
        }
        
        Ok(())
    }

    /// Calculate the predicted endpoint given initial velocity
    /// Returns (distance_x, distance_y, time_to_stop)
    pub fn calculate_stopping_distance(
        &self,
        velocity_x: f64,
        velocity_y: f64,
    ) -> Result<(f64, f64, f64)> {
        let speed = (velocity_x * velocity_x + velocity_y * velocity_y).sqrt();
        
        if speed < self.min_velocity_threshold {
            return Err(PredictorError::VelocityTooLow {
                velocity: speed,
                minimum: self.min_velocity_threshold,
            });
        }
        
        if speed < f64::EPSILON {
            return Ok((0.0, 0.0, 0.0));
        }
        
        let time_to_stop = speed / self.deceleration_rate;
        
        // Calculate normalized velocity components
        let normalized_vx = velocity_x / speed;
        let normalized_vy = velocity_y / speed;
        
        // Distance = v*t - 0.5*a*t²
        // Where a is deceleration in the direction of motion
        let distance_x = velocity_x * time_to_stop 
            - 0.5 * normalized_vx * self.deceleration_rate * time_to_stop * time_to_stop;
        let distance_y = velocity_y * time_to_stop 
            - 0.5 * normalized_vy * self.deceleration_rate * time_to_stop * time_to_stop;
        
        Ok((distance_x, distance_y, time_to_stop))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_physics_config_validation() {
        // Valid config
        let config = PhysicsConfig::default();
        assert!(config.validate().is_ok());

        // Invalid deceleration
        let config = PhysicsConfig {
            deceleration_rate: -100.0,
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(PredictorError::InvalidConfiguration { field: "deceleration_rate", .. })
        ));

        // Invalid velocity threshold
        let config = PhysicsConfig {
            min_velocity_threshold: -1.0,
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(PredictorError::InvalidConfiguration { field: "min_velocity_threshold", .. })
        ));

        // Infinite value
        let config = PhysicsConfig {
            deceleration_rate: f64::INFINITY,
            ..Default::default()
        };
        assert!(matches!(
            config.validate(),
            Err(PredictorError::InvalidConfiguration { field: "deceleration_rate", .. })
        ));
    }

    #[test]
    fn test_stopping_distance_calculation() {
        let config = PhysicsConfig::default();
        
        // Test horizontal motion
        let (dx, dy, time) = config.calculate_stopping_distance(1000.0, 0.0).unwrap();
        assert!(dx > 0.0);
        assert_eq!(dy, 0.0);
        assert!(time > 0.0);
        
        // Verify physics: final velocity should be 0
        let final_velocity = 1000.0 - config.deceleration_rate * time;
        assert!((final_velocity).abs() < 1e-10);
        
        // Test diagonal motion
        let (dx, dy, _) = config.calculate_stopping_distance(500.0, 500.0).unwrap();
        assert!(dx > 0.0);
        assert!(dy > 0.0);
        assert_eq!(dx, dy); // Should be symmetric
        
        // Test low velocity
        let result = config.calculate_stopping_distance(10.0, 10.0);
        assert!(matches!(result, Err(PredictorError::VelocityTooLow { .. })));
    }
}