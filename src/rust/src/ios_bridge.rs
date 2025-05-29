// iOS Bridge - Maps legacy function names to new context-based API
use crate::ffi::{SwipePredictorContext, SwipePredictorHandle};
use std::collections::HashMap;
use std::sync::Mutex;

// Wrapper to make the raw pointer Send + Sync
struct ContextPtr(*mut SwipePredictorContext);
unsafe impl Send for ContextPtr {}
unsafe impl Sync for ContextPtr {}

// Wrapper for handle pointers to make them Send + Sync
struct HandlePtr(*mut SwipePredictorHandle);
unsafe impl Send for HandlePtr {}
unsafe impl Sync for HandlePtr {}

// Handle storage to map i32 IDs to actual pointers
struct HandleStorage {
    context: Option<ContextPtr>,
    handles: HashMap<i32, HandlePtr>,
    next_id: i32,
}

impl HandleStorage {
    fn new() -> Self {
        Self {
            context: None,
            handles: HashMap::new(),
            next_id: 1, // Start from 1 so 0/-1 can indicate errors
        }
    }
}

// Use once_cell for lazy initialization
use std::sync::OnceLock;

static IOS_STORAGE: OnceLock<Mutex<HandleStorage>> = OnceLock::new();

fn get_storage() -> &'static Mutex<HandleStorage> {
    IOS_STORAGE.get_or_init(|| Mutex::new(HandleStorage::new()))
}

/// Initialize the predictor manager with physics config (legacy API)
#[no_mangle]
pub extern "C" fn init_predictor_manager(
    deceleration_rate: f64,
    min_velocity_threshold: f64,
    min_gesture_time_ms: f64,
    _velocity_smoothing_factor: f64, // Unused in new API
) {
    if let Ok(mut storage) = get_storage().lock() {
        // Clean up existing context and handles
        if let Some(ctx_wrapper) = storage.context.take() {
            // Destroy all existing handles first
            for (_, handle_ptr) in storage.handles.drain() {
                crate::ffi::swipe_predictor_destroy(handle_ptr.0);
            }
            crate::ffi::swipe_predictor_context_destroy(ctx_wrapper.0);
        }
        
        // Create new context
        let new_ctx = crate::ffi::swipe_predictor_context_create(
            deceleration_rate,
            min_velocity_threshold,
            min_gesture_time_ms,
        );
        
        if !new_ctx.is_null() {
            storage.context = Some(ContextPtr(new_ctx));
            storage.next_id = 1; // Reset ID counter
        }
    }
}

/// Initialize a new predictor (legacy API)
#[no_mangle]
pub extern "C" fn init_predictor() -> i32 {
    if let Ok(mut storage) = get_storage().lock() {
        if let Some(ref ctx_wrapper) = storage.context {
            let handle = crate::ffi::swipe_predictor_create_in_context(ctx_wrapper.0);
            if !handle.is_null() {
                let id = storage.next_id;
                storage.next_id = storage.next_id.wrapping_add(1);
                storage.handles.insert(id, HandlePtr(handle));
                return id;
            }
        }
    }
    -1
}

/// Add a touch point (legacy API)
#[no_mangle]
pub extern "C" fn add_touch_point(predictor_id: i32, x: f64, y: f64, timestamp: f64) -> i32 {
    if let Ok(storage) = get_storage().lock() {
        if let Some(handle_ptr) = storage.handles.get(&predictor_id) {
            return crate::ffi::swipe_predictor_add_point(handle_ptr.0, x, y, timestamp);
        }
    }
    0
}

/// Get prediction (legacy API)
#[no_mangle]
pub extern "C" fn get_prediction(
    predictor_id: i32,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    if let Ok(storage) = get_storage().lock() {
        if let Some(handle_ptr) = storage.handles.get(&predictor_id) {
            return crate::ffi::swipe_predictor_get_prediction(handle_ptr.0, out_x, out_y, out_confidence);
        }
    }
    0
}

/// Reset predictor (legacy API)
#[no_mangle]
pub extern "C" fn reset_predictor(predictor_id: i32) -> i32 {
    if let Ok(storage) = get_storage().lock() {
        if let Some(handle_ptr) = storage.handles.get(&predictor_id) {
            return crate::ffi::swipe_predictor_reset(handle_ptr.0);
        }
    }
    0
}

/// Detect cancellation (legacy API)
#[no_mangle]
pub extern "C" fn detect_cancellation(predictor_id: i32) -> i32 {
    if let Ok(storage) = get_storage().lock() {
        if let Some(handle_ptr) = storage.handles.get(&predictor_id) {
            return crate::ffi::swipe_predictor_detect_cancellation(handle_ptr.0);
        }
    }
    0
}

/// Remove predictor (legacy API)
#[no_mangle]
pub extern "C" fn remove_predictor(predictor_id: i32) -> i32 {
    if let Ok(mut storage) = get_storage().lock() {
        if let Some(handle_ptr) = storage.handles.remove(&predictor_id) {
            crate::ffi::swipe_predictor_destroy(handle_ptr.0);
            return 1;
        }
    }
    0
}

/// Cleanup function for iOS (call this when the library is unloaded)
#[no_mangle]
pub extern "C" fn cleanup_ios_bridge() {
    if let Ok(mut storage) = get_storage().lock() {
        // Destroy all handles
        for (_, handle_ptr) in storage.handles.drain() {
            crate::ffi::swipe_predictor_destroy(handle_ptr.0);
        }
        
        // Destroy context
        if let Some(ctx_wrapper) = storage.context.take() {
            crate::ffi::swipe_predictor_context_destroy(ctx_wrapper.0);
        }
    }
}