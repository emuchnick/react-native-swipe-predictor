#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SwipePredictorModule, RCTEventEmitter)

RCT_EXTERN_METHOD(createPredictor:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(addTouchPoint:(NSInteger)predictorId
                  x:(double)x
                  y:(double)y
                  timestamp:(double)timestamp)

RCT_EXTERN_METHOD(getPrediction:(NSInteger)predictorId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(resetPredictor:(NSInteger)predictorId)

RCT_EXTERN_METHOD(detectCancellation:(NSInteger)predictorId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(removePredictor:(NSInteger)predictorId)

@end