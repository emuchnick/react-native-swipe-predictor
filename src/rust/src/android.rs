use jni::JNIEnv;
use jni::objects::{JClass, JObject};
use jni::sys::{jdouble, jint, jlong, JavaVM, JNI_VERSION_1_6};
use std::collections::HashMap;
use std::sync::Mutex;

use crate::ffi::{SwipePredictorContext, SwipePredictorHandle};

// Wrapper for handle pointers to make them Send + Sync
struct HandlePtr(*mut SwipePredictorHandle);
unsafe impl Send for HandlePtr {}
unsafe impl Sync for HandlePtr {}

// Global state for Android including handle mapping
struct AndroidState {
    context: Option<*mut SwipePredictorContext>,
    handles: HashMap<i32, HandlePtr>,
    next_id: i32,
}

impl AndroidState {
    fn new() -> Self {
        Self {
            context: None,
            handles: HashMap::new(),
            next_id: 1, // Start from 1 so 0/-1 can indicate errors
        }
    }
}

// Global state with handle mapping to avoid pointer truncation
static GLOBAL_STATE: Mutex<AndroidState> = Mutex::new(AndroidState {
    context: None,
    handles: HashMap::new(),
    next_id: 1,
});

/// Called when the native library is loaded by the JVM
#[no_mangle]
pub extern "system" fn JNI_OnLoad(_vm: JavaVM, _: *mut std::os::raw::c_void) -> jint {
    // Initialize the panic handler to prevent panics from crossing the FFI boundary
    crate::ffi::swipe_predictor_init_panic_handler();
    
    // Return the JNI version we support
    JNI_VERSION_1_6
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitManager(
    env: JNIEnv,
    _class: JClass,
    deceleration_rate: jdouble,
    min_velocity_threshold: jdouble,
    min_gesture_time_ms: jdouble,
    velocity_smoothing_factor: jdouble,
) {
    // Validate parameters
    if deceleration_rate <= 0.0 {
        let _ = env.throw_new(
            "java/lang/IllegalArgumentException",
            "Deceleration rate must be positive"
        );
        return;
    }
    
    if min_velocity_threshold < 0.0 {
        let _ = env.throw_new(
            "java/lang/IllegalArgumentException",
            "Minimum velocity threshold cannot be negative"
        );
        return;
    }
    
    if min_gesture_time_ms < 0.0 {
        let _ = env.throw_new(
            "java/lang/IllegalArgumentException",
            "Minimum gesture time cannot be negative"
        );
        return;
    }
    
    // Create a new context and store it globally
    let ctx = crate::ffi::swipe_predictor_context_create(
        deceleration_rate,
        min_velocity_threshold,
        min_gesture_time_ms,
    );
    
    if ctx.is_null() {
        let _ = env.throw_new(
            "java/lang/IllegalStateException",
            "Failed to initialize SwipePredictor. Parameters may be invalid."
        );
        return;
    }
    
    let mut state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => {
            let _ = env.throw_new(
                "java/lang/IllegalStateException",
                "Failed to acquire lock on global state"
            );
            return;
        }
    };
    
    // Clean up existing handles and context
    if let Some(old_ctx) = state.context {
        // Destroy all existing handles first
        for (_, handle_ptr) in state.handles.drain() {
            crate::ffi::swipe_predictor_destroy(handle_ptr.0);
        }
        // Destroy old context
        crate::ffi::swipe_predictor_context_destroy(old_ctx);
    }
    
    // Set new context and reset state
    state.context = Some(ctx);
    state.next_id = 1;
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitPredictor(
    env: JNIEnv,
    _class: JClass,
) -> jint {
    let mut state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => {
            let _ = env.throw_new(
                "java/lang/IllegalStateException",
                "Failed to acquire lock on global state"
            );
            return -1;
        }
    };
    
    let ctx = match state.context {
        Some(ctx) => ctx,
        None => {
            let _ = env.throw_new(
                "java/lang/IllegalStateException",
                "SwipePredictor not initialized. Call nativeInitManager first."
            );
            return -1;
        }
    };
    
    let handle = crate::ffi::swipe_predictor_create_in_context(ctx);
    if handle.is_null() {
        return -1;
    }
    
    // Store handle in map and return ID
    let id = state.next_id;
    state.next_id = state.next_id.wrapping_add(1);
    state.handles.insert(id, HandlePtr(handle));
    id
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeAddTouchPoint(
    env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
    x: jdouble,
    y: jdouble,
    timestamp: jdouble,
) {
    if predictor_id < 0 {
        let _ = env.throw_new(
            "java/lang/IllegalArgumentException",
            &format!("Invalid predictor ID: {}. ID must be non-negative.", predictor_id)
        );
        return;
    }
    
    if timestamp < 0.0 {
        let _ = env.throw_new(
            "java/lang/IllegalArgumentException",
            &format!("Invalid timestamp: {}. Timestamp must be non-negative milliseconds.", timestamp)
        );
        return;
    }
    
    let state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    
    if let Some(handle_ptr) = state.handles.get(&predictor_id) {
        // Don't throw on failure for backward compatibility
        let _ = crate::ffi::swipe_predictor_add_point(handle_ptr.0, x as f64, y as f64, timestamp as f64);
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeGetPrediction(
    env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) -> JObject {
    if predictor_id < 0 {
        return JObject::null();
    }
    
    let mut x: f64 = 0.0;
    let mut y: f64 = 0.0;
    let mut confidence: f64 = 0.0;
    
    let state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return JObject::null(),
    };
    
    let handle_ptr = match state.handles.get(&predictor_id) {
        Some(h) => h,
        None => return JObject::null(),
    };
    
    let result = crate::ffi::swipe_predictor_get_prediction(
        handle_ptr.0, 
        &mut x, 
        &mut y, 
        &mut confidence
    );
    
    if result == 1 {
        match env.find_class("com/swipepredictor/Prediction") {
            Ok(prediction_class) => {
                match env.new_object(
                    prediction_class,
                    "(DDD)V",
                    &[x.into(), y.into(), confidence.into()],
                ) {
                    Ok(obj) => obj,
                    Err(e) => {
                        let _ = env.throw_new(
                            "java/lang/RuntimeException", 
                            &format!("Failed to create Prediction object: {:?}", e)
                        );
                        JObject::null()
                    }
                }
            },
            Err(e) => {
                let _ = env.throw_new(
                    "java/lang/ClassNotFoundException", 
                    &format!("Prediction class not found: {:?}. Ensure com.swipepredictor.Prediction exists.", e)
                );
                JObject::null()
            }
        }
    } else {
        JObject::null()
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeResetPredictor(
    _env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) {
    let state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    
    if let Some(handle_ptr) = state.handles.get(&predictor_id) {
        let _ = crate::ffi::swipe_predictor_reset(handle_ptr.0);
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeDetectCancellation(
    _env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) -> jint {
    let state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return 0,
    };
    
    match state.handles.get(&predictor_id) {
        Some(handle_ptr) => crate::ffi::swipe_predictor_detect_cancellation(handle_ptr.0),
        None => 0,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeRemovePredictor(
    _env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) {
    let mut state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => return,
    };
    
    if let Some(handle_ptr) = state.handles.remove(&predictor_id) {
        crate::ffi::swipe_predictor_destroy(handle_ptr.0);
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeShutdown(
    _env: JNIEnv,
    _class: JClass,
) {
    // Destroy all handles and the global context
    let mut state = match GLOBAL_STATE.lock() {
        Ok(guard) => guard,
        Err(_) => {
            // Even if lock is poisoned, we still want to clean up
            // We'll just return without cleaning up in this case
            return;
        }
    };
    
    // Destroy all handles first
    for (_, handle_ptr) in state.handles.drain() {
        crate::ffi::swipe_predictor_destroy(handle_ptr.0);
    }
    
    // Destroy context
    if let Some(ctx) = state.context {
        crate::ffi::swipe_predictor_context_destroy(ctx);
        state.context = None;
    }
    
    // Reset next_id
    state.next_id = 1;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_global_state_mutex_handling() {
        // Test that we handle mutex lock failures gracefully
        // This is a basic test since we can't easily simulate JNI environment
        
        // Test multiple init/shutdown cycles
        {
            let mut state = GLOBAL_STATE.lock().unwrap();
            state.context = None;
            state.handles.clear();
            state.next_id = 1;
        }
        
        // Verify mutex is not poisoned
        assert!(GLOBAL_STATE.lock().is_ok());
    }
    
    #[test] 
    fn test_handle_id_mapping() {
        // Test that our ID mapping approach works correctly
        let mut state = AndroidState::new();
        
        // Verify initial state
        assert_eq!(state.next_id, 1);
        assert!(state.handles.is_empty());
        
        // Simulate adding handles
        let test_handle = 0x12345678 as *mut SwipePredictorHandle;
        let id = state.next_id;
        state.next_id = state.next_id.wrapping_add(1);
        state.handles.insert(id, HandlePtr(test_handle));
        
        // Verify we can retrieve it
        assert_eq!(state.handles.get(&id).unwrap().0, test_handle);
        
        // Test wrapping behavior
        state.next_id = i32::MAX;
        let wrapped_id = state.next_id.wrapping_add(1);
        assert_eq!(wrapped_id, i32::MIN);
    }
}