import { Pressable, PressableProps, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing } from '../design/tokens';

type ButtonVariant = 'danger' | 'primary' | 'secondary';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
};

export function Button({ disabled, label, variant = 'primary', ...pressableProps }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        variant === 'danger' ? styles.danger : null,
        variant === 'primary' ? styles.primary : null,
        variant === 'secondary' ? styles.secondary : null,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}
      {...pressableProps}
    >
      <Text style={[styles.label, variant === 'primary' || variant === 'danger' ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.48,
  },
  danger: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.danger,
  },
  label: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  primary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  primaryLabel: {
    color: colors.textOnAccent,
  },
  secondary: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
  },
  secondaryLabel: {
    color: colors.text,
  },
});
