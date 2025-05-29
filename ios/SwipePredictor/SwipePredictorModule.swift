import Foundation
import React

@objc(SwipePredictorModule)
class SwipePredictorModule: RCTEventEmitter {
    private var predictorUpdateTimer: Timer?
    private var activePredictors: [Int: PredictorInfo] = [:]
    private var displayLink: CADisplayLink?
    
    struct PredictorInfo {
        let predictorId: Int32
        var lastUpdate: Date
        var updateInterval: TimeInterval
        var confidenceThreshold: Double
        var onPredictionCallback: String?
    }
    
    override init() {
        super.init()
        
        // Initialize the Rust predictor manager with default physics
        init_predictor_manager(1500.0, 50.0, 30.0, 0.7)
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onPrediction", "onCancellation"]
    }
    
    @objc
    func createPredictor(_ options: [String: Any], 
                        resolver resolve: @escaping RCTPromiseResolveBlock,
                        rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            let predictorId = init_predictor()
            
            if predictorId >= 0 {
                let updateInterval = (options["updateInterval"] as? TimeInterval) ?? 0.016 // 60 FPS default
                let confidenceThreshold = (options["confidenceThreshold"] as? Double) ?? 0.7
                let onPredictionCallback = options["onPredictionCallback"] as? String
                
                let info = PredictorInfo(
                    predictorId: predictorId,
                    lastUpdate: Date(),
                    updateInterval: updateInterval,
                    confidenceThreshold: confidenceThreshold,
                    onPredictionCallback: onPredictionCallback
                )
                
                DispatchQueue.main.async {
                    self?.activePredictors[Int(predictorId)] = info
                    self?.startDisplayLinkIfNeeded()
                    resolve(predictorId)
                }
            } else {
                reject("INIT_FAILED", "Failed to initialize predictor", nil)
            }
        }
    }
    
    @objc
    func addTouchPoint(_ predictorId: Int,
                      x: Double,
                      y: Double,
                      timestamp: Double) {
        DispatchQueue.global(qos: .userInteractive).async {
            add_touch_point(Int32(predictorId), x, y, timestamp)
        }
    }
    
    @objc
    func getPrediction(_ predictorId: Int,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            var x: Double = 0.0
            var y: Double = 0.0
            var confidence: Double = 0.0
            
            let result = get_prediction(Int32(predictorId), &x, &y, &confidence)
            
            if result == 1 {
                let prediction: [String: Any] = [
                    "x": x,
                    "y": y,
                    "confidence": confidence
                ]
                
                DispatchQueue.main.async {
                    if let info = self?.activePredictors[predictorId],
                       confidence >= info.confidenceThreshold {
                        resolve(prediction)
                    } else {
                        resolve(nil)
                    }
                }
            } else {
                DispatchQueue.main.async {
                    resolve(nil)
                }
            }
        }
    }
    
    @objc
    func resetPredictor(_ predictorId: Int) {
        DispatchQueue.global(qos: .userInteractive).async {
            reset_predictor(Int32(predictorId))
        }
    }
    
    @objc
    func detectCancellation(_ predictorId: Int,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.global(qos: .userInteractive).async {
            let isCancelled = detect_cancellation(Int32(predictorId))
            resolve(isCancelled == 1)
        }
    }
    
    @objc
    func removePredictor(_ predictorId: Int) {
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            remove_predictor(Int32(predictorId))
            
            DispatchQueue.main.async {
                self?.activePredictors.removeValue(forKey: predictorId)
                if self?.activePredictors.isEmpty == true {
                    self?.stopDisplayLink()
                }
            }
        }
    }
    
    private func startDisplayLinkIfNeeded() {
        guard displayLink == nil else { return }
        
        displayLink = CADisplayLink(target: self, selector: #selector(displayLinkUpdate))
        displayLink?.preferredFramesPerSecond = 120 // Support ProMotion displays
        displayLink?.add(to: .current, forMode: .common)
    }
    
    private func stopDisplayLink() {
        displayLink?.invalidate()
        displayLink = nil
    }
    
    @objc
    private func displayLinkUpdate() {
        let now = Date()
        
        for (predictorId, info) in activePredictors {
            if now.timeIntervalSince(info.lastUpdate) >= info.updateInterval {
                checkAndSendPrediction(predictorId: predictorId)
                activePredictors[predictorId]?.lastUpdate = now
            }
        }
    }
    
    private func checkAndSendPrediction(predictorId: Int) {
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            var x: Double = 0.0
            var y: Double = 0.0
            var confidence: Double = 0.0
            
            let result = get_prediction(Int32(predictorId), &x, &y, &confidence)
            
            if result == 1 {
                DispatchQueue.main.async {
                    if let info = self?.activePredictors[predictorId],
                       confidence >= info.confidenceThreshold {
                        let prediction: [String: Any] = [
                            "predictorId": predictorId,
                            "x": x,
                            "y": y,
                            "confidence": confidence
                        ]
                        
                        self?.sendEvent(withName: "onPrediction", body: prediction)
                    }
                }
            }
            
            // Check for cancellation
            let isCancelled = detect_cancellation(Int32(predictorId))
            if isCancelled == 1 {
                DispatchQueue.main.async {
                    self?.sendEvent(withName: "onCancellation", body: ["predictorId": predictorId])
                }
            }
        }
    }
}

// Rust FFI function declarations
@_silgen_name("init_predictor_manager")
func init_predictor_manager(_ deceleration_rate: Double, 
                           _ min_velocity_threshold: Double,
                           _ min_gesture_time_ms: Double,
                           _ velocity_smoothing_factor: Double)

@_silgen_name("init_predictor")
func init_predictor() -> Int32

@_silgen_name("add_touch_point")
func add_touch_point(_ predictor_id: Int32, _ x: Double, _ y: Double, _ timestamp: Double)

@_silgen_name("get_prediction")
func get_prediction(_ predictor_id: Int32, 
                   _ out_x: UnsafeMutablePointer<Double>,
                   _ out_y: UnsafeMutablePointer<Double>,
                   _ out_confidence: UnsafeMutablePointer<Double>) -> Int32

@_silgen_name("reset_predictor")
func reset_predictor(_ predictor_id: Int32)

@_silgen_name("detect_cancellation")
func detect_cancellation(_ predictor_id: Int32) -> Int32

@_silgen_name("remove_predictor")
func remove_predictor(_ predictor_id: Int32)