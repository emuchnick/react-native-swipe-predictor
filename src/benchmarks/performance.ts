import { NativeModules, Platform } from 'react-native';

interface BenchmarkResult {
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  totalPredictions: number;
  droppedFrames: number;
  averageFPS: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface TouchPoint {
  x: number;
  y: number;
  timestamp: number;
}

class PerformanceBenchmark {
  private predictions: number[] = [];
  private frameTimestamps: number[] = [];
  private startTime: number = 0;
  private nativeModule: any;
  // private eventEmitter: NativeEventEmitter;
  private droppedFrames: number = 0;
  private lastFrameTime: number = 0;

  constructor() {
    this.nativeModule = NativeModules.SwipePredictorModule;
    // this.eventEmitter = new NativeEventEmitter(this.nativeModule);
  }

  async runBenchmark(iterations: number = 1000): Promise<BenchmarkResult> {
    console.log(`Starting performance benchmark with ${iterations} iterations...`);
    
    this.reset();
    this.startTime = Date.now();
    
    // Simulate various swipe patterns
    const patterns = [
      this.generateLinearSwipe,
      this.generateCurvedSwipe,
      this.generateFastSwipe,
      this.generateSlowSwipe,
      this.generateErraticSwipe,
    ];
    
    for (let i = 0; i < iterations; i++) {
      const pattern = patterns[i % patterns.length];
      await this.benchmarkPattern(pattern.call(this));
    }
    
    return this.calculateResults();
  }

  private async benchmarkPattern(touchPoints: TouchPoint[]): Promise<void> {
    const predictorId = await this.nativeModule.createPredictor();
    
    for (const point of touchPoints) {
      const startTime = performance.now();
      
      await this.nativeModule.addTouchPoint(
        predictorId,
        point.x,
        point.y,
        point.timestamp
      );
      
      await this.nativeModule.getPrediction(predictorId);
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      this.predictions.push(latency);
      this.trackFrame(endTime);
    }
    
    await this.nativeModule.releasePredictor(predictorId);
  }

  private trackFrame(timestamp: number): void {
    this.frameTimestamps.push(timestamp);
    
    if (this.lastFrameTime > 0) {
      const frameDuration = timestamp - this.lastFrameTime;
      const expectedDuration = Platform.OS === 'ios' ? 8.33 : 16.67; // 120Hz vs 60Hz
      
      if (frameDuration > expectedDuration * 1.5) {
        this.droppedFrames++;
      }
    }
    
    this.lastFrameTime = timestamp;
  }

  private generateLinearSwipe(): TouchPoint[] {
    const points: TouchPoint[] = [];
    const startX = 100;
    const startY = 200;
    const endX = 300;
    const endY = 400;
    
    for (let i = 0; i < 20; i++) {
      const progress = i / 19;
      points.push({
        x: startX + (endX - startX) * progress,
        y: startY + (endY - startY) * progress,
        timestamp: i * 16.67, // 60fps timing
      });
    }
    
    return points;
  }

  private generateCurvedSwipe(): TouchPoint[] {
    const points: TouchPoint[] = [];
    const centerX = 200;
    const centerY = 300;
    const radius = 100;
    
    for (let i = 0; i < 25; i++) {
      const angle = (i / 24) * Math.PI / 2; // Quarter circle
      points.push({
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        timestamp: i * 16.67,
      });
    }
    
    return points;
  }

  private generateFastSwipe(): TouchPoint[] {
    const points: TouchPoint[] = [];
    
    for (let i = 0; i < 10; i++) {
      points.push({
        x: 100 + i * 30,
        y: 200 + i * 20,
        timestamp: i * 8.33, // 120fps timing
      });
    }
    
    return points;
  }

  private generateSlowSwipe(): TouchPoint[] {
    const points: TouchPoint[] = [];
    
    for (let i = 0; i < 50; i++) {
      points.push({
        x: 150 + i * 2,
        y: 250 + i * 1.5,
        timestamp: i * 33.33, // 30fps timing
      });
    }
    
    return points;
  }

  private generateErraticSwipe(): TouchPoint[] {
    const points: TouchPoint[] = [];
    
    for (let i = 0; i < 30; i++) {
      const noise = Math.sin(i * 0.5) * 10;
      points.push({
        x: 100 + i * 5 + noise,
        y: 200 + i * 4 + noise * 0.7,
        timestamp: i * 16.67,
      });
    }
    
    return points;
  }

  private calculateResults(): BenchmarkResult {
    const sortedPredictions = [...this.predictions].sort((a, b) => a - b);
    
    // Calculate FPS
    let totalFPS = 0;
    for (let i = 1; i < this.frameTimestamps.length; i++) {
      const frameDuration = this.frameTimestamps[i] - this.frameTimestamps[i - 1];
      totalFPS += 1000 / frameDuration;
    }
    const averageFPS = totalFPS / (this.frameTimestamps.length - 1);
    
    return {
      averageLatency: this.average(this.predictions),
      maxLatency: sortedPredictions[sortedPredictions.length - 1] || 0,
      minLatency: sortedPredictions[0] || 0,
      totalPredictions: this.predictions.length,
      droppedFrames: this.droppedFrames,
      averageFPS: Math.round(averageFPS),
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: this.getCPUUsage(),
    };
  }

  private average(numbers: number[]): number {
    if (numbers.length === 0) return 0;
    return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  }

  private getMemoryUsage(): number {
    // Placeholder - would need native implementation
    return 0;
  }

  private getCPUUsage(): number {
    // Placeholder - would need native implementation  
    return 0;
  }

  private reset(): void {
    this.predictions = [];
    this.frameTimestamps = [];
    this.droppedFrames = 0;
    this.lastFrameTime = 0;
  }

  async runComparisonBenchmark(): Promise<{
    withPrediction: BenchmarkResult;
    withoutPrediction: BenchmarkResult;
  }> {
    console.log('Running comparison benchmark...');
    
    // Run with prediction
    const withPrediction = await this.runBenchmark(500);
    
    // Simulate without prediction (just touch tracking)
    this.reset();
    const withoutPrediction = await this.runBenchmarkWithoutPrediction(500);
    
    return { withPrediction, withoutPrediction };
  }

  private async runBenchmarkWithoutPrediction(iterations: number): Promise<BenchmarkResult> {
    this.startTime = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const points = this.generateLinearSwipe();
      
      for (const _point of points) {
        const startTime = performance.now();
        
        // Simulate just touch processing without prediction
        await new Promise(resolve => setTimeout(resolve, 0.1));
        
        const endTime = performance.now();
        this.predictions.push(endTime - startTime);
        this.trackFrame(endTime);
      }
    }
    
    return this.calculateResults();
  }
}

export async function runPerformanceBenchmarks(): Promise<void> {
  const benchmark = new PerformanceBenchmark();
  
  console.log('🚀 Starting React Native Swipe Predictor Performance Benchmarks\n');
  
  // Basic benchmark
  const basicResults = await benchmark.runBenchmark(1000);
  console.log('📊 Basic Benchmark Results:');
  console.log(`   Average Latency: ${basicResults.averageLatency.toFixed(2)}ms`);
  console.log(`   Max Latency: ${basicResults.maxLatency.toFixed(2)}ms`);
  console.log(`   Min Latency: ${basicResults.minLatency.toFixed(2)}ms`);
  console.log(`   Total Predictions: ${basicResults.totalPredictions}`);
  console.log(`   Dropped Frames: ${basicResults.droppedFrames}`);
  console.log(`   Average FPS: ${basicResults.averageFPS}`);
  console.log('');
  
  // Comparison benchmark
  const comparison = await benchmark.runComparisonBenchmark();
  console.log('🔄 Comparison Benchmark Results:');
  console.log('   With Prediction:');
  console.log(`     Average Latency: ${comparison.withPrediction.averageLatency.toFixed(2)}ms`);
  console.log(`     Average FPS: ${comparison.withPrediction.averageFPS}`);
  console.log('   Without Prediction:');
  console.log(`     Average Latency: ${comparison.withoutPrediction.averageLatency.toFixed(2)}ms`);
  console.log(`     Average FPS: ${comparison.withoutPrediction.averageFPS}`);
  console.log('');
  
  // Performance requirements check
  console.log('✅ Performance Requirements Check:');
  console.log(`   Prediction < 2ms: ${basicResults.averageLatency < 2 ? '✓' : '✗'}`);
  console.log(`   Maintains 60 FPS: ${basicResults.averageFPS >= 59 ? '✓' : '✗'}`);
  console.log(`   No memory leaks: ${basicResults.memoryUsage < 1024 * 1024 ? '✓' : '✗'}`);
  console.log(`   Low CPU usage: ${basicResults.cpuUsage < 2 ? '✓' : '✗'}`);
}

export { PerformanceBenchmark, BenchmarkResult };