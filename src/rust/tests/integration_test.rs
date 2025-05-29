use swipe_predictor::{GesturePredictor, PhysicsConfig};

#[test]
fn test_complete_gesture_flow() {
    // Create predictor with custom config
    let config = PhysicsConfig::new(1000.0, 100.0, 50.0).unwrap();
    let mut predictor = GesturePredictor::new(config).unwrap();

    // Simulate a swipe gesture
    let points = vec![
        (0.0, 0.0, 0.0),
        (20.0, 5.0, 20.0),
        (45.0, 10.0, 40.0),
        (75.0, 15.0, 60.0),
        (110.0, 20.0, 80.0),
        (150.0, 25.0, 100.0),
    ];

    for (x, y, t) in &points {
        predictor.add_touch_point(*x, *y, *t).unwrap();
    }

    // Get prediction
    let prediction = predictor.predict().unwrap();

    // Verify prediction is reasonable
    assert!(prediction.position.x > 150.0, "Should predict beyond last point");
    assert!(prediction.position.y > 25.0, "Should predict beyond last point");
    assert!(prediction.confidence > 0.0, "Should have some confidence: {}", prediction.confidence);
}

#[test]
fn test_different_gesture_patterns() {
    let config = PhysicsConfig::default();

    // Test horizontal swipe
    let mut predictor = GesturePredictor::new(config).unwrap();
    for i in 0..5 {
        predictor.add_touch_point(i as f64 * 30.0, 0.0, i as f64 * 30.0).unwrap();
    }
    let prediction = predictor.predict().unwrap();
    assert!(prediction.position.x > 120.0);
    assert!((prediction.position.y).abs() < 1.0);

    // Test vertical swipe
    let mut predictor = GesturePredictor::new(config).unwrap();
    for i in 0..5 {
        predictor.add_touch_point(0.0, i as f64 * 30.0, i as f64 * 30.0).unwrap();
    }
    let prediction = predictor.predict().unwrap();
    assert!((prediction.position.x).abs() < 1.0);
    assert!(prediction.position.y > 120.0);

    // Test diagonal swipe
    let mut predictor = GesturePredictor::new(config).unwrap();
    for i in 0..5 {
        predictor.add_touch_point(i as f64 * 30.0, i as f64 * 30.0, i as f64 * 30.0).unwrap();
    }
    let prediction = predictor.predict().unwrap();
    assert!(prediction.position.x > 120.0);
    assert!(prediction.position.y > 120.0);
    assert!((prediction.position.x - prediction.position.y).abs() < 1.0);
}

#[test]
fn test_curved_gesture() {
    let config = PhysicsConfig::default();
    let mut predictor = GesturePredictor::new(config).unwrap();

    // Simulate a curved gesture
    let points = vec![
        (0.0, 0.0, 0.0),
        (30.0, 5.0, 30.0),
        (55.0, 15.0, 60.0),
        (75.0, 30.0, 90.0),
        (90.0, 50.0, 120.0),
    ];

    for (x, y, t) in &points {
        predictor.add_touch_point(*x, *y, *t).unwrap();
    }

    let prediction = predictor.predict().unwrap();
    
    // Curved gestures should still work but may have different confidence
    assert!(prediction.position.x > 90.0);
    assert!(prediction.position.y > 50.0);
    // Just verify we got a prediction with some confidence
    assert!(prediction.confidence > 0.0, "Confidence: {}", prediction.confidence);
}

#[test]
fn test_gesture_with_varying_speeds() {
    let config = PhysicsConfig::default();
    let mut predictor = GesturePredictor::new(config).unwrap();

    // Start slow, then speed up
    let points = vec![
        (0.0, 0.0, 0.0),
        (5.0, 0.0, 50.0),    // Slow: 100 px/s
        (15.0, 0.0, 100.0),  // Medium: 200 px/s
        (35.0, 0.0, 150.0),  // Fast: 400 px/s
        (65.0, 0.0, 200.0),  // Very fast: 600 px/s
    ];

    for (x, y, t) in &points {
        predictor.add_touch_point(*x, *y, *t).unwrap();
    }

    let prediction = predictor.predict().unwrap();
    
    // Should predict based on weighted velocity (recent points weighted more)
    assert!(prediction.position.x > 100.0);
    assert!(prediction.confidence > 0.0);
}

#[test]
fn test_error_recovery() {
    let config = PhysicsConfig::default();
    let mut predictor = GesturePredictor::new(config).unwrap();

    // Add some valid points
    predictor.add_touch_point(0.0, 0.0, 0.0).unwrap();
    predictor.add_touch_point(10.0, 0.0, 10.0).unwrap();

    // Try to add invalid point (out of order timestamp)
    let result = predictor.add_touch_point(20.0, 0.0, 5.0);
    assert!(result.is_err());

    // Predictor should still work with valid points
    predictor.add_touch_point(30.0, 0.0, 30.0).unwrap();
    predictor.add_touch_point(40.0, 0.0, 40.0).unwrap();

    let prediction = predictor.predict();
    assert!(prediction.is_ok());
}

#[test]
fn test_buffer_overflow_handling() {
    let config = PhysicsConfig::default();
    let mut predictor = GesturePredictor::with_buffer_size(config, 5).unwrap();

    // Add more points than buffer size
    for i in 0..20 {
        predictor.add_touch_point(i as f64 * 10.0, 0.0, i as f64 * 10.0).unwrap();
    }

    // Should only have last 5 points
    assert_eq!(predictor.point_count(), 5);

    // Should still be able to predict
    let prediction = predictor.predict();
    assert!(prediction.is_ok());
}