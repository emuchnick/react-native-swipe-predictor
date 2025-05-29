use std::fmt;

#[derive(Debug, Clone, PartialEq)]
pub enum PredictorError {
    // Data collection errors
    InsufficientData {
        required: usize,
        actual: usize,
    },
    InvalidTimestamp {
        timestamp: f64,
        reason: &'static str,
    },
    TimestampOutOfOrder {
        previous: f64,
        current: f64,
    },
    
    // Gesture analysis errors
    GestureTooShort {
        duration_ms: f64,
        minimum_ms: f64,
    },
    VelocityTooLow {
        velocity: f64,
        minimum: f64,
    },
    
    // Configuration errors
    InvalidConfiguration {
        field: &'static str,
        value: f64,
        reason: &'static str,
    },
    
    // Calculation errors
    NumericalError {
        operation: &'static str,
        details: &'static str,
    },
}

impl fmt::Display for PredictorError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PredictorError::InsufficientData { required, actual } => {
                write!(f, "Insufficient data: need {} points, have {}", required, actual)
            }
            PredictorError::InvalidTimestamp { timestamp, reason } => {
                write!(f, "Invalid timestamp {}: {}", timestamp, reason)
            }
            PredictorError::TimestampOutOfOrder { previous, current } => {
                write!(f, "Timestamp out of order: {} after {}", current, previous)
            }
            PredictorError::GestureTooShort { duration_ms, minimum_ms } => {
                write!(f, "Gesture too short: {}ms (minimum {}ms)", duration_ms, minimum_ms)
            }
            PredictorError::VelocityTooLow { velocity, minimum } => {
                write!(f, "Velocity too low: {} px/s (minimum {} px/s)", velocity, minimum)
            }
            PredictorError::InvalidConfiguration { field, value, reason } => {
                write!(f, "Invalid configuration: {} = {} ({})", field, value, reason)
            }
            PredictorError::NumericalError { operation, details } => {
                write!(f, "Numerical error in {}: {}", operation, details)
            }
        }
    }
}

impl std::error::Error for PredictorError {}

pub type Result<T> = std::result::Result<T, PredictorError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = PredictorError::InsufficientData {
            required: 2,
            actual: 1,
        };
        assert_eq!(err.to_string(), "Insufficient data: need 2 points, have 1");

        let err = PredictorError::GestureTooShort {
            duration_ms: 20.0,
            minimum_ms: 30.0,
        };
        assert_eq!(err.to_string(), "Gesture too short: 20ms (minimum 30ms)");
    }
}