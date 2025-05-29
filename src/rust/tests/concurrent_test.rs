use std::thread;
use swipe_predictor::*;

#[test]
fn test_predictor_thread_safety() {
    // Test that individual predictors work correctly when used from single thread
    let config = PhysicsConfig::default();
    let handles: Vec<_> = (0..10)
        .map(|_| {
            thread::spawn(move || {
                let mut predictor = GesturePredictor::new(config).unwrap();
                
                // Each thread uses its own predictor
                for i in 0..10 {
                    predictor.add_touch_point(
                        i as f64 * 20.0,
                        i as f64 * 10.0,
                        i as f64 * 20.0,
                    ).unwrap();
                }
                
                predictor.predict().unwrap()
            })
        })
        .collect();

    let predictions: Vec<Prediction> = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .collect();

    // All predictions should be valid
    for pred in predictions {
        assert!(pred.position.x > 0.0);
        assert!(pred.position.y > 0.0);
        assert!(pred.confidence > 0.0);
    }
}