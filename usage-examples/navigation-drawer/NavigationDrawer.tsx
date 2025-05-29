import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Dimensions,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  runOnJS,
} from "react-native-reanimated";
import { useSwipePredictor } from "../../src"; //This would be replaced with 'react-native-swipe-predictor' in your code

const { width: screenWidth } = Dimensions.get("window");
const DRAWER_WIDTH = screenWidth * 0.8;
const VELOCITY_THRESHOLD = 500;

const menuItems = [
  { id: "1", title: "Home", icon: "🏠" },
  { id: "2", title: "Profile", icon: "👤" },
  { id: "3", title: "Messages", icon: "💬" },
  { id: "4", title: "Settings", icon: "⚙️" },
  { id: "5", title: "Help", icon: "❓" },
  { id: "6", title: "Logout", icon: "🚪" },
];

function NavigationDrawer() {
  const translateX = useSharedValue(-DRAWER_WIDTH);
  const [isOpen, setIsOpen] = useState(false);
  const [willOpen, setWillOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState("1");

  const { onTouchStart, onTouchMove, onTouchEnd, prediction } =
    useSwipePredictor({
      confidenceThreshold: 0.5,
      updateInterval: 8, // 120fps for smoother drawer
      physics: "ios",
      onPrediction: ({ x, confidence }) => {
        "worklet";

        if (confidence > 0.5) {
          const currentX = translateX.value;
          const predictedFinalX = currentX + x;

          // Predict if drawer will open or close
          const predictedOpen = predictedFinalX > -DRAWER_WIDTH / 2;
          runOnJS(setWillOpen)(predictedOpen);

          // Start animating toward predicted state with lower damping
          if (predictedOpen && currentX < 0) {
            translateX.value = withSpring(0, {
              damping: 20,
              stiffness: 90,
            });
          } else if (!predictedOpen && currentX > -DRAWER_WIDTH) {
            translateX.value = withSpring(-DRAWER_WIDTH, {
              damping: 20,
              stiffness: 90,
            });
          }
        }
      },
    });

  const gesture = Gesture.Pan()
    .onBegin(onTouchStart)
    .onUpdate((e) => {
      "worklet";

      // Only allow opening from left edge or closing when open
      const startedFromEdge = e.absoluteX < 30;
      const isClosing = isOpen && e.translationX < 0;

      if (startedFromEdge || isClosing) {
        const newX = isOpen
          ? Math.max(-DRAWER_WIDTH, Math.min(0, e.translationX))
          : Math.max(
              -DRAWER_WIDTH,
              Math.min(0, -DRAWER_WIDTH + e.translationX)
            );

        translateX.value = newX;
        runOnJS(onTouchMove)(e);
      }
    })
    .onEnd((e) => {
      "worklet";

      onTouchEnd(e);

      // Determine final state based on position and velocity
      const shouldOpen =
        translateX.value > -DRAWER_WIDTH / 2 ||
        e.velocityX > VELOCITY_THRESHOLD;

      translateX.value = withSpring(shouldOpen ? 0 : -DRAWER_WIDTH, {
        damping: 15,
        stiffness: 100,
      });

      runOnJS(setIsOpen)(shouldOpen);
      runOnJS(setWillOpen)(false);
    });

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-DRAWER_WIDTH, 0],
      [0, 0.5],
      "clamp"
    ),
    pointerEvents: translateX.value > -DRAWER_WIDTH + 10 ? "auto" : "none",
  }));

  const contentStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      translateX.value,
      [-DRAWER_WIDTH, 0],
      [1, 0.85],
      "clamp"
    );

    const translateXContent = interpolate(
      translateX.value,
      [-DRAWER_WIDTH, 0],
      [0, 60],
      "clamp"
    );

    return {
      transform: [{ scale }, { translateX: translateXContent }],
      borderRadius: interpolate(
        translateX.value,
        [-DRAWER_WIDTH, 0],
        [0, 20],
        "clamp"
      ),
    };
  });

  const openDrawer = () => {
    translateX.value = withSpring(0);
    setIsOpen(true);
  };

  const closeDrawer = () => {
    translateX.value = withSpring(-DRAWER_WIDTH);
    setIsOpen(false);
    setWillOpen(false);
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.container}>
        {/* Main Content */}
        <Animated.View style={[styles.content, contentStyle]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
              <Text style={styles.menuIcon}>☰</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Swipe from Edge →</Text>
          </View>

          <View style={styles.mainContent}>
            <Text style={styles.contentTitle}>Navigation Drawer Demo</Text>
            <Text style={styles.contentText}>
              Swipe from the left edge to open the drawer. The drawer predicts
              your intent and starts opening before you finish the gesture!
            </Text>

            {prediction && (
              <View style={styles.predictionInfo}>
                <Text style={styles.predictionTitle}>Prediction Active</Text>
                <Text style={styles.predictionText}>
                  Confidence: {(prediction.confidence * 100).toFixed(0)}%
                </Text>
                <Text style={styles.predictionText}>
                  Will {willOpen ? "open" : "close"} drawer
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={styles.backdropTouch}
            onPress={closeDrawer}
          />
        </Animated.View>

        {/* Drawer */}
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.drawer, drawerStyle]}>
            <View style={styles.drawerHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>👤</Text>
              </View>
              <Text style={styles.userName}>John Doe</Text>
              <Text style={styles.userEmail}>john.doe@example.com</Text>
            </View>

            <ScrollView style={styles.menuContainer}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    selectedItem === item.id && styles.selectedMenuItem,
                  ]}
                  onPress={() => {
                    setSelectedItem(item.id);
                    setTimeout(closeDrawer, 200);
                  }}
                >
                  <Text style={styles.menuIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.menuTitle,
                      selectedItem === item.id && styles.selectedMenuTitle,
                    ]}
                  >
                    {item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Swipe indicator */}
            <View style={styles.swipeIndicator}>
              <View
                style={[styles.swipeBar, willOpen && styles.swipeBarActive]}
              />
            </View>
          </Animated.View>
        </GestureDetector>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

export default function NavigationDrawerExample() {
  return <NavigationDrawer />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    backgroundColor: "white",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  menuButton: {
    padding: 8,
  },
  menuIcon: {
    fontSize: 24,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 16,
  },
  mainContent: {
    flex: 1,
    padding: 20,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  contentText: {
    fontSize: 16,
    color: "#666",
    lineHeight: 24,
  },
  predictionInfo: {
    marginTop: 40,
    padding: 16,
    backgroundColor: "#e3f2fd",
    borderRadius: 8,
  },
  predictionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  predictionText: {
    fontSize: 16,
    color: "#1976d2",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  backdropTouch: {
    flex: 1,
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  drawerHeader: {
    padding: 20,
    backgroundColor: "#1976d2",
    paddingTop: 60,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: {
    fontSize: 30,
  },
  userName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  menuContainer: {
    flex: 1,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  selectedMenuItem: {
    backgroundColor: "#e3f2fd",
  },
  menuTitle: {
    fontSize: 16,
    color: "#333",
    marginLeft: 16,
  },
  selectedMenuTitle: {
    color: "#1976d2",
    fontWeight: "bold",
  },
  swipeIndicator: {
    position: "absolute",
    right: 0,
    top: "50%",
    width: 4,
    height: 60,
    marginTop: -30,
    justifyContent: "center",
  },
  swipeBar: {
    width: 4,
    height: 60,
    backgroundColor: "#e0e0e0",
    borderRadius: 2,
  },
  swipeBarActive: {
    backgroundColor: "#1976d2",
  },
});
