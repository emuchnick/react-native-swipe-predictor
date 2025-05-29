import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { usePredictiveCards, getCardVisualProps } from 'react-native-swipe-predictor';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

// Mock profile data
const PROFILES = [
  {
    id: 1,
    name: 'Emma',
    age: 28,
    image: 'https://picsum.photos/400/600?random=10',
    bio: 'Love hiking and photography',
    distance: '2 miles away',
  },
  {
    id: 2,
    name: 'James',
    age: 32,
    image: 'https://picsum.photos/400/600?random=11',
    bio: 'Coffee enthusiast ☕',
    distance: '5 miles away',
  },
  {
    id: 3,
    name: 'Sophia',
    age: 26,
    image: 'https://picsum.photos/400/600?random=12',
    bio: 'Yoga instructor & travel blogger',
    distance: '3 miles away',
  },
  {
    id: 4,
    name: 'Michael',
    age: 29,
    image: 'https://picsum.photos/400/600?random=13',
    bio: 'Foodie | Dog lover 🐕',
    distance: '7 miles away',
  },
  {
    id: 5,
    name: 'Isabella',
    age: 31,
    image: 'https://picsum.photos/400/600?random=14',
    bio: 'Artist & dreamer',
    distance: '4 miles away',
  },
];

function SwipeableCard({ profile, onSwipe, isTop }: {
  profile: typeof PROFILES[0];
  onSwipe: (action: 'like' | 'dislike' | 'superlike') => void;
  isTop: boolean;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  
  // Action indicators
  const likeOpacity = useSharedValue(0);
  const nopeOpacity = useSharedValue(0);
  const superlikeOpacity = useSharedValue(0);

  const { onTouchStart, onTouchMove, onTouchEnd, predictedAction } = usePredictiveCards({
    onActionPredicted: (action, confidence) => {
      'worklet';
      
      // Reset all indicators
      likeOpacity.value = withTiming(0, { duration: 100 });
      nopeOpacity.value = withTiming(0, { duration: 100 });
      superlikeOpacity.value = withTiming(0, { duration: 100 });
      
      // Show predicted action
      if (confidence > 0.65) {
        switch (action) {
          case 'like':
            likeOpacity.value = withTiming(confidence, { duration: 200 });
            rotation.value = withSpring(15, { damping: 15 });
            break;
          case 'dislike':
            nopeOpacity.value = withTiming(confidence, { duration: 200 });
            rotation.value = withSpring(-15, { damping: 15 });
            break;
          case 'superlike':
            superlikeOpacity.value = withTiming(confidence, { duration: 200 });
            scale.value = withSpring(1.05, { damping: 10 });
            translateY.value = withSpring(-20, { damping: 10 });
            break;
          default:
            rotation.value = withSpring(0, { damping: 15 });
            scale.value = withSpring(1, { damping: 10 });
        }
      }
    },
    horizontalThreshold: SCREEN_WIDTH * 0.35,
    verticalThreshold: -100,
    enableSuperlike: true,
  });

  const handleSwipeComplete = useCallback((action: 'like' | 'dislike' | 'superlike' | null) => {
    if (!action) {
      // Reset card position
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      rotation.value = withSpring(0);
      scale.value = withSpring(1);
      likeOpacity.value = withTiming(0);
      nopeOpacity.value = withTiming(0);
      superlikeOpacity.value = withTiming(0);
      return;
    }

    // Animate card off screen
    let targetX = 0;
    let targetY = 0;
    
    switch (action) {
      case 'like':
        targetX = SCREEN_WIDTH * 1.5;
        rotation.value = withTiming(30);
        break;
      case 'dislike':
        targetX = -SCREEN_WIDTH * 1.5;
        rotation.value = withTiming(-30);
        break;
      case 'superlike':
        targetY = -SCREEN_WIDTH * 1.5;
        scale.value = withTiming(1.2);
        break;
    }
    
    translateX.value = withTiming(targetX, { duration: 300 });
    translateY.value = withTiming(targetY, { duration: 300 });
    
    runOnJS(onSwipe)(action);
  }, [onSwipe]);

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onBegin(onTouchStart)
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      onTouchMove(e);
    })
    .onEnd((e) => {
      onTouchEnd(e);
      
      // Determine final action based on position
      const absX = Math.abs(e.translationX);
      const shouldSwipe = absX > SCREEN_WIDTH * 0.35 || e.translationY < -100;
      
      if (shouldSwipe) {
        if (e.translationY < -100) {
          runOnJS(handleSwipeComplete)('superlike');
        } else if (e.translationX > 0) {
          runOnJS(handleSwipeComplete)('like');
        } else {
          runOnJS(handleSwipeComplete)('dislike');
        }
      } else {
        runOnJS(handleSwipeComplete)(null);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  const likeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: likeOpacity.value,
  }));

  const nopeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: nopeOpacity.value,
  }));

  const superlikeIndicatorStyle = useAnimatedStyle(() => ({
    opacity: superlikeOpacity.value,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle]}>
        <Image source={{ uri: profile.image }} style={styles.cardImage} />
        
        {/* Profile info */}
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{profile.name}, {profile.age}</Text>
          <Text style={styles.bio}>{profile.bio}</Text>
          <Text style={styles.distance}>{profile.distance}</Text>
        </View>

        {/* Action indicators */}
        <Animated.View style={[styles.likeIndicator, likeIndicatorStyle]}>
          <Text style={styles.likeText}>LIKE</Text>
        </Animated.View>
        
        <Animated.View style={[styles.nopeIndicator, nopeIndicatorStyle]}>
          <Text style={styles.nopeText}>NOPE</Text>
        </Animated.View>
        
        <Animated.View style={[styles.superlikeIndicator, superlikeIndicatorStyle]}>
          <Text style={styles.superlikeText}>SUPER{'\n'}LIKE</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function TinderCardsDemo() {
  const [profiles, setProfiles] = useState(PROFILES);
  const [swipeHistory, setSwipeHistory] = useState<Array<{
    profile: typeof PROFILES[0];
    action: string;
  }>>([]);

  const handleSwipe = useCallback((action: 'like' | 'dislike' | 'superlike') => {
    setTimeout(() => {
      setProfiles(prev => {
        const [swiped, ...rest] = prev;
        setSwipeHistory(history => [...history, { profile: swiped, action }]);
        return rest;
      });
    }, 300);
  }, []);

  const resetCards = useCallback(() => {
    setProfiles(PROFILES);
    setSwipeHistory([]);
  }, []);

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tinder Cards Demo</Text>
        <Text style={styles.subtitle}>Swipe right to like, left to pass, up to super like!</Text>
      </View>

      {/* Card stack */}
      <View style={styles.cardContainer}>
        {profiles.length > 0 ? (
          profiles.slice(0, 3).reverse().map((profile, index) => (
            <View
              key={profile.id}
              style={[
                styles.cardWrapper,
                {
                  zIndex: profiles.length - index,
                  transform: [
                    { scale: 1 - index * 0.05 },
                    { translateY: index * 10 },
                  ],
                },
              ]}
            >
              <SwipeableCard
                profile={profile}
                onSwipe={handleSwipe}
                isTop={index === profiles.length - 1}
              />
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No more profiles!</Text>
            <TouchableOpacity style={styles.resetButton} onPress={resetCards}>
              <Text style={styles.resetButtonText}>Reset Cards</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Swipe history */}
      {swipeHistory.length > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>Recent Actions:</Text>
          <View style={styles.historyList}>
            {swipeHistory.slice(-3).reverse().map((item, index) => (
              <Text key={index} style={styles.historyItem}>
                {item.action === 'superlike' ? '💜' : item.action === 'like' ? '💚' : '❌'} {item.profile.name}
              </Text>
            ))}
          </View>
        </View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  cardContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardWrapper: {
    position: 'absolute',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  bio: {
    fontSize: 16,
    color: 'white',
    marginTop: 5,
  },
  distance: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  likeIndicator: {
    position: 'absolute',
    top: 50,
    left: 20,
    padding: 10,
    borderWidth: 4,
    borderColor: '#4FC3F7',
    borderRadius: 10,
    transform: [{ rotate: '-20deg' }],
  },
  likeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4FC3F7',
  },
  nopeIndicator: {
    position: 'absolute',
    top: 50,
    right: 20,
    padding: 10,
    borderWidth: 4,
    borderColor: '#FF6B6B',
    borderRadius: 10,
    transform: [{ rotate: '20deg' }],
  },
  nopeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  superlikeIndicator: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    padding: 10,
    borderWidth: 4,
    borderColor: '#65D36E',
    borderRadius: 10,
  },
  superlikeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#65D36E',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    color: '#666',
    marginBottom: 20,
  },
  resetButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  history: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  historyList: {
    flexDirection: 'column',
  },
  historyItem: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});