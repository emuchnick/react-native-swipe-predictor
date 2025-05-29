use jni::JNIEnv;
use jni::objects::{JClass, JObject};
use jni::sys::{jdouble, jint};

use crate::ffi;

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
    
    let result = ffi::swipe_predictor_init(
        deceleration_rate as f64,
        min_velocity_threshold as f64,
        min_gesture_time_ms as f64,
        velocity_smoothing_factor as f64,
    );
    
    if result == 0 {
        let _ = env.throw_new(
            "java/lang/IllegalStateException",
            "Failed to initialize SwipePredictor. It may already be initialized or parameters are invalid."
        );
    }
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitPredictor(
    env: JNIEnv,
    _class: JClass,
) -> jint {
    let result = ffi::swipe_predictor_create();
    if result == -1 {
        let _ = env.throw_new(
            "java/lang/IllegalStateException",
            "SwipePredictor not initialized. Call nativeInitManager first."
        );
    }
    result
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
    
    // Don't throw on failure for backward compatibility
    let _ = ffi::swipe_predictor_add_point(predictor_id, x as f64, y as f64, timestamp as f64);
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
    
    let result = ffi::swipe_predictor_get_prediction(
        predictor_id, 
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
    let _ = ffi::swipe_predictor_reset(predictor_id);
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeDetectCancellation(
    _env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) -> jint {
    ffi::swipe_predictor_detect_cancellation(predictor_id)
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeRemovePredictor(
    _env: JNIEnv,
    _class: JClass,
    predictor_id: jint,
) {
    let _ = ffi::swipe_predictor_remove(predictor_id);
}

#[no_mangle]
pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeShutdown(
    _env: JNIEnv,
    _class: JClass,
) {
    ffi::swipe_predictor_shutdown();
}