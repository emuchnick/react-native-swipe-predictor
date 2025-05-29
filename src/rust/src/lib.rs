use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, RwLock, Mutex};
use std::sync::atomic::{AtomicUsize, Ordering};
use once_cell::sync::Lazy;

#[derive(Debug, Clone, Copy)]
pub struct TouchPoint {
    pub x: f64,
    pub y: f64,
    /// Timestamp in milliseconds
    pub timestamp: f64,
}

#[derive(Debug, Clone, Copy)]
pub struct Prediction {
    pub x: f64,
    pub y: f64,
    pub confidence: f64,
}

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
        PhysicsConfig {
            deceleration_rate: 1500.0,      // pixels/second²
            min_velocity_threshold: 50.0,    // pixels/second
            min_gesture_time_ms: 30.0,       // milliseconds
        }
    }
}

impl PhysicsConfig {
    /// Validate the physics configuration
    pub fn validate(&self) -> Result<(), &'static str> {
        if self.deceleration_rate <= 0.0 {
            return Err("Deceleration rate must be positive");
        }
        if self.min_velocity_threshold < 0.0 {
            return Err("Minimum velocity threshold cannot be negative");
        }
        if self.min_gesture_time_ms < 0.0 {
            return Err("Minimum gesture time cannot be negative");
        }
        Ok(())
    }
}

pub struct GesturePredictor {
    touch_buffer: VecDeque<TouchPoint>,
    buffer_size: usize,
    physics_config: PhysicsConfig,
    gesture_start_time: Option<f64>,
    last_prediction: Option<Prediction>,
}

const MIN_BUFFER_SIZE: usize = 2;
const MAX_BUFFER_SIZE: usize = 100;
const MAX_PREDICTORS: usize = 10000;

impl GesturePredictor {
    pub fn new(physics_config: PhysicsConfig) -> Self {
        Self::with_buffer_size(physics_config, 10)
    }
    
    pub fn with_buffer_size(physics_config: PhysicsConfig, buffer_size: usize) -> Self {
        let buffer_size = buffer_size.clamp(MIN_BUFFER_SIZE, MAX_BUFFER_SIZE);
        GesturePredictor {
            touch_buffer: VecDeque::with_capacity(buffer_size),
            buffer_size,
            physics_config,
            gesture_start_time: None,
            last_prediction: None,
        }
    }

    /// Add a touch point to the gesture buffer
    /// 
    /// # Arguments
    /// * `x` - X coordinate in pixels
    /// * `y` - Y coordinate in pixels
    /// * `timestamp` - Timestamp in milliseconds
    pub fn add_touch_point(&mut self, x: f64, y: f64, timestamp: f64) {
        // Validate timestamp
        if timestamp < 0.0 {
            return; // Silently ignore invalid timestamps
        }
        
        // Check for timestamp going backwards
        if let Some(last) = self.touch_buffer.back() {
            if timestamp < last.timestamp {
                return; // Ignore out-of-order timestamps
            }
        }
        
        if self.gesture_start_time.is_none() {
            self.gesture_start_time = Some(timestamp);
        }

        let touch_point = TouchPoint { x, y, timestamp };
        
        if self.touch_buffer.len() >= self.buffer_size {
            self.touch_buffer.pop_front();
        }
        
        self.touch_buffer.push_back(touch_point);
    }

    pub fn get_prediction(&mut self) -> Option<Prediction> {
        if self.touch_buffer.len() < 2 {
            return None;
        }

        let gesture_duration = if let Some(start) = self.gesture_start_time {
            if let Some(last) = self.touch_buffer.back() {
                last.timestamp - start
            } else {
                0.0
            }
        } else {
            0.0
        };

        if gesture_duration < self.physics_config.min_gesture_time_ms {
            return None;
        }

        let (velocity_x, velocity_y) = self.calculate_weighted_velocity()?;
        let speed = (velocity_x * velocity_x + velocity_y * velocity_y).sqrt();

        if speed < self.physics_config.min_velocity_threshold {
            return None;
        }

        let current_point = self.touch_buffer.back()?;
        let time_to_stop = speed / self.physics_config.deceleration_rate;
        
        // Safe division by avoiding direct division by speed
        let normalized_vx = if speed > f64::EPSILON { velocity_x / speed } else { 0.0 };
        let normalized_vy = if speed > f64::EPSILON { velocity_y / speed } else { 0.0 };
        
        let distance_x = velocity_x * time_to_stop - 0.5 * normalized_vx * self.physics_config.deceleration_rate * time_to_stop * time_to_stop;
        let distance_y = velocity_y * time_to_stop - 0.5 * normalized_vy * self.physics_config.deceleration_rate * time_to_stop * time_to_stop;

        let predicted_x = current_point.x + distance_x;
        let predicted_y = current_point.y + distance_y;

        let confidence = self.calculate_confidence(speed, gesture_duration);

        let prediction = Prediction {
            x: predicted_x,
            y: predicted_y,
            confidence,
        };

        self.last_prediction = Some(prediction);
        Some(prediction)
    }

    fn calculate_weighted_velocity(&self) -> Option<(f64, f64)> {
        if self.touch_buffer.len() < 2 {
            return None;
        }

        let mut total_velocity_x = 0.0;
        let mut total_velocity_y = 0.0;
        let mut total_weight = 0.0;

        let n = self.touch_buffer.len();
        let mut prev_point = self.touch_buffer[0];
        
        for (i, point) in self.touch_buffer.iter().enumerate().skip(1) {
            let dt = point.timestamp - prev_point.timestamp;
            if dt > 0.0 {
                // Convert from pixels/ms to pixels/second
                let vx = (point.x - prev_point.x) / dt * 1000.0;
                let vy = (point.y - prev_point.y) / dt * 1000.0;
                
                let weight = (i as f64 / n as f64).powf(2.0);
                
                total_velocity_x += vx * weight;
                total_velocity_y += vy * weight;
                total_weight += weight;
            }
            prev_point = *point;
        }

        if total_weight > 0.0 {
            Some((total_velocity_x / total_weight, total_velocity_y / total_weight))
        } else {
            None
        }
    }

    fn calculate_confidence(&self, speed: f64, gesture_duration: f64) -> f64 {
        let speed_confidence = (speed / 500.0).min(1.0);
        
        let duration_confidence = ((gesture_duration - self.physics_config.min_gesture_time_ms) / 100.0).min(1.0).max(0.0);
        
        let straightness_score = self.calculate_straightness_score();
        
        let is_decelerating = self.is_gesture_decelerating();
        let deceleration_penalty = if is_decelerating { 0.5 } else { 1.0 };
        
        speed_confidence * duration_confidence * straightness_score * deceleration_penalty
    }

    fn calculate_straightness_score(&self) -> f64 {
        if self.touch_buffer.len() < 3 {
            return 1.0;
        }

        let first = self.touch_buffer.front().unwrap();
        let last = self.touch_buffer.back().unwrap();
        
        let direct_distance = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
        
        if direct_distance < 1.0 {
            return 0.0;
        }

        let mut path_distance = 0.0;
        let mut prev_point = first;
        
        for point in self.touch_buffer.iter().skip(1) {
            let dx = point.x - prev_point.x;
            let dy = point.y - prev_point.y;
            path_distance += (dx*dx + dy*dy).sqrt();
            prev_point = point;
        }

        (direct_distance / path_distance).min(1.0).max(0.0)
    }

    fn is_gesture_decelerating(&self) -> bool {
        if self.touch_buffer.len() < 4 {
            return false;
        }

        let n = self.touch_buffer.len();
        let start_idx = n.saturating_sub(4);
        
        let mut recent_speeds = Vec::new();
        let mut prev_point: Option<&TouchPoint> = None;
        
        for (i, point) in self.touch_buffer.iter().enumerate() {
            if i >= start_idx {
                if let Some(prev) = prev_point {
                    let dt = point.timestamp - prev.timestamp;
                    if dt > 0.0 {
                        let dx = point.x - prev.x;
                        let dy = point.y - prev.y;
                        let speed = ((dx*dx + dy*dy).sqrt()) / dt * 1000.0;
                        recent_speeds.push(speed);
                    }
                }
            }
            prev_point = Some(point);
        }

        if recent_speeds.len() >= 2 {
            recent_speeds.windows(2).all(|w| w[1] < w[0] * 0.9)
        } else {
            false
        }
    }

    pub fn reset(&mut self) {
        self.touch_buffer.clear();
        self.gesture_start_time = None;
        self.last_prediction = None;
    }

    pub fn detect_cancellation(&self) -> bool {
        if self.touch_buffer.len() < 3 {
            return false;
        }

        let n = self.touch_buffer.len();
        
        if n >= 3 {
            let points: Vec<&TouchPoint> = self.touch_buffer.iter().collect();
            let v1_x = points[n-2].x - points[n-3].x;
            let v1_y = points[n-2].y - points[n-3].y;
            let v2_x = points[n-1].x - points[n-2].x;
            let v2_y = points[n-1].y - points[n-2].y;
            
            let dot_product = v1_x * v2_x + v1_y * v2_y;
            if dot_product < 0.0 {
                return true;
            }
        }

        self.is_gesture_decelerating() && {
            let (vx, vy) = self.calculate_weighted_velocity().unwrap_or((0.0, 0.0));
            let speed = (vx*vx + vy*vy).sqrt();
            speed < self.physics_config.min_velocity_threshold * 0.5
        }
    }
}

pub struct PredictorManager {
    predictors: Arc<RwLock<HashMap<usize, GesturePredictor>>>,
    physics_config: PhysicsConfig,
    next_id: Arc<AtomicUsize>,
}

impl PredictorManager {
    pub fn new(physics_config: PhysicsConfig) -> Self {
        PredictorManager {
            predictors: Arc::new(RwLock::new(HashMap::new())),
            physics_config,
            next_id: Arc::new(AtomicUsize::new(0)),
        }
    }

    /// Create a new predictor and return its unique ID
    pub fn create_predictor(&self) -> Result<usize, &'static str> {
        let mut predictors = self.predictors.write().unwrap();
        
        // Check predictor limit
        if predictors.len() >= MAX_PREDICTORS {
            return Err("Maximum number of predictors reached");
        }
        
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let predictor = GesturePredictor::new(self.physics_config);
        predictors.insert(id, predictor);
        Ok(id)
    }
    
    /// Get the number of active predictors
    pub fn predictor_count(&self) -> usize {
        let predictors = self.predictors.read().unwrap();
        predictors.len()
    }
    
    /// Check if a predictor exists
    pub fn predictor_exists(&self, predictor_id: usize) -> bool {
        let predictors = self.predictors.read().unwrap();
        predictors.contains_key(&predictor_id)
    }

    pub fn add_touch_point(&self, predictor_id: usize, x: f64, y: f64, timestamp: f64) -> Result<(), &'static str> {
        let mut predictors = self.predictors.write().unwrap();
        if let Some(predictor) = predictors.get_mut(&predictor_id) {
            predictor.add_touch_point(x, y, timestamp);
            Ok(())
        } else {
            Err("Predictor not found")
        }
    }

    pub fn get_prediction(&self, predictor_id: usize) -> Option<Prediction> {
        let mut predictors = self.predictors.write().unwrap();
        predictors.get_mut(&predictor_id)?.get_prediction()
    }

    pub fn reset_predictor(&self, predictor_id: usize) -> Result<(), &'static str> {
        let mut predictors = self.predictors.write().unwrap();
        if let Some(predictor) = predictors.get_mut(&predictor_id) {
            predictor.reset();
            Ok(())
        } else {
            Err("Predictor not found")
        }
    }

    pub fn detect_cancellation(&self, predictor_id: usize) -> bool {
        let predictors = self.predictors.read().unwrap();
        predictors.get(&predictor_id).map_or(false, |p| p.detect_cancellation())
    }

    pub fn remove_predictor(&self, predictor_id: usize) -> Result<(), &'static str> {
        let mut predictors = self.predictors.write().unwrap();
        if predictors.remove(&predictor_id).is_some() {
            Ok(())
        } else {
            Err("Predictor not found")
        }
    }
}

static PREDICTOR_MANAGER: Lazy<Mutex<Option<PredictorManager>>> = Lazy::new(|| Mutex::new(None));

#[no_mangle]
pub extern "C" fn init_predictor_manager(
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
    if let Err(_) = physics_config.validate() {
        return 0;
    }
    
    let mut manager = PREDICTOR_MANAGER.lock().unwrap();
    if manager.is_some() {
        return 0; // Already initialized
    }
    *manager = Some(PredictorManager::new(physics_config));
    1
}

#[no_mangle]
pub extern "C" fn init_predictor() -> i32 {
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        match mgr.create_predictor() {
            Ok(id) => id as i32,
            Err(_) => -1,
        }
    } else {
        -1
    }
}

#[no_mangle]
pub extern "C" fn add_touch_point(predictor_id: i32, x: f64, y: f64, timestamp: f64) -> i32 {
    if predictor_id < 0 {
        return 0;
    }
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        match mgr.add_touch_point(predictor_id as usize, x, y, timestamp) {
            Ok(_) => 1,
            Err(_) => 0,
        }
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn get_prediction(
    predictor_id: i32,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    if out_x.is_null() || out_y.is_null() || out_confidence.is_null() {
        return 0;
    }
    
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        if let Some(prediction) = mgr.get_prediction(predictor_id as usize) {
            unsafe {
                *out_x = prediction.x;
                *out_y = prediction.y;
                *out_confidence = prediction.confidence;
            }
            return 1;
        }
    }
    0
}

#[no_mangle]
pub extern "C" fn reset_predictor(predictor_id: i32) -> i32 {
    if predictor_id < 0 {
        return 0;
    }
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        match mgr.reset_predictor(predictor_id as usize) {
            Ok(_) => 1,
            Err(_) => 0,
        }
    } else {
        0
    }
}

#[no_mangle]
pub extern "C" fn detect_cancellation(predictor_id: i32) -> i32 {
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        if mgr.detect_cancellation(predictor_id as usize) {
            return 1;
        }
    }
    0
}

#[no_mangle]
pub extern "C" fn remove_predictor(predictor_id: i32) -> i32 {
    if predictor_id < 0 {
        return 0;
    }
    let manager = PREDICTOR_MANAGER.lock().unwrap();
    if let Some(ref mgr) = *manager {
        match mgr.remove_predictor(predictor_id as usize) {
            Ok(_) => 1,
            Err(_) => 0,
        }
    } else {
        0
    }
}

#[cfg(target_os = "android")]
pub mod android {
    use super::*;
    use jni::JNIEnv;
    use jni::objects::{JClass, JObject};
    use jni::sys::{jdouble, jint, jlong};

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitManager(
        env: JNIEnv,
        _class: JClass,
        deceleration_rate: jdouble,
        min_velocity_threshold: jdouble,
        min_gesture_time_ms: jdouble,
        _velocity_smoothing_factor: jdouble, // Kept for ABI compatibility
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
        // velocity_smoothing_factor is no longer used but kept for ABI compatibility
        
        let result = init_predictor_manager(
            deceleration_rate as f64,
            min_velocity_threshold as f64,
            min_gesture_time_ms as f64,
            _velocity_smoothing_factor as f64,
        );
        
        if result == 0 {
            let _ = env.throw_new(
                "java/lang/IllegalStateException",
                "Failed to initialize PredictorManager. It may already be initialized or parameters are invalid."
            );
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitPredictor(
        env: JNIEnv,
        _class: JClass,
    ) -> jint {
        let result = init_predictor();
        if result == -1 {
            let _ = env.throw_new(
                "java/lang/IllegalStateException",
                "PredictorManager not initialized. Call nativeInitManager first."
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
        let result = add_touch_point(predictor_id, x as f64, y as f64, timestamp as f64);
        if result == 0 {
            // Predictor doesn't exist - don't throw, just silently ignore for backward compatibility
        }
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeGetPrediction(
        env: JNIEnv,
        _class: JClass,
        predictor_id: jint,
    ) -> JObject {
        let mut x: f64 = 0.0;
        let mut y: f64 = 0.0;
        let mut confidence: f64 = 0.0;
        
        let result = get_prediction(predictor_id, &mut x, &mut y, &mut confidence);
        
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
        let _ = reset_predictor(predictor_id);
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeDetectCancellation(
        _env: JNIEnv,
        _class: JClass,
        predictor_id: jint,
    ) -> jint {
        detect_cancellation(predictor_id)
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeRemovePredictor(
        _env: JNIEnv,
        _class: JClass,
        predictor_id: jint,
    ) {
        let _ = remove_predictor(predictor_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_gesture_predictor_basic() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        // Timestamps in milliseconds (as expected by the module)
        // Moving 100 pixels in 100ms = 1000 pixels/second
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(20.0, 0.0, 20.0);
        predictor.add_touch_point(40.0, 0.0, 40.0);
        predictor.add_touch_point(60.0, 0.0, 60.0);
        predictor.add_touch_point(80.0, 0.0, 80.0);
        predictor.add_touch_point(100.0, 0.0, 100.0);
        
        let prediction = predictor.get_prediction();
        assert!(prediction.is_some(), "Prediction should exist");
        
        let pred = prediction.unwrap();
        assert!(pred.x > 100.0, "Predicted x ({}) should be > 100", pred.x);
        assert!(pred.confidence > 0.0, "Confidence ({}) should be > 0", pred.confidence);
    }

    #[test]
    fn test_low_velocity_no_prediction() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(1.0, 0.0, 100.0);
        predictor.add_touch_point(2.0, 0.0, 200.0);
        
        let prediction = predictor.get_prediction();
        assert!(prediction.is_none());
    }

    #[test]
    fn test_gesture_cancellation_detection() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(10.0, 0.0, 10.0);
        predictor.add_touch_point(20.0, 0.0, 20.0);
        predictor.add_touch_point(15.0, 0.0, 30.0);
        
        assert!(predictor.detect_cancellation());
    }

    #[test]
    fn test_straightness_score() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(10.0, 0.0, 10.0);
        predictor.add_touch_point(20.0, 0.0, 20.0);
        predictor.add_touch_point(30.0, 0.0, 30.0);
        
        let score = predictor.calculate_straightness_score();
        assert!(score > 0.95);
        
        let mut curved_predictor = GesturePredictor::new(PhysicsConfig::default());
        curved_predictor.add_touch_point(0.0, 0.0, 0.0);
        curved_predictor.add_touch_point(10.0, 5.0, 10.0);
        curved_predictor.add_touch_point(20.0, 0.0, 20.0);
        curved_predictor.add_touch_point(30.0, -5.0, 30.0);
        
        let curved_score = curved_predictor.calculate_straightness_score();
        assert!(curved_score < score);
    }

    #[test]
    fn test_reset_predictor() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(10.0, 0.0, 10.0);
        
        predictor.reset();
        
        assert_eq!(predictor.touch_buffer.len(), 0);
        assert!(predictor.gesture_start_time.is_none());
        assert!(predictor.last_prediction.is_none());
    }

    #[test]
    fn test_predictor_manager_id_stability() {
        let manager = PredictorManager::new(PhysicsConfig::default());
        
        // Create multiple predictors
        let id1 = manager.create_predictor().unwrap();
        let id2 = manager.create_predictor().unwrap();
        let id3 = manager.create_predictor().unwrap();
        
        // Add some data to each
        let _ = manager.add_touch_point(id1, 0.0, 0.0, 0.0);
        let _ = manager.add_touch_point(id2, 10.0, 10.0, 0.0);
        let _ = manager.add_touch_point(id3, 20.0, 20.0, 0.0);
        
        // Remove the middle predictor
        let _ = manager.remove_predictor(id2);
        
        // Verify other predictors are still accessible
        let _ = manager.add_touch_point(id1, 5.0, 5.0, 10.0);
        let _ = manager.add_touch_point(id3, 25.0, 25.0, 10.0);
        
        // Create a new predictor - should get a new unique ID
        let id4 = manager.create_predictor().unwrap();
        assert!(id4 != id1 && id4 != id2 && id4 != id3);
        
        // Verify removed predictor is no longer accessible
        let _ = manager.add_touch_point(id2, 100.0, 100.0, 20.0); // Should fail
        let prediction = manager.get_prediction(id2);
        assert!(prediction.is_none());
    }

    #[test]
    fn test_thread_safe_predictor_manager() {
        init_predictor_manager(1500.0, 50.0, 30.0, 0.7);
        
        let handles: Vec<_> = (0..10).map(|i| {
            thread::spawn(move || {
                let predictor_id = init_predictor();
                assert!(predictor_id >= 0);
                
                // Add some points
                for j in 0..5 {
                    add_touch_point(
                        predictor_id,
                        (i * 10 + j) as f64,
                        (i * 10 + j) as f64,
                        (j * 10) as f64,
                    );
                }
                
                // Try to get prediction
                let mut x = 0.0;
                let mut y = 0.0;
                let mut confidence = 0.0;
                get_prediction(predictor_id, &mut x, &mut y, &mut confidence);
                
                // Clean up
                remove_predictor(predictor_id);
            })
        })
        .collect();
        
        for handle in handles {
            handle.join().unwrap();
        }
    }

    #[test]
    fn test_null_pointer_safety() {
        init_predictor_manager(1500.0, 50.0, 30.0, 0.7);
        let predictor_id = init_predictor();
        
        // Add some points to ensure prediction is possible
        for i in 0..10 {
            add_touch_point(predictor_id, i as f64 * 10.0, 0.0, i as f64 * 10.0);
        }
        
        // Test with null pointers
        let result = get_prediction(predictor_id, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut());
        assert_eq!(result, 0);
        
        // Test with some null pointers
        let mut x = 0.0;
        let result = get_prediction(predictor_id, &mut x, std::ptr::null_mut(), std::ptr::null_mut());
        assert_eq!(result, 0);
        
        // Test with valid pointers
        let mut y = 0.0;
        let mut confidence = 0.0;
        let result = get_prediction(predictor_id, &mut x, &mut y, &mut confidence);
        assert_eq!(result, 1);
        assert!(x > 0.0);
        
        remove_predictor(predictor_id);
    }

    #[test]
    fn test_timestamp_validation() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        // Test with proper millisecond timestamps
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(10.0, 0.0, 10.0);
        predictor.add_touch_point(20.0, 0.0, 20.0);
        predictor.add_touch_point(30.0, 0.0, 30.0);
        predictor.add_touch_point(40.0, 0.0, 40.0);
        
        let prediction = predictor.get_prediction();
        assert!(prediction.is_some());
        
        // Test with zero dt (identical timestamps)
        let mut predictor2 = GesturePredictor::new(PhysicsConfig::default());
        predictor2.add_touch_point(0.0, 0.0, 100.0);
        predictor2.add_touch_point(10.0, 0.0, 100.0); // Same timestamp
        predictor2.add_touch_point(20.0, 0.0, 100.0); // Same timestamp
        predictor2.add_touch_point(30.0, 0.0, 150.0);
        
        // Should still work, but with reduced confidence
        let prediction2 = predictor2.get_prediction();
        assert!(prediction2.is_some());
    }

    #[test]
    fn test_concurrent_predictor_creation() {
        let manager = PredictorManager::new(PhysicsConfig::default());
        let manager_arc = Arc::new(manager);
        
        let handles: Vec<_> = (0..100).map(|_| {
            let mgr = manager_arc.clone();
            thread::spawn(move || {
                mgr.create_predictor()
            })
        }).collect();
        
        let mut ids: Vec<usize> = handles.into_iter()
            .map(|h| h.join().unwrap().unwrap())
            .collect();
        
        // All IDs should be unique
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), 100);
    }

    #[test]
    fn test_physics_config_validation() {
        // Valid config
        let valid_config = PhysicsConfig::default();
        assert!(valid_config.validate().is_ok());
        
        // Invalid deceleration rate
        let mut config = PhysicsConfig::default();
        config.deceleration_rate = -100.0;
        assert!(config.validate().is_err());
        
        // Invalid velocity threshold
        config = PhysicsConfig::default();
        config.min_velocity_threshold = -1.0;
        assert!(config.validate().is_err());
        
        // Invalid gesture time
        config = PhysicsConfig::default();
        config.min_gesture_time_ms = -10.0;
        assert!(config.validate().is_err());
        
        // Config validation no longer checks smoothing factor (removed)
    }

    #[test]
    fn test_timestamp_ordering() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        // Add points with increasing timestamps
        predictor.add_touch_point(0.0, 0.0, 0.0);
        predictor.add_touch_point(10.0, 0.0, 10.0);
        
        // Try to add a point with timestamp going backwards
        predictor.add_touch_point(20.0, 0.0, 5.0); // Should be ignored
        
        // Add a valid point
        predictor.add_touch_point(30.0, 0.0, 20.0);
        
        // Should only have 3 points (the backwards one was ignored)
        assert_eq!(predictor.touch_buffer.len(), 3);
        assert_eq!(predictor.touch_buffer[2].x, 30.0);
    }

    #[test]
    fn test_manager_helper_methods() {
        let manager = PredictorManager::new(PhysicsConfig::default());
        
        // Initially no predictors
        assert_eq!(manager.predictor_count(), 0);
        
        // Create some predictors
        let id1 = manager.create_predictor().unwrap();
        let id2 = manager.create_predictor().unwrap();
        
        assert_eq!(manager.predictor_count(), 2);
        assert!(manager.predictor_exists(id1));
        assert!(manager.predictor_exists(id2));
        assert!(!manager.predictor_exists(99999));
        
        // Remove one
        let _ = manager.remove_predictor(id1);
        assert_eq!(manager.predictor_count(), 1);
        assert!(!manager.predictor_exists(id1));
        assert!(manager.predictor_exists(id2));
    }
    
    #[test]
    fn test_division_by_zero_protection() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        // Add points with zero velocity (same position)
        predictor.add_touch_point(10.0, 10.0, 0.0);
        predictor.add_touch_point(10.0, 10.0, 50.0);
        predictor.add_touch_point(10.0, 10.0, 100.0);
        
        // Should not panic and return None due to zero velocity
        let prediction = predictor.get_prediction();
        assert!(prediction.is_none());
    }
    
    #[test]
    fn test_manager_reinitialization_prevented() {
        // Reset the global manager
        {
            let mut manager = PREDICTOR_MANAGER.lock().unwrap();
            *manager = None;
        }
        
        // First initialization should succeed
        let result1 = init_predictor_manager(1500.0, 50.0, 30.0, 0.7);
        assert_eq!(result1, 1);
        
        // Second initialization should fail
        let result2 = init_predictor_manager(2000.0, 60.0, 40.0, 0.8);
        assert_eq!(result2, 0);
        
        // Verify original config is still in use
        let predictor_id = init_predictor();
        assert!(predictor_id >= 0);
    }
    
    #[test]
    fn test_predictor_limit() {
        let manager = PredictorManager::new(PhysicsConfig::default());
        let mut ids = Vec::new();
        
        // Create predictors up to the limit
        for _ in 0..MAX_PREDICTORS {
            match manager.create_predictor() {
                Ok(id) => ids.push(id),
                Err(_) => break,
            }
        }
        
        // Should have created MAX_PREDICTORS
        assert_eq!(ids.len(), MAX_PREDICTORS);
        
        // Next creation should fail
        let result = manager.create_predictor();
        assert!(result.is_err());
        
        // Remove one and try again
        let _ = manager.remove_predictor(ids[0]);
        let result = manager.create_predictor();
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_buffer_size_validation() {
        let config = PhysicsConfig::default();
        
        // Test minimum buffer size
        let predictor1 = GesturePredictor::with_buffer_size(config, 0);
        assert_eq!(predictor1.buffer_size, MIN_BUFFER_SIZE);
        
        // Test maximum buffer size
        let predictor2 = GesturePredictor::with_buffer_size(config, 1000);
        assert_eq!(predictor2.buffer_size, MAX_BUFFER_SIZE);
        
        // Test normal buffer size
        let predictor3 = GesturePredictor::with_buffer_size(config, 20);
        assert_eq!(predictor3.buffer_size, 20);
    }
    
    #[test]
    fn test_error_handling_invalid_predictor_ids() {
        let manager = PredictorManager::new(PhysicsConfig::default());
        
        // Test with non-existent predictor
        let result = manager.add_touch_point(999, 10.0, 10.0, 0.0);
        assert!(result.is_err());
        
        let result = manager.reset_predictor(999);
        assert!(result.is_err());
        
        let result = manager.remove_predictor(999);
        assert!(result.is_err());
        
        // Test with negative ID through FFI
        let result = add_touch_point(-1, 10.0, 10.0, 0.0);
        assert_eq!(result, 0);
        
        let result = reset_predictor(-1);
        assert_eq!(result, 0);
        
        let result = remove_predictor(-1);
        assert_eq!(result, 0);
    }
    
    #[test]
    fn test_physics_config_edge_cases() {
        // Test zero deceleration rate
        let mut config = PhysicsConfig::default();
        config.deceleration_rate = 0.0;
        assert!(config.validate().is_err());
        
        // Test negative deceleration rate
        config.deceleration_rate = -100.0;
        assert!(config.validate().is_err());
        
        // Test edge case values
        config = PhysicsConfig {
            deceleration_rate: f64::EPSILON,
            min_velocity_threshold: 0.0,
            min_gesture_time_ms: 0.0,
        };
        assert!(config.validate().is_ok());
    }
    
    #[test]
    fn test_concurrent_read_operations() {
        let manager = Arc::new(PredictorManager::new(PhysicsConfig::default()));
        let id = manager.create_predictor().unwrap();
        
        // Add some data
        for i in 0..10 {
            let _ = manager.add_touch_point(id, i as f64 * 10.0, 0.0, i as f64 * 10.0);
        }
        
        // Spawn multiple readers
        let handles: Vec<_> = (0..10).map(|_| {
            let mgr = manager.clone();
            thread::spawn(move || {
                for _ in 0..100 {
                    // These should not block each other with RwLock
                    let _ = mgr.predictor_exists(id);
                    let _ = mgr.predictor_count();
                    let _ = mgr.detect_cancellation(id);
                }
            })
        }).collect();
        
        // Wait for all threads
        for handle in handles {
            handle.join().unwrap();
        }
    }
    
    #[test]
    fn test_velocity_calculation_without_allocation() {
        let mut predictor = GesturePredictor::new(PhysicsConfig::default());
        
        // Add many points to test performance
        for i in 0..100 {
            predictor.add_touch_point(i as f64, i as f64, i as f64 * 10.0);
        }
        
        // This should work efficiently without allocating Vec
        let velocity = predictor.calculate_weighted_velocity();
        assert!(velocity.is_some());
    }
}
