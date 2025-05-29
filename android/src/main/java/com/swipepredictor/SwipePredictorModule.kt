package com.swipepredictor

import android.os.Handler
import android.os.HandlerThread
import android.view.Choreographer
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.roundToLong

class SwipePredictorModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    
    companion object {
        init {
            System.loadLibrary("swipe_predictor")
        }
        
        // Native method declarations
        @JvmStatic
        external fun nativeInitManager(
            decelerationRate: Double,
            minVelocityThreshold: Double,
            minGestureTimeMs: Double,
            velocitySmoothingFactor: Double
        )
        
        @JvmStatic
        external fun nativeInitPredictor(): Int
        
        @JvmStatic
        external fun nativeAddTouchPoint(predictorId: Int, x: Double, y: Double, timestamp: Double)
        
        @JvmStatic
        external fun nativeGetPrediction(predictorId: Int): Prediction?
        
        @JvmStatic
        external fun nativeResetPredictor(predictorId: Int)
        
        @JvmStatic
        external fun nativeDetectCancellation(predictorId: Int): Int
        
        @JvmStatic
        external fun nativeRemovePredictor(predictorId: Int)
    }
    
    private val handlerThread = HandlerThread("SwipePredictorThread").apply { start() }
    private val backgroundHandler = Handler(handlerThread.looper)
    private val activePredictors = ConcurrentHashMap<Int, PredictorInfo>()
    private var choreographer: Choreographer? = null
    private var isFrameCallbackScheduled = false
    
    data class PredictorInfo(
        val predictorId: Int,
        var lastUpdate: Long = 0,
        val updateInterval: Long,
        val confidenceThreshold: Double
    )
    
    init {
        // Initialize the Rust predictor manager with default physics
        nativeInitManager(1500.0, 50.0, 30.0, 0.7)
    }
    
    override fun getName() = "SwipePredictorModule"
    
    @ReactMethod
    fun createPredictor(options: ReadableMap, promise: Promise) {
        backgroundHandler.post {
            try {
                val predictorId = nativeInitPredictor()
                
                if (predictorId >= 0) {
                    val updateInterval = (options.getDouble("updateInterval") * 1000).roundToLong()
                        .coerceAtLeast(8) // Min 8ms (120fps)
                    val confidenceThreshold = options.getDouble("confidenceThreshold")
                    
                    val info = PredictorInfo(
                        predictorId = predictorId,
                        updateInterval = updateInterval,
                        confidenceThreshold = confidenceThreshold
                    )
                    
                    activePredictors[predictorId] = info
                    
                    reactApplicationContext.runOnUiQueueThread {
                        startChoreographerIfNeeded()
                    }
                    
                    promise.resolve(predictorId)
                } else {
                    promise.reject("INIT_FAILED", "Failed to initialize predictor")
                }
            } catch (e: Exception) {
                promise.reject("INIT_ERROR", "Error initializing predictor", e)
            }
        }
    }
    
    @ReactMethod
    fun addTouchPoint(predictorId: Int, x: Double, y: Double, timestamp: Double) {
        backgroundHandler.post {
            nativeAddTouchPoint(predictorId, x, y, timestamp)
        }
    }
    
    @ReactMethod
    fun getPrediction(predictorId: Int, promise: Promise) {
        backgroundHandler.post {
            try {
                val prediction = nativeGetPrediction(predictorId)
                val info = activePredictors[predictorId]
                
                if (prediction != null && info != null && prediction.confidence >= info.confidenceThreshold) {
                    val result = Arguments.createMap().apply {
                        putDouble("x", prediction.x)
                        putDouble("y", prediction.y)
                        putDouble("confidence", prediction.confidence)
                    }
                    promise.resolve(result)
                } else {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                promise.reject("PREDICTION_ERROR", "Error getting prediction", e)
            }
        }
    }
    
    @ReactMethod
    fun resetPredictor(predictorId: Int) {
        backgroundHandler.post {
            nativeResetPredictor(predictorId)
        }
    }
    
    @ReactMethod
    fun detectCancellation(predictorId: Int, promise: Promise) {
        backgroundHandler.post {
            try {
                val isCancelled = nativeDetectCancellation(predictorId) == 1
                promise.resolve(isCancelled)
            } catch (e: Exception) {
                promise.reject("CANCELLATION_ERROR", "Error detecting cancellation", e)
            }
        }
    }
    
    @ReactMethod
    fun removePredictor(predictorId: Int) {
        backgroundHandler.post {
            nativeRemovePredictor(predictorId)
            activePredictors.remove(predictorId)
            
            if (activePredictors.isEmpty()) {
                reactApplicationContext.runOnUiQueueThread {
                    stopChoreographer()
                }
            }
        }
    }
    
    private fun startChoreographerIfNeeded() {
        if (choreographer == null) {
            choreographer = Choreographer.getInstance()
        }
        
        if (!isFrameCallbackScheduled) {
            isFrameCallbackScheduled = true
            choreographer?.postFrameCallback(frameCallback)
        }
    }
    
    private fun stopChoreographer() {
        isFrameCallbackScheduled = false
        choreographer?.removeFrameCallback(frameCallback)
    }
    
    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (!isFrameCallbackScheduled) return
            
            val currentTime = System.currentTimeMillis()
            
            activePredictors.forEach { (predictorId, info) ->
                if (currentTime - info.lastUpdate >= info.updateInterval) {
                    checkAndSendPrediction(predictorId)
                    info.lastUpdate = currentTime
                }
            }
            
            // Schedule next frame
            choreographer?.postFrameCallback(this)
        }
    }
    
    private fun checkAndSendPrediction(predictorId: Int) {
        backgroundHandler.post {
            try {
                val prediction = nativeGetPrediction(predictorId)
                val info = activePredictors[predictorId]
                
                if (prediction != null && info != null && prediction.confidence >= info.confidenceThreshold) {
                    val params = Arguments.createMap().apply {
                        putInt("predictorId", predictorId)
                        putDouble("x", prediction.x)
                        putDouble("y", prediction.y)
                        putDouble("confidence", prediction.confidence)
                    }
                    
                    sendEvent("onPrediction", params)
                }
                
                // Check for cancellation
                val isCancelled = nativeDetectCancellation(predictorId) == 1
                if (isCancelled) {
                    val params = Arguments.createMap().apply {
                        putInt("predictorId", predictorId)
                    }
                    sendEvent("onCancellation", params)
                }
            } catch (e: Exception) {
                // Log error but don't crash
                e.printStackTrace()
            }
        }
    }
    
    private fun sendEvent(eventName: String, params: WritableMap) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }
    
    override fun onCatalystInstanceDestroy() {
        super.onCatalystInstanceDestroy()
        handlerThread.quitSafely()
        stopChoreographer()
    }
}