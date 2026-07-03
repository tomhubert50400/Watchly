import { Pressable, PressableProps, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, touchTargets } from '../design/tokens';

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
      <Text
        style={[
          styles.label,
          variant === 'danger' ? styles.dangerLabel : null,
          variant === 'primary' ? styles.primaryLabel : null,
          variant === 'secondary' ? styles.secondaryLabel : null,
        ]}
      >
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
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  disabled: {
    opacity: 0.48,
  },
  danger: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  dangerLabel: {
    color: colors.danger,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  primary: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
  },
  primaryLabel: {
    color: colors.accentText,
  },
  secondary: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
  },
  secondaryLabel: {
    color: colors.text,
  },
});
