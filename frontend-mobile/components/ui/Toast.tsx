/**
 * Toast — Global non-blocking notification component.
 *
 * Rendered in root layout. Reads from toastStore.
 * Slides down from top, auto-dismisses, tappable to close.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToastStore } from '@/stores/toastStore';
import { Colors } from '@/constants/colors';

const ICON_MAP = {
  success: 'checkmark-circle' as const,
  error: 'close-circle' as const,
  info: 'information-circle' as const,
};

const BG_MAP = {
  success: Colors.success,
  error: Colors.danger,
  info: Colors.primary,
};

export default function Toast() {
  const { visible, message, type, duration } = useToastStore();
  const hideToast = useToastStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-100)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();

      // Auto-dismiss
      timerRef.current = setTimeout(() => {
        dismiss();
      }, duration);
    } else {
      translateY.setValue(-100);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, duration]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      hideToast();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: BG_MAP[type], paddingTop: insets.top + 8 },
        { transform: [{ translateY }] },
      ]}
    >
      <Pressable onPress={dismiss} style={styles.content}>
        <Ionicons name={ICON_MAP[type]} size={20} color={Colors.white} />
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  message: {
    flex: 1,
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
