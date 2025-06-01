import type { GestureResponderEvent } from 'react-native';
import type { 
  GestureUpdateEvent, 
  PanGestureHandlerEventPayload 
} from 'react-native-gesture-handler';

/**
 * Creates a mock GestureUpdateEvent from React Native touch coordinates
 * 
 * @description
 * This utility function bridges the gap between React Native's touch system
 * and react-native-gesture-handler's event format. It's necessary because
 * SwipePredictor expects gesture-handler events, but some demos use
 * React Native's built-in touch responder system.
 * 
 * The function creates a properly formatted GestureUpdateEvent with all
 * required properties, allowing seamless integration between the two
 * gesture systems.
 * 
 * @param {number} x - X coordinate (translation from touch start)
 * @param {number} y - Y coordinate (translation from touch start)
 * @returns {GestureUpdateEvent<PanGestureHandlerEventPayload>} Formatted gesture event
 * 
 * @example
 * // In a React Native responder callback:
 * onResponderMove={(e) => {
 *   const coords = getTouchCoordinates(e);
 *   if (coords) {
 *     const gestureEvent = createGestureEvent(
 *       coords.x - startX,
 *       coords.y - startY
 *     );
 *     onTouchMove(gestureEvent);
 *   }
 * }}
 */
export function createGestureEvent(x: number, y: number): GestureUpdateEvent<PanGestureHandlerEventPayload> {
  const event = {
    nativeEvent: {
      translationX: x,
      translationY: y,
      absoluteX: x,
      absoluteY: y,
      velocityX: 0,
      velocityY: 0,
      x,
      y,
      handlerTag: 1,
      numberOfPointers: 1,
      state: 4, // State.ACTIVE
      pointerType: 'touch',
    },
    // Add the event payload properties at the root level
    handlerTag: 1,
    numberOfPointers: 1,
    state: 4,
    pointerType: 'touch',
    x,
    y,
    absoluteX: x,
    absoluteY: y,
    translationX: x,
    translationY: y,
    velocityX: 0,
    velocityY: 0,
  };
  
  return event as unknown as GestureUpdateEvent<PanGestureHandlerEventPayload>;
}

/**
 * Extracts touch coordinates from a GestureResponderEvent
 * 
 * @description
 * Safely extracts the current touch position from a React Native
 * GestureResponderEvent. Handles cases where touch data might
 * not be available (e.g., touch ended).
 * 
 * @param {GestureResponderEvent} event - React Native touch event
 * @returns {{ x: number; y: number } | null} Touch coordinates or null if not available
 * 
 * @example
 * // In a touch handler:
 * const handleTouch = (event: GestureResponderEvent) => {
 *   const coords = getTouchCoordinates(event);
 *   if (coords) {
 *     console.log(`Touch at: ${coords.x}, ${coords.y}`);
 *   }
 * };
 */
export function getTouchCoordinates(event: GestureResponderEvent): { x: number; y: number } | null {
  const touch = event.nativeEvent.touches[0];
  if (!touch) return null;
  return { x: touch.pageX, y: touch.pageY };
}