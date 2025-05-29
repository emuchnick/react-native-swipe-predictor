// Core modules
pub mod error;
pub mod physics;
pub mod predictor;
pub mod types;

// FFI modules (only compiled when needed)
#[cfg(feature = "ffi")]
pub mod ffi;

#[cfg(all(feature = "ffi", target_os = "android"))]
pub mod android;

#[cfg(all(feature = "ffi", target_os = "ios"))]
pub mod ios_bridge;

// Re-export commonly used types
pub use error::{PredictorError, Result};
pub use physics::PhysicsConfig;
pub use predictor::GesturePredictor;
pub use types::{Point2D, Prediction, Timestamp, Velocity2D};

// Re-export FFI functions at the crate root so they're available for linking
#[cfg(feature = "ffi")]
pub use ffi::*;

// Re-export iOS bridge functions
#[cfg(all(feature = "ffi", target_os = "ios"))]
pub use ios_bridge::*;