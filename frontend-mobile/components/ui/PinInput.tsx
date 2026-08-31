// Custom PIN entry with numeric keypad (no system keyboard) and shake animation on error

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface PinInputProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: string;
  disabled?: boolean;
}

const SHAKE_DISTANCE = 10;
const SHAKE_DURATION = 60;

export default function PinInput({
  length = 4,
  onComplete,
  error,
  disabled = false,
}: PinInputProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Trigger shake animation when error changes to a truthy value
  useEffect(() => {
    if (error != null && error.length > 0) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: SHAKE_DISTANCE, duration: SHAKE_DURATION, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -SHAKE_DISTANCE, duration: SHAKE_DURATION, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: SHAKE_DISTANCE, duration: SHAKE_DURATION, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -SHAKE_DISTANCE, duration: SHAKE_DURATION, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: SHAKE_DURATION, useNativeDriver: true }),
      ]).start();
      // Clear digits after shake so user can retry
      setDigits([]);
    }
  }, [error, shakeAnim]);

  const handleDigitPress = useCallback(
    (digit: string) => {
      if (disabled) return;
      setDigits((prev) => {
        if (prev.length >= length) return prev;
        const next = [...prev, digit];
        if (next.length === length) {
          // Defer onComplete to avoid state update during render
          setTimeout(() => onComplete(next.join('')), 0);
        }
        return next;
      });
    },
    [disabled, length, onComplete],
  );

  const handleBackspace = useCallback(() => {
    if (disabled) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [disabled]);

  // Keypad layout: 1-9, empty, 0, backspace
  const keypadRows: (string | 'backspace' | null)[][] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [null, '0', 'backspace'],
  ];

  return (
    <View style={styles.container}>
      {/* PIN dots */}
      <Animated.View
        style={[styles.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
      >
        {Array.from({ length }, (_, i) => {
          const isFilled = i < digits.length;
          const hasError = error != null && error.length > 0;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                isFilled
                  ? (hasError ? styles.dotError : styles.dotFilled)
                  : styles.dotEmpty,
              ]}
            />
          );
        })}
      </Animated.View>

      {/* Error message */}
      {error != null && error.length > 0 && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Numeric keypad */}
      <View style={styles.keypad}>
        {keypadRows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.keypadRow}>
            {row.map((key, colIndex) => {
              if (key === null) {
                return <View key={colIndex} style={styles.keypadKey} />;
              }

              if (key === 'backspace') {
                return (
                  <Pressable
                    key={colIndex}
                    onPress={handleBackspace}
                    disabled={disabled || digits.length === 0}
                    style={({ pressed }) => [
                      styles.keypadKey,
                      pressed && styles.keypadKeyPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Effacer"
                  >
                    <Ionicons
                      name="backspace-outline"
                      size={26}
                      color={disabled || digits.length === 0 ? Colors.disabled : Colors.text}
                    />
                  </Pressable>
                );
              }

              return (
                <Pressable
                  key={colIndex}
                  onPress={() => handleDigitPress(key)}
                  disabled={disabled || digits.length >= length}
                  style={({ pressed }) => [
                    styles.keypadKey,
                    pressed && styles.keypadKeyPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={key}
                >
                  <Text
                    style={[
                      styles.keypadDigit,
                      disabled && styles.keypadDigitDisabled,
                    ]}
                  >
                    {key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const DOT_SIZE = 16;
const KEY_SIZE = 76;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 12,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: `${Colors.primary}4D`,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderWidth: 0,
  },
  dotError: {
    backgroundColor: Colors.error,
    borderWidth: 0,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginBottom: 8,
    textAlign: 'center',
  },
  keypad: {
    marginTop: 16,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  keypadKey: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
    borderRadius: KEY_SIZE / 2,
    minHeight: 48,
    minWidth: 48,
  },
  keypadKeyPressed: {
    backgroundColor: Colors.borderLight,
  },
  keypadDigit: {
    fontSize: 30,
    fontWeight: '600',
    color: Colors.text,
  },
  keypadDigitDisabled: {
    color: Colors.disabled,
  },
});
