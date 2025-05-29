use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Copy)]
pub struct TouchPoint {
    pub x: f64,
    pub y: f64,
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
    pub deceleration_rate: f64,
    pub min_velocity_threshold: f64,
    pub min_gesture_time_ms: f64,
    pub velocity_smoothing_factor: f64,
}

impl Default for PhysicsConfig {
    fn default() -> Self {
        PhysicsConfig {
            deceleration_rate: 1500.0,
            min_velocity_threshold: 50.0,
            min_gesture_time_ms: 30.0,
            velocity_smoothing_factor: 0.7,
        }
    }
}

pub struct GesturePredictor {
    touch_buffer: VecDeque<TouchPoint>,
    buffer_size: usize,
    physics_config: PhysicsConfig,
    gesture_start_time: Option<f64>,
    last_prediction: Option<Prediction>,
}

impl GesturePredictor {
    pub fn new(physics_config: PhysicsConfig) -> Self {
        GesturePredictor {
            touch_buffer: VecDeque::with_capacity(10),
            buffer_size: 10,
            physics_config,
            gesture_start_time: None,
            last_prediction: None,
        }
    }

    pub fn add_touch_point(&mut self, x: f64, y: f64, timestamp: f64) {
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
        
        let distance_x = velocity_x * time_to_stop - 0.5 * (velocity_x / speed) * self.physics_config.deceleration_rate * time_to_stop * time_to_stop;
        let distance_y = velocity_y * time_to_stop - 0.5 * (velocity_y / speed) * self.physics_config.deceleration_rate * time_to_stop * time_to_stop;

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

        let points: Vec<_> = self.touch_buffer.iter().cloned().collect();
        let n = points.len();

        for i in 1..n {
            let dt = points[i].timestamp - points[i-1].timestamp;
            if dt > 0.0 {
                // Convert from pixels/ms to pixels/second
                let vx = (points[i].x - points[i-1].x) / dt * 1000.0;
                let vy = (points[i].y - points[i-1].y) / dt * 1000.0;
                
                let weight = (i as f64 / n as f64).powf(2.0);
                
                total_velocity_x += vx * weight;
                total_velocity_y += vy * weight;
                total_weight += weight;
            }
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

        let points: Vec<_> = self.touch_buffer.iter().cloned().collect();
        let first = &points[0];
        let last = &points[points.len() - 1];
        
        let direct_distance = ((last.x - first.x).powi(2) + (last.y - first.y).powi(2)).sqrt();
        
        if direct_distance < 1.0 {
            return 0.0;
        }

        let mut path_distance = 0.0;
        for i in 1..points.len() {
            let dx = points[i].x - points[i-1].x;
            let dy = points[i].y - points[i-1].y;
            path_distance += (dx*dx + dy*dy).sqrt();
        }

        (direct_distance / path_distance).min(1.0).max(0.0)
    }

    fn is_gesture_decelerating(&self) -> bool {
        if self.touch_buffer.len() < 4 {
            return false;
        }

        let points: Vec<_> = self.touch_buffer.iter().cloned().collect();
        let n = points.len();
        
        let mut recent_speeds = Vec::new();
        for i in (n.saturating_sub(4))..n {
            if i > 0 {
                let dt = points[i].timestamp - points[i-1].timestamp;
                if dt > 0.0 {
                    let dx = points[i].x - points[i-1].x;
                    let dy = points[i].y - points[i-1].y;
                    let speed = ((dx*dx + dy*dy).sqrt()) / dt * 1000.0;
                    recent_speeds.push(speed);
                }
            }
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

        let points: Vec<_> = self.touch_buffer.iter().cloned().collect();
        let n = points.len();
        
        if n >= 3 {
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
    predictors: Arc<Mutex<Vec<GesturePredictor>>>,
    physics_config: PhysicsConfig,
}

impl PredictorManager {
    pub fn new(physics_config: PhysicsConfig) -> Self {
        PredictorManager {
            predictors: Arc::new(Mutex::new(Vec::new())),
            physics_config,
        }
    }

    pub fn create_predictor(&self) -> usize {
        let mut predictors = self.predictors.lock().unwrap();
        let predictor = GesturePredictor::new(self.physics_config);
        predictors.push(predictor);
        predictors.len() - 1
    }

    pub fn add_touch_point(&self, predictor_id: usize, x: f64, y: f64, timestamp: f64) {
        let mut predictors = self.predictors.lock().unwrap();
        if let Some(predictor) = predictors.get_mut(predictor_id) {
            predictor.add_touch_point(x, y, timestamp);
        }
    }

    pub fn get_prediction(&self, predictor_id: usize) -> Option<Prediction> {
        let mut predictors = self.predictors.lock().unwrap();
        predictors.get_mut(predictor_id)?.get_prediction()
    }

    pub fn reset_predictor(&self, predictor_id: usize) {
        let mut predictors = self.predictors.lock().unwrap();
        if let Some(predictor) = predictors.get_mut(predictor_id) {
            predictor.reset();
        }
    }

    pub fn detect_cancellation(&self, predictor_id: usize) -> bool {
        let predictors = self.predictors.lock().unwrap();
        predictors.get(predictor_id).map_or(false, |p| p.detect_cancellation())
    }

    pub fn remove_predictor(&self, predictor_id: usize) {
        let mut predictors = self.predictors.lock().unwrap();
        if predictor_id < predictors.len() {
            predictors.remove(predictor_id);
        }
    }
}

static mut PREDICTOR_MANAGER: Option<PredictorManager> = None;

#[no_mangle]
pub extern "C" fn init_predictor_manager(
    deceleration_rate: f64,
    min_velocity_threshold: f64,
    min_gesture_time_ms: f64,
    velocity_smoothing_factor: f64,
) {
    let physics_config = PhysicsConfig {
        deceleration_rate,
        min_velocity_threshold,
        min_gesture_time_ms,
        velocity_smoothing_factor,
    };
    
    unsafe {
        PREDICTOR_MANAGER = Some(PredictorManager::new(physics_config));
    }
}

#[no_mangle]
pub extern "C" fn init_predictor() -> i32 {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            manager.create_predictor() as i32
        } else {
            -1
        }
    }
}

#[no_mangle]
pub extern "C" fn add_touch_point(predictor_id: i32, x: f64, y: f64, timestamp: f64) {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            manager.add_touch_point(predictor_id as usize, x, y, timestamp);
        }
    }
}

#[no_mangle]
pub extern "C" fn get_prediction(
    predictor_id: i32,
    out_x: *mut f64,
    out_y: *mut f64,
    out_confidence: *mut f64,
) -> i32 {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            if let Some(prediction) = manager.get_prediction(predictor_id as usize) {
                *out_x = prediction.x;
                *out_y = prediction.y;
                *out_confidence = prediction.confidence;
                return 1;
            }
        }
        0
    }
}

#[no_mangle]
pub extern "C" fn reset_predictor(predictor_id: i32) {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            manager.reset_predictor(predictor_id as usize);
        }
    }
}

#[no_mangle]
pub extern "C" fn detect_cancellation(predictor_id: i32) -> i32 {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            if manager.detect_cancellation(predictor_id as usize) {
                return 1;
            }
        }
        0
    }
}

#[no_mangle]
pub extern "C" fn remove_predictor(predictor_id: i32) {
    unsafe {
        if let Some(ref manager) = PREDICTOR_MANAGER {
            manager.remove_predictor(predictor_id as usize);
        }
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
        _env: JNIEnv,
        _class: JClass,
        deceleration_rate: jdouble,
        min_velocity_threshold: jdouble,
        min_gesture_time_ms: jdouble,
        velocity_smoothing_factor: jdouble,
    ) {
        init_predictor_manager(
            deceleration_rate as f64,
            min_velocity_threshold as f64,
            min_gesture_time_ms as f64,
            velocity_smoothing_factor as f64,
        );
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeInitPredictor(
        _env: JNIEnv,
        _class: JClass,
    ) -> jint {
        init_predictor()
    }

    #[no_mangle]
    pub extern "system" fn Java_com_swipepredictor_SwipePredictorModule_nativeAddTouchPoint(
        _env: JNIEnv,
        _class: JClass,
        predictor_id: jint,
        x: jdouble,
        y: jdouble,
        timestamp: jdouble,
    ) {
        add_touch_point(predictor_id, x as f64, y as f64, timestamp as f64);
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
            let prediction_class = env.find_class("com/swipepredictor/Prediction").unwrap();
            env.new_object(
                prediction_class,
                "(DDD)V",
                &[x.into(), y.into(), confidence.into()],
            ).unwrap()
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
        reset_predictor(predictor_id);
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
        remove_predictor(predictor_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
}
