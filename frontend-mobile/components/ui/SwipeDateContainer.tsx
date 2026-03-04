/**
 * SwipeDateContainer — wraps children with horizontal fling gesture detection.
 *
 * Swipe left  → onSwipeLeft  (next day)
 * Swipe right → onSwipeRight (previous day)
 *
 * Uses Gesture.Fling() which only fires on fast horizontal movements,
 * so it does NOT interfere with vertical FlatList scrolling.
 */

import React from 'react';
import { GestureDetector, Gesture, Directions } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

interface SwipeDateContainerProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: React.ReactNode;
}

export default function SwipeDateContainer({
  onSwipeLeft,
  onSwipeRight,
  children,
}: SwipeDateContainerProps) {
  const flingLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      runOnJS(onSwipeLeft)();
    });

  const flingRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      runOnJS(onSwipeRight)();
    });

  const gesture = Gesture.Simultaneous(flingLeft, flingRight);

  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}
