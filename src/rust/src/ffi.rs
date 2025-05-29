use std::collections::HashMap;

use crate::physics::PhysicsConfig;
use crate::predictor::GesturePredictor;

const MAX_PREDICTORS: usize = 10000;

/// Opaque handle type for FFI context
#[repr(C)]
pub struct SwipePredictorContext {
    _private: [u8; 0],
}

/// Opaque handle type for individual predictor
#[repr(C)]
pub struct SwipePredictorHandle {
    _private: [u8; 0],
}

/// Internal state for a predictor context
struct PredictorContext {
    predictors: HashMap<u32, GesturePredictor>,
    next_id: u32,
    physics_config: PhysicsConfig,
}

impl PredictorContext {
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

/// Combined handle that stores both context and predictor ID
struct PredictorHandle {
    context: *mut PredictorContext,
    predictor_id: u32,
}

/// Create a new swipe predictor context with the given physics configuration
#[no_mangle]
pub extern "C" fn swipe_predictor_context_create(
    deceleration_rate: f64,
    min_velocity_threshold: f64,
    min_gesture_time_ms: f64,
) -> *mut SwipePredictorContext {
    let physics_config = PhysicsConfig {
        deceleration_rate,
        min_velocity_threshold,
        min_gesture_time_ms,
    };

    // Validate config
    if physics_config.validate().is_err() {
        return std::ptr::null_mut();
    }

    let context = Box::new(PredictorContext::new(physics_config));
    Box::into_raw(context) as *mut SwipePredictorContext
}

/// Create a new swipe predictor context with default physics configuration
#[no_mangle]
pub extern "C" fn swipe_predictor_context_create_default() -> *mut SwipePredictorContext {
    let context = Box::new(PredictorContext::new(PhysicsConfig::default()));
    Box::into_raw(context) as *mut SwipePredictorContext
}

/// Free a swipe predictor context and all its predictors
#[no_mangle]
pub extern "C" fn swipe_predictor_context_destroy(ctx: *mut SwipePredictorContext) {
    if ctx.is_null() {
        return;
    }

    // SAFETY: We created this pointer with Box::into_raw, and we're taking ownership back
    unsafe {
        let _ = Box::from_raw(ctx as *mut PredictorContext);
    }
}

/// Create a new predictor within the context
#[no_mangle]
pub extern "C" fn swipe_predictor_create_in_context(
    ctx: *mut SwipePredictorContext,
) -> *mut SwipePredictorHandle {
    if ctx.is_null() {
        return std::ptr::null_mut();
    }

    // SAFETY: We trust the caller to pass a valid context pointer
    let context = unsafe { &mut *(ctx as *mut PredictorContext) };

    match context.create_predictor() {
        Some(predictor_id) => {
            let handle = Box::new(PredictorHandle {
                context: context as *mut PredictorContext,
                predictor_id,
            });
            Box::into_raw(handle) as *mut SwipePredictorHandle
        }
        None => std::ptr::null_mut(),
    }
}

/// Free a predictor handle
#[no_mangle]
pub extern "C" fn swipe_predictor_destroy(handle: *mut SwipePredictorHandle) {
    if handle.is_null() {
        return;
    }

    // SAFETY: We created this pointer with Box::into_raw
    let handle = unsafe { Box::from_raw(handle as *mut PredictorHandle) };

    // Remove the predictor from the context
    // SAFETY: The context pointer came from a valid context that should still be alive
    let context = unsafe { &mut *handle.context };
    context.remove_predictor(handle.predictor_id);
}

/// Add a touch point to the predictor
#[no_mangle]
pub extern "C" fn swipe_predictor_add_point(
    handle: *mut SwipePredictorHandle,
    x: f64,
    y: f64,
    timestamp: f64,
) -> i32 {
    if handle.is_null() {
        return 0;
    }

    // SAFETY: We trust the caller to pass a valid handle
    let handle = unsafe { &*(handle as *const PredictorHandle) };
    
    // SAFETY: The context pointer should be valid as long as the handle is valid
    let context = unsafe { &mut *handle.context };

    match context.get_predictor_mut(handle.predictor_id) {
        Some(predictor) => match predictor.add_touch_point(x, y, timestamp) {
            Ok(_) => 1,
            Err(_) => 0,
        },
        None => 0,
    }
}

/// Get prediction from the predictor
#[no_mangle]
#[allow(clippy::not_unsafe_ptr_arg_deref)]
pub extern "C" fn swipe_predictor_get_prediction(
    handle: *mut SwipePredictorHandle,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    if handle.is_null() || out_x.is_null() || out_y.is_null() || out_confidence.is_null() {
        return 0;
    }

    // SAFETY: We trust the caller to pass a valid handle
    let handle = unsafe { &*(handle as *const PredictorHandle) };
    
    // SAFETY: The context pointer should be valid as long as the handle is valid
    let context = unsafe { &*handle.context };

    match context.get_predictor(handle.predictor_id) {
        Some(predictor) => match predictor.predict() {
            Ok(prediction) => {
                // SAFETY: We checked that pointers are not null at the beginning
                unsafe {
                    *out_x = prediction.position.x;
                    *out_y = prediction.position.y;
                    *out_confidence = prediction.confidence;
                }
                1
            }
            Err(_) => 0,
        },
        None => 0,
    }
}

/// Reset the predictor
#[no_mangle]
pub extern "C" fn swipe_predictor_reset(handle: *mut SwipePredictorHandle) -> i32 {
    if handle.is_null() {
        return 0;
    }

    // SAFETY: We trust the caller to pass a valid handle
    let handle = unsafe { &*(handle as *const PredictorHandle) };
    
    // SAFETY: The context pointer should be valid as long as the handle is valid
    let context = unsafe { &mut *handle.context };

    match context.get_predictor_mut(handle.predictor_id) {
        Some(predictor) => {
            predictor.reset();
            1
        }
        None => 0,
    }
}

/// Detect if the gesture appears to be cancelled
#[no_mangle]
pub extern "C" fn swipe_predictor_detect_cancellation(handle: *mut SwipePredictorHandle) -> i32 {
    if handle.is_null() {
        return 0;
    }

    // SAFETY: We trust the caller to pass a valid handle
    let handle = unsafe { &*(handle as *const PredictorHandle) };
    
    // SAFETY: The context pointer should be valid as long as the handle is valid
    let context = unsafe { &*handle.context };

    match context.get_predictor(handle.predictor_id) {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_lifecycle() {
        // Create context
        let ctx = swipe_predictor_context_create_default();
        assert!(!ctx.is_null());

        // Create predictor
        let handle = swipe_predictor_create_in_context(ctx);
        assert!(!handle.is_null());

        // Use predictor
        for i in 0..5 {
            let result = swipe_predictor_add_point(
                handle,
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
        let result = swipe_predictor_get_prediction(handle, &mut x, &mut y, &mut confidence);
        assert_eq!(result, 1);
        assert!(x > 80.0);
        assert!(confidence > 0.0);

        // Clean up
        swipe_predictor_destroy(handle);
        swipe_predictor_context_destroy(ctx);
    }

    #[test]
    fn test_multiple_predictors_in_context() {
        let ctx = swipe_predictor_context_create_default();

        // Create multiple predictors
        let h1 = swipe_predictor_create_in_context(ctx);
        let h2 = swipe_predictor_create_in_context(ctx);

        assert!(!h1.is_null());
        assert!(!h2.is_null());

        // Use first predictor
        for i in 0..5 {
            swipe_predictor_add_point(h1, i as f64 * 10.0, 0.0, i as f64 * 10.0);
        }

        // Use second predictor
        for i in 0..5 {
            swipe_predictor_add_point(h2, 0.0, i as f64 * 10.0, i as f64 * 10.0);
        }

        // Get predictions
        let mut x1 = 0.0;
        let mut y1 = 0.0;
        let mut conf1 = 0.0;
        let mut x2 = 0.0;
        let mut y2 = 0.0;
        let mut conf2 = 0.0;

        swipe_predictor_get_prediction(h1, &mut x1, &mut y1, &mut conf1);
        swipe_predictor_get_prediction(h2, &mut x2, &mut y2, &mut conf2);

        // Verify predictors are isolated
        assert!(x1 > 0.0 && y1.abs() < 1.0); // Horizontal motion
        assert!(x2.abs() < 1.0 && y2 > 0.0); // Vertical motion

        // Clean up
        swipe_predictor_destroy(h1);
        swipe_predictor_destroy(h2);
        swipe_predictor_context_destroy(ctx);
    }

    #[test]
    fn test_null_safety() {
        // Operations on null should not crash
        swipe_predictor_context_destroy(std::ptr::null_mut());
        swipe_predictor_destroy(std::ptr::null_mut());

        let result = swipe_predictor_add_point(std::ptr::null_mut(), 0.0, 0.0, 0.0);
        assert_eq!(result, 0);

        let result = swipe_predictor_reset(std::ptr::null_mut());
        assert_eq!(result, 0);

        let result = swipe_predictor_detect_cancellation(std::ptr::null_mut());
        assert_eq!(result, 0);

        let mut x = 0.0;
        let mut y = 0.0;
        let mut conf = 0.0;
        let result = swipe_predictor_get_prediction(
            std::ptr::null_mut(),
            &mut x,
            &mut y,
            &mut conf,
        );
        assert_eq!(result, 0);
    }

    #[test]
    fn test_invalid_physics_config() {
        let ctx = swipe_predictor_context_create(-1.0, -1.0, -1.0);
        assert!(ctx.is_null());
    }

    #[test]
    fn test_concurrent_usage() {
        use std::thread;

        let ctx = swipe_predictor_context_create_default();
        
        // Note: In a real handle-based FFI, the context would need internal
        // synchronization (Mutex) to be used concurrently. This test shows
        // that each thread can have its own predictor.
        
        let handles: Vec<_> = (0..10)
            .map(|_| {
                thread::spawn(move || {
                    // Each thread creates its own context
                    let thread_ctx = swipe_predictor_context_create_default();
                    let handle = swipe_predictor_create_in_context(thread_ctx);
                    
                    // Use predictor
                    for i in 0..10 {
                        swipe_predictor_add_point(
                            handle,
                            i as f64 * 20.0,
                            i as f64 * 10.0,
                            i as f64 * 20.0,
                        );
                    }
                    
                    let mut x = 0.0;
                    let mut y = 0.0;
                    let mut conf = 0.0;
                    let result = swipe_predictor_get_prediction(handle, &mut x, &mut y, &mut conf);
                    
                    // Clean up
                    swipe_predictor_destroy(handle);
                    swipe_predictor_context_destroy(thread_ctx);
                    
                    (result, x, y, conf)
                })
            })
            .collect();

        let results: Vec<(i32, f64, f64, f64)> = handles
            .into_iter()
            .map(|h| h.join().unwrap())
            .collect();

        // All predictions should be valid
        for (result, x, y, conf) in results {
            assert_eq!(result, 1);
            assert!(x > 0.0);
            assert!(y > 0.0);
            assert!(conf > 0.0);
        }

        swipe_predictor_context_destroy(ctx);
    }

    #[test]
    fn test_reset_functionality() {
        let ctx = swipe_predictor_context_create_default();
        let handle = swipe_predictor_create_in_context(ctx);

        // Add points
        for i in 0..5 {
            swipe_predictor_add_point(handle, i as f64 * 20.0, 0.0, i as f64 * 20.0);
        }

        // Get prediction
        let mut x = 0.0;
        let mut y = 0.0;
        let mut conf = 0.0;
        let result = swipe_predictor_get_prediction(handle, &mut x, &mut y, &mut conf);
        assert_eq!(result, 1);

        // Reset
        let result = swipe_predictor_reset(handle);
        assert_eq!(result, 1);

        // Should not be able to predict after reset
        let result = swipe_predictor_get_prediction(handle, &mut x, &mut y, &mut conf);
        assert_eq!(result, 0);

        // Clean up
        swipe_predictor_destroy(handle);
        swipe_predictor_context_destroy(ctx);
    }

    #[test]
    fn test_cancellation_detection() {
        let ctx = swipe_predictor_context_create_default();
        let handle = swipe_predictor_create_in_context(ctx);

        // Moving forward
        swipe_predictor_add_point(handle, 0.0, 0.0, 0.0);
        swipe_predictor_add_point(handle, 10.0, 0.0, 10.0);
        swipe_predictor_add_point(handle, 20.0, 0.0, 20.0);

        let cancel = swipe_predictor_detect_cancellation(handle);
        assert_eq!(cancel, 0); // Should not be cancelled

        // Reverse direction
        swipe_predictor_add_point(handle, 15.0, 0.0, 30.0);

        let cancel = swipe_predictor_detect_cancellation(handle);
        assert_eq!(cancel, 1); // Should be cancelled

        // Clean up
        swipe_predictor_destroy(handle);
        swipe_predictor_context_destroy(ctx);
    }
}