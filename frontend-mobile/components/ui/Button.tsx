// Pressable-based button with multiple variants and loading state

import React from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Colors } from '@/constants/colors';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { container: ViewStyle; text: TextStyle; pressedBg: string }> = {
  primary: {
    container: { backgroundColor: Colors.primary },
    text: { color: Colors.white },
    pressedBg: Colors.primaryDark,
  },
  secondary: {
    container: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
    text: { color: Colors.text },
    pressedBg: Colors.borderLight,
  },
  danger: {
    container: { backgroundColor: Colors.danger },
    text: { color: Colors.white },
    pressedBg: '#B91C1C',
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    text: { color: Colors.primary },
    pressedBg: Colors.primaryUltraLight,
  },
};

export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const variantStyle = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyle.container,
        fullWidth && styles.fullWidth,
        pressed && { backgroundColor: variantStyle.pressedBg },
        isDisabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'secondary' || variant === 'ghost' ? Colors.primary : Colors.white}
        />
      ) : (
        <>
          {icon != null && icon}
          <Text
            style={[
              styles.label,
              variantStyle.text,
              icon != null && styles.labelWithIcon,
              isDisabled && styles.disabledText,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  fullWidth: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelWithIcon: {
    marginLeft: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
});
