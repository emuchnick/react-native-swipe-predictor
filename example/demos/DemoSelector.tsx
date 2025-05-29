import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
} from 'react-native';

export type DemoType = 'basic' | 'instagram' | 'tinder' | 'gallery';

interface Demo {
  id: DemoType;
  title: string;
  description: string;
  icon: string;
}

const DEMOS: Demo[] = [
  {
    id: 'basic',
    title: 'Basic Demo',
    description: 'Simple swipeable card with prediction visualization',
    icon: '📱',
  },
  {
    id: 'instagram',
    title: 'Instagram Stories',
    description: 'Story viewer with predictive content preloading',
    icon: '📸',
  },
  {
    id: 'tinder',
    title: 'Tinder Cards',
    description: 'Dating app cards with like/dislike/superlike predictions',
    icon: '💝',
  },
  {
    id: 'gallery',
    title: 'Image Gallery',
    description: 'High-res image browser with smart preloading',
    icon: '🖼️',
  },
];

interface DemoSelectorProps {
  onSelectDemo: (demo: DemoType) => void;
}

export default function DemoSelector({ onSelectDemo }: DemoSelectorProps) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>React Native Swipe Predictor</Text>
        <Text style={styles.subtitle}>Choose a demo to explore</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {DEMOS.map((demo) => (
          <TouchableOpacity
            key={demo.id}
            style={styles.demoCard}
            onPress={() => onSelectDemo(demo.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.demoIcon}>{demo.icon}</Text>
            <View style={styles.demoInfo}>
              <Text style={styles.demoTitle}>{demo.title}</Text>
              <Text style={styles.demoDescription}>{demo.description}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>✨ Key Features</Text>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Physics-based prediction using Rust
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Zero-latency animations
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              Predictive content loading
            </Text>
          </View>
          <View style={styles.featureItem}>
            <Text style={styles.featureBullet}>•</Text>
            <Text style={styles.featureText}>
              60-120 FPS performance
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  demoIcon: {
    fontSize: 40,
    marginRight: 16,
  },
  demoInfo: {
    flex: 1,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  demoDescription: {
    fontSize: 14,
    color: '#666',
  },
  arrow: {
    fontSize: 24,
    color: '#007AFF',
    marginLeft: 16,
  },
  features: {
    marginTop: 30,
    padding: 20,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  featureItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  featureBullet: {
    fontSize: 16,
    color: '#007AFF',
    marginRight: 10,
  },
  featureText: {
    fontSize: 16,
    color: '#666',
    flex: 1,
  },
});