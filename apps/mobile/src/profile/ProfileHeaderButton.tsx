import type { ReactNode } from 'react';
import { Pressable, StyleSheet } from 'react-native';

export function ProfileHeaderButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
}: {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 32,
  },
  disabled: {
    opacity: 0.42,
  },
  pressed: {
    opacity: 0.58,
  },
});
