import React, { useState } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { runPerformanceBenchmarks } from '../src/benchmarks/performance';

interface BenchmarkResults {
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  totalPredictions: number;
  droppedFrames: number;
  averageFPS: number;
}

export default function BenchmarksScreen() {
  const [isRunning, setIsRunning] = useState(false);
  const [_results, _setResults] = useState<BenchmarkResults | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const runBenchmarks = async () => {
    setIsRunning(true);
    setLogs([]);
    _setResults(null);

    // Capture console.log output
    const originalLog = console.log;
    const capturedLogs: string[] = [];
    
    console.log = (...args: unknown[]) => {
      const message = args.join(' ');
      capturedLogs.push(message);
      setLogs([...capturedLogs]);
      originalLog(...args);
    };

    try {
      await runPerformanceBenchmarks();
    } catch (error) {
      capturedLogs.push(`Error: ${error}`);
      setLogs([...capturedLogs]);
    } finally {
      console.log = originalLog;
      setIsRunning(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Performance Benchmarks</Text>
        <Text style={styles.subtitle}>
          Test the swipe predictor performance
        </Text>
      </View>

      <View style={styles.controls}>
        <Button
          title="Run Benchmarks"
          onPress={runBenchmarks}
          disabled={isRunning}
        />
      </View>

      {isRunning && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Running benchmarks...</Text>
        </View>
      )}

      {logs.length > 0 && (
        <View style={styles.logsContainer}>
          <Text style={styles.logsTitle}>Benchmark Output:</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logLine}>
              {log}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  controls: {
    padding: 20,
  },
  loading: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  logsContainer: {
    margin: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  logsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  logLine: {
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 5,
    color: '#333',
  },
});