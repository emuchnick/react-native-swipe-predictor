import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View } from 'react-native';

import BasicDemo from './screens/BasicDemo';
import CardsDemo from './screens/CardsDemo';
import GalleryDemo from './screens/GalleryDemo';
import GameDemo from './screens/GameDemo';

/**
 * Create the bottom tab navigator instance
 */
const Tab = createBottomTabNavigator();

/**
 * Main application component that sets up navigation and theming
 * 
 * @description
 * This is the root component of the SwipePredictor example app.
 * It configures:
 * - Gesture handler root view for gesture recognition
 * - Safe area provider for device-specific insets
 * - Navigation container with bottom tab navigation
 * - Dark theme styling throughout the app
 * - Four demo screens showcasing different use cases
 * 
 * @returns {JSX.Element} The configured app with navigation
 * 
 * @example
 * // This component is the entry point, registered in index.ts:
 * AppRegistry.registerComponent('main', () => App);
 */
export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Tab.Navigator
            screenOptions={{
              tabBarStyle: {
                backgroundColor: '#1C1C1E',
                borderTopColor: '#2C2C2E',
              },
              tabBarActiveTintColor: '#007AFF',
              tabBarInactiveTintColor: '#8E8E93',
              headerStyle: {
                backgroundColor: '#1C1C1E',
                elevation: 0,
                shadowOpacity: 0,
                borderBottomColor: '#2C2C2E',
                borderBottomWidth: 1,
              },
              headerTintColor: '#FFFFFF',
              headerTitleStyle: {
                fontWeight: '600',
              },
            }}
          >
            <Tab.Screen
              name="Basic"
              component={BasicDemo}
              options={{
                title: 'Basic Demo',
                tabBarIcon: ({ color }) => (
                  <View style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 4 }} />
                ),
              }}
            />
            <Tab.Screen
              name="Cards"
              component={CardsDemo}
              options={{
                title: 'Cards Demo',
                tabBarIcon: ({ color }) => (
                  <View style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 12 }} />
                ),
              }}
            />
            <Tab.Screen
              name="Gallery"
              component={GalleryDemo}
              options={{
                title: 'Gallery Demo',
                tabBarIcon: ({ color }) => (
                  <View style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 2 }} />
                ),
              }}
            />
            <Tab.Screen
              name="Game"
              component={GameDemo}
              options={{
                title: 'Game Physics',
                tabBarIcon: ({ color }) => (
                  <View style={{ width: 24, height: 24, backgroundColor: color, borderRadius: 6, transform: [{ rotate: '45deg' }] }} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
