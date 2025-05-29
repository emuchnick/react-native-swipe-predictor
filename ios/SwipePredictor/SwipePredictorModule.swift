import Foundation
import React

@objc(SwipePredictorModule)
class SwipePredictorModule: RCTEventEmitter {
    private var predictorUpdateTimer: Timer?
    private var activePredictors: [Int: PredictorInfo] = [:]
    private var displayLink: CADisplayLink?
    private var context: OpaquePointer?
    private let contextLock = NSLock()
    
    struct PredictorInfo {
        let handle: OpaquePointer
        var lastUpdate: Date
        var updateInterval: TimeInterval
        var confidenceThreshold: Double
        var onPredictionCallback: String?
    }
    
    override init() {
        super.init()
        // Don't initialize here - will do it lazily when first predictor is created
    }
    
    private func ensureContextInitialized() {
        contextLock.lock()
        defer { contextLock.unlock() }
        
        guard context == nil else { return }
        
        // Initialize panic handler for Rust FFI (safe to call multiple times)
        swipe_predictor_init_panic_handler()
        
        // Create a default context with handle-based API
        context = swipe_predictor_context_create_default()
    }
    
    deinit {
        // Clean up the context when the module is deallocated
        if let ctx = context {
            swipe_predictor_context_destroy(ctx)
        }
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
            self?.ensureContextInitialized()
            
            guard let context = self?.context else {
                reject("NO_CONTEXT", "SwipePredictor context not initialized", nil)
                return
            }
            
            guard let handle = swipe_predictor_create_in_context(context) else {
                reject("INIT_FAILED", "Failed to create predictor", nil)
                return
            }
            
            let updateInterval = (options["updateInterval"] as? TimeInterval) ?? 0.016 // 60 FPS default
            let confidenceThreshold = (options["confidenceThreshold"] as? Double) ?? 0.7
            let onPredictionCallback = options["onPredictionCallback"] as? String
            
            // Generate a unique ID for this predictor
            let predictorId = Int(bitPattern: handle)
            
            let info = PredictorInfo(
                handle: handle,
                lastUpdate: Date(),
                updateInterval: updateInterval,
                confidenceThreshold: confidenceThreshold,
                onPredictionCallback: onPredictionCallback
            )
            
            DispatchQueue.main.async {
                self?.activePredictors[predictorId] = info
                self?.startDisplayLinkIfNeeded()
                resolve(predictorId)
            }
        }
    }
    
    @objc
    func addTouchPoint(_ predictorId: Int,
                      x: Double,
                      y: Double,
                      timestamp: Double) {
        guard let info = activePredictors[predictorId] else { return }
        
        DispatchQueue.global(qos: .userInteractive).async {
            swipe_predictor_add_point(info.handle, x, y, timestamp)
        }
    }
    
    @objc
    func getPrediction(_ predictorId: Int,
                      resolver resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let info = activePredictors[predictorId] else {
            resolve(nil)
            return
        }
        
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            var x: Double = 0.0
            var y: Double = 0.0
            var confidence: Double = 0.0
            
            let result = swipe_predictor_get_prediction(info.handle, &x, &y, &confidence)
            
            if result == 1 {
                let prediction: [String: Any] = [
                    "x": x,
                    "y": y,
                    "confidence": confidence
                ]
                
                DispatchQueue.main.async {
                    if confidence >= info.confidenceThreshold {
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
        guard let info = activePredictors[predictorId] else { return }
        
        DispatchQueue.global(qos: .userInteractive).async {
            swipe_predictor_reset(info.handle)
        }
    }
    
    @objc
    func detectCancellation(_ predictorId: Int,
                           resolver resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let info = activePredictors[predictorId] else {
            resolve(false)
            return
        }
        
        DispatchQueue.global(qos: .userInteractive).async {
            let isCancelled = swipe_predictor_detect_cancellation(info.handle)
            resolve(isCancelled == 1)
        }
    }
    
    @objc
    func removePredictor(_ predictorId: Int) {
        guard let info = activePredictors[predictorId] else { return }
        
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            swipe_predictor_destroy(info.handle)
            
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
        guard let info = activePredictors[predictorId] else { return }
        
        DispatchQueue.global(qos: .userInteractive).async { [weak self] in
            var x: Double = 0.0
            var y: Double = 0.0
            var confidence: Double = 0.0
            
            let result = swipe_predictor_get_prediction(info.handle, &x, &y, &confidence)
            
            if result == 1 {
                DispatchQueue.main.async {
                    if confidence >= info.confidenceThreshold {
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
            let isCancelled = swipe_predictor_detect_cancellation(info.handle)
            if isCancelled == 1 {
                DispatchQueue.main.async {
                    self?.sendEvent(withName: "onCancellation", body: ["predictorId": predictorId])
                }
            }
        }
    }
}

// Rust FFI function declarations
@_silgen_name("swipe_predictor_init_panic_handler")
func swipe_predictor_init_panic_handler()

@_silgen_name("swipe_predictor_context_create_default")
func swipe_predictor_context_create_default() -> OpaquePointer?

@_silgen_name("swipe_predictor_context_destroy")
func swipe_predictor_context_destroy(_ ctx: OpaquePointer)

@_silgen_name("swipe_predictor_create_in_context")
func swipe_predictor_create_in_context(_ ctx: OpaquePointer) -> OpaquePointer?

@_silgen_name("swipe_predictor_destroy")
func swipe_predictor_destroy(_ handle: OpaquePointer)

@_silgen_name("swipe_predictor_add_point")
func swipe_predictor_add_point(_ handle: OpaquePointer, _ x: Double, _ y: Double, _ timestamp: Double) -> Int32

@_silgen_name("swipe_predictor_get_prediction")
func swipe_predictor_get_prediction(_ handle: OpaquePointer,
                                   _ out_x: UnsafeMutablePointer<Double>,
                                   _ out_y: UnsafeMutablePointer<Double>,
                                   _ out_confidence: UnsafeMutablePointer<Double>) -> Int32

@_silgen_name("swipe_predictor_reset")
func swipe_predictor_reset(_ handle: OpaquePointer) -> Int32

@_silgen_name("swipe_predictor_detect_cancellation")
func swipe_predictor_detect_cancellation(_ handle: OpaquePointer) -> Int32