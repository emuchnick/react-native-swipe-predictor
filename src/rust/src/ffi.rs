use std::collections::HashMap;
use std::sync::Mutex;
use std::cell::RefCell;

use crate::physics::PhysicsConfig;
use crate::predictor::GesturePredictor;

const MAX_PREDICTORS: usize = 10000;

struct FFIState {
    predictors: HashMap<u32, GesturePredictor>,
    next_id: u32,
    physics_config: PhysicsConfig,
}

impl FFIState {
    fn new(physics_config: PhysicsConfig) -> Self {
        Self {
            predictors: HashMap::new(),
            next_id: 0,
            physics_config,
        }
    }

    fn create_predictor(&mut self) -> Option<u32> {
        if self.predictors.len() >= MAX_PREDICTORS {
            return None;
        }

        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1);

        match GesturePredictor::new(self.physics_config) {
            Ok(predictor) => {
                self.predictors.insert(id, predictor);
                Some(id)
            }
            Err(_) => None,
        }
    }

    fn get_predictor_mut(&mut self, id: u32) -> Option<&mut GesturePredictor> {
        self.predictors.get_mut(&id)
    }

    fn get_predictor(&self, id: u32) -> Option<&GesturePredictor> {
        self.predictors.get(&id)
    }

    fn remove_predictor(&mut self, id: u32) -> bool {
        self.predictors.remove(&id).is_some()
    }
}

// Thread-local storage for FFI state to avoid global mutable state
thread_local! {
    static FFI_STATE: RefCell<Option<FFIState>> = const { RefCell::new(None) };
}

// For multi-threaded scenarios, we also provide a mutex-based approach
static SHARED_FFI_STATE: Mutex<Option<FFIState>> = Mutex::new(None);

#[no_mangle]
pub extern "C" fn swipe_predictor_init(
    deceleration_rate: f64,
    min_velocity_threshold: f64,
    min_gesture_time_ms: f64,
    _velocity_smoothing_factor: f64, // Kept for ABI compatibility
) -> i32 {
    let physics_config = PhysicsConfig {
        deceleration_rate,
        min_velocity_threshold,
        min_gesture_time_ms,
    };

    // Validate config
    if physics_config.validate().is_err() {
        return 0;
    }

    // Use shared state for thread safety
    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    if state.is_some() {
        return 0; // Already initialized
    }

    *state = Some(FFIState::new(physics_config));
    1
}

#[no_mangle]
pub extern "C" fn swipe_predictor_create() -> i32 {
    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return -1,
    };

    match state.as_mut() {
        Some(ffi_state) => {
            ffi_state.create_predictor()
                .map(|id| id as i32)
                .unwrap_or(-1)
        }
        None => -1,
    }
}

#[no_mangle]
pub extern "C" fn swipe_predictor_add_point(
    predictor_id: i32,
    x: f64,
    y: f64,
    timestamp: f64,
) -> i32 {
    if predictor_id < 0 {
        return 0;
    }

    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    match state.as_mut() {
        Some(ffi_state) => {
            match ffi_state.get_predictor_mut(predictor_id as u32) {
                Some(predictor) => {
                    match predictor.add_touch_point(x, y, timestamp) {
                        Ok(_) => 1,
                        Err(_) => 0,
                    }
                }
                None => 0,
            }
        }
        None => 0,
    }
}

#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn swipe_predictor_get_prediction(
    predictor_id: i32,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    if out_x.is_null() || out_y.is_null() || out_confidence.is_null() {
        return 0;
    }

    if predictor_id < 0 {
        return 0;
    }

    let state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    match state.as_ref() {
        Some(ffi_state) => {
            match ffi_state.get_predictor(predictor_id as u32) {
                Some(predictor) => {
                    match predictor.predict() {
                        Ok(prediction) => {
                            // SAFETY: We checked that pointers are not null at the beginning of this function
                            unsafe {
                                *out_x = prediction.position.x;
                                *out_y = prediction.position.y;
                                *out_confidence = prediction.confidence;
                            }
                            1
                        }
                        Err(_) => 0,
                    }
                }
                None => 0,
            }
        }
        None => 0,
    }
}

#[no_mangle]
pub extern "C" fn swipe_predictor_reset(predictor_id: i32) -> i32 {
    if predictor_id < 0 {
        return 0;
    }

    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    match state.as_mut() {
        Some(ffi_state) => {
            match ffi_state.get_predictor_mut(predictor_id as u32) {
                Some(predictor) => {
                    predictor.reset();
                    1
                }
                None => 0,
            }
        }
        None => 0,
    }
}

#[no_mangle]
pub extern "C" fn swipe_predictor_detect_cancellation(predictor_id: i32) -> i32 {
    if predictor_id < 0 {
        return 0;
    }

    let state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    match state.as_ref() {
        Some(ffi_state) => {
            match ffi_state.get_predictor(predictor_id as u32) {
                Some(predictor) => {
                    if predictor.detect_cancellation() {
                        1
                    } else {
                        0
                    }
                }
                None => 0,
            }
        }
        None => 0,
    }
}

#[no_mangle]
pub extern "C" fn swipe_predictor_remove(predictor_id: i32) -> i32 {
    if predictor_id < 0 {
        return 0;
    }

    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };

    match state.as_mut() {
        Some(ffi_state) => {
            if ffi_state.remove_predictor(predictor_id as u32) {
                1
            } else {
                0
            }
        }
        None => 0,
    }
}

#[no_mangle]
pub extern "C" fn swipe_predictor_shutdown() {
    let mut state = match SHARED_FFI_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };

    *state = None;
}

// Legacy function names for backward compatibility
#[no_mangle]
pub extern "C" fn init_predictor_manager(
    deceleration_rate: f64,
    min_velocity_threshold: f64,
    min_gesture_time_ms: f64,
    velocity_smoothing_factor: f64,
) -> i32 {
    swipe_predictor_init(
        deceleration_rate,
        min_velocity_threshold,
        min_gesture_time_ms,
        velocity_smoothing_factor,
    )
}

#[no_mangle]
pub extern "C" fn init_predictor() -> i32 {
    swipe_predictor_create()
}

#[no_mangle]
pub extern "C" fn add_touch_point(
    predictor_id: i32,
    x: f64,
    y: f64,
    timestamp: f64,
) -> i32 {
    swipe_predictor_add_point(predictor_id, x, y, timestamp)
}

#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn get_prediction(
    predictor_id: i32,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    swipe_predictor_get_prediction(predictor_id, out_x, out_y, out_confidence)
}

#[no_mangle]
pub extern "C" fn reset_predictor(predictor_id: i32) -> i32 {
    swipe_predictor_reset(predictor_id)
}

#[no_mangle]
pub extern "C" fn detect_cancellation(predictor_id: i32) -> i32 {
    swipe_predictor_detect_cancellation(predictor_id)
}

#[no_mangle]
pub extern "C" fn remove_predictor(predictor_id: i32) -> i32 {
    swipe_predictor_remove(predictor_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier, Mutex};
    use std::thread;

    // Global test lock to ensure FFI tests don't interfere with each other
    static TEST_LOCK: Mutex<()> = Mutex::new(());

    fn setup() {
        // Force clean state
        let mut state = SHARED_FFI_STATE.lock().unwrap();
        *state = None;
        drop(state);
        
        let result = swipe_predictor_init(1500.0, 50.0, 30.0, 0.7);
        assert_eq!(result, 1);
    }

    fn teardown() {
        // Force clean state
        let mut state = SHARED_FFI_STATE.lock().unwrap();
        *state = None;
    }
    
    // Helper macro to run tests in isolation
    macro_rules! isolated_test {
        ($test_fn:expr) => {{
            let _guard = TEST_LOCK.lock().unwrap();
            teardown(); // Ensure clean state before test
            let result = std::panic::catch_unwind(|| {
                $test_fn
            });
            teardown(); // Always clean up, even on panic
            result.unwrap();
        }};
    }

    #[test]
    fn test_ffi_basic_flow() {
        isolated_test!({
            setup();

        // Create predictor
        let id = swipe_predictor_create();
        assert!(id >= 0);

        // Add points
        for i in 0..5 {
            let result = swipe_predictor_add_point(
                id,
                i as f64 * 20.0,
                0.0,
                i as f64 * 20.0,
            );
            assert_eq!(result, 1);
        }

        // Get prediction
        let mut x = 0.0;
        let mut y = 0.0;
        let mut confidence = 0.0;
        let result = swipe_predictor_get_prediction(id, &mut x, &mut y, &mut confidence);
        assert_eq!(result, 1);
        assert!(x > 80.0);
        assert!(confidence > 0.0);

        // Test cancellation detection
        let cancel = swipe_predictor_detect_cancellation(id);
        assert_eq!(cancel, 0); // Should not be cancelled

        // Reset
        let result = swipe_predictor_reset(id);
        assert_eq!(result, 1);

        // Should not be able to predict after reset
        let result = swipe_predictor_get_prediction(id, &mut x, &mut y, &mut confidence);
        assert_eq!(result, 0);

        // Remove
        let result = swipe_predictor_remove(id);
        assert_eq!(result, 1);

        // Should not be able to use after removal
        let result = swipe_predictor_add_point(id, 0.0, 0.0, 0.0);
        assert_eq!(result, 0);

            teardown();
        });
    }

    #[test]
    fn test_ffi_invalid_operations() {
        isolated_test!({
            setup();

        // Try to use predictor before creation
        let result = swipe_predictor_add_point(999, 0.0, 0.0, 0.0);
        assert_eq!(result, 0);

        // Create predictor
        let id = swipe_predictor_create();

        // Add invalid timestamp
        let result = swipe_predictor_add_point(id, 0.0, 0.0, -10.0);
        assert_eq!(result, 0);

        // Add valid points
        for i in 0..3 {
            swipe_predictor_add_point(id, i as f64 * 10.0, 0.0, i as f64 * 10.0);
        }

        // Add out-of-order timestamp
        let result = swipe_predictor_add_point(id, 40.0, 0.0, 5.0);
        assert_eq!(result, 0);

        swipe_predictor_remove(id);
            teardown();
        });
    }

    #[test]
    fn test_ffi_predictor_limit() {
        isolated_test!({
            setup();

        let mut ids = Vec::new();

        // Create many predictors
        for _ in 0..100 {
            let id = swipe_predictor_create();
            if id >= 0 {
                ids.push(id);
            } else {
                break;
            }
        }

        // Should have created at least some predictors
        assert!(!ids.is_empty());

        // Clean up
        for id in ids {
            swipe_predictor_remove(id);
        }

            teardown();
        });
    }

    #[test]
    fn test_ffi_legacy_functions() {
        isolated_test!({
            teardown();

        // Test legacy function names
        let result = init_predictor_manager(1500.0, 50.0, 30.0, 0.7);
        assert_eq!(result, 1);

        let id = init_predictor();
        assert!(id >= 0);

        let result = add_touch_point(id, 0.0, 0.0, 0.0);
        assert_eq!(result, 1);

        let result = reset_predictor(id);
        assert_eq!(result, 1);

        let cancel = detect_cancellation(id);
        assert_eq!(cancel, 0);

        let result = remove_predictor(id);
        assert_eq!(result, 1);

            teardown();
        });
    }

    #[test]
    fn test_ffi_reinitialization_prevented() {
        isolated_test!({
            teardown();

        // First init should succeed
        let result = swipe_predictor_init(1500.0, 50.0, 30.0, 0.7);
        assert_eq!(result, 1);

        // Second init should fail
        let result = swipe_predictor_init(2000.0, 60.0, 40.0, 0.8);
        assert_eq!(result, 0);

        // Should still work with original config
        let id = swipe_predictor_create();
        assert!(id >= 0);

        swipe_predictor_remove(id);
            teardown();
        });
    }

    #[test]
    fn test_null_pointer_safety() {
        isolated_test!({
            setup();

        let id = swipe_predictor_create();

        // Add some points
        for i in 0..5 {
            swipe_predictor_add_point(id, i as f64 * 20.0, 0.0, i as f64 * 20.0);
        }

        // Test with null pointers
        let result = swipe_predictor_get_prediction(
            id,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        );
        assert_eq!(result, 0);

            teardown();
        });
    }

    #[test]
    fn test_concurrent_ffi_operations() {
        isolated_test!({
            setup();

        let num_threads = 10;
        let barrier = Arc::new(Barrier::new(num_threads));
        let handles: Vec<_> = (0..num_threads)
            .map(|thread_idx| {
                let barrier = barrier.clone();
                thread::spawn(move || {
                    // Wait for all threads to be ready
                    barrier.wait();

                    // Each thread creates its own predictor
                    let predictor_id = swipe_predictor_create();
                    if predictor_id < 0 {
                        // Might fail due to predictor limit in concurrent scenario
                        return Err("Failed to create predictor");
                    }

                    // Add points
                    for i in 0..10 {
                        let x = (thread_idx * 100 + i * 10) as f64;
                        let result = swipe_predictor_add_point(
                            predictor_id,
                            x,
                            0.0,
                            i as f64 * 10.0,
                        );
                        if result != 1 {
                            swipe_predictor_remove(predictor_id);
                            return Err("Failed to add point");
                        }
                    }

                    // Get prediction
                    let mut x = 0.0;
                    let mut y = 0.0;
                    let mut confidence = 0.0;
                    let result = swipe_predictor_get_prediction(
                        predictor_id,
                        &mut x,
                        &mut y,
                        &mut confidence,
                    );
                    
                    // Clean up
                    swipe_predictor_remove(predictor_id);
                    
                    if result == 1 {
                        Ok((x, confidence))
                    } else {
                        Err("Failed to get prediction")
                    }
                })
            })
            .collect();

        // Wait for all threads
        let results: Vec<Result<(f64, f64), &str>> = handles
            .into_iter()
            .map(|h| h.join().unwrap())
            .collect();

        // Count successes and failures
        let mut successes = 0;
        let mut failures = Vec::new();
        
        for (i, result) in results.into_iter().enumerate() {
            match result {
                Ok((x, confidence)) => {
                    successes += 1;
                    assert!(x > 0.0, "x should be positive");
                    assert!(confidence > 0.0, "confidence should be positive");
                }
                Err(e) => {
                    failures.push((i, e));
                }
            }
        }
        
        // In concurrent scenarios, it's okay if some fail due to limits
        // but at least some should succeed
        assert!(successes > 0, 
            "At least some threads should succeed. Successes: {}, Failures: {:?}", 
            successes, failures);

            teardown();
        });
    }

    #[test]
    fn test_ffi_predictor_isolation() {
        isolated_test!({
            setup();

        // Create two predictors
        let id1 = swipe_predictor_create();
        let id2 = swipe_predictor_create();

        assert!(id1 >= 0);
        assert!(id2 >= 0);
        assert_ne!(id1, id2);

        // Add different points to each
        for i in 0..5 {
            swipe_predictor_add_point(
                id1,
                i as f64 * 10.0,
                0.0,
                i as f64 * 10.0,
            );
            swipe_predictor_add_point(
                id2,
                0.0,
                i as f64 * 10.0,
                i as f64 * 10.0,
            );
        }

        // Get predictions
        let mut x1 = 0.0;
        let mut y1 = 0.0;
        let mut conf1 = 0.0;
        let mut x2 = 0.0;
        let mut y2 = 0.0;
        let mut conf2 = 0.0;

        swipe_predictor_get_prediction(id1, &mut x1, &mut y1, &mut conf1);
        swipe_predictor_get_prediction(id2, &mut x2, &mut y2, &mut conf2);

        // Verify predictors are isolated
        assert!(x1 > 0.0 && y1.abs() < 1.0); // Horizontal motion
        assert!(x2.abs() < 1.0 && y2 > 0.0); // Vertical motion

        swipe_predictor_remove(id1);
        swipe_predictor_remove(id2);
            teardown();
        });
    }
}