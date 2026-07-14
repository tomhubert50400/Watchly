import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, PressableProps, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets } from '../design/tokens';

type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary';

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  compact?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  label: string;
  loading?: boolean;
  variant?: ButtonVariant;
};

export function Button({ compact = false, disabled, fullWidth = false, icon, label, loading = false, variant = 'primary', ...pressableProps }: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : null,
        fullWidth ? styles.fullWidth : null,
        variant === 'danger' ? styles.danger : null,
        variant === 'ghost' ? styles.ghost : null,
        variant === 'primary' ? styles.primary : null,
        variant === 'secondary' ? styles.secondary : null,
        pressed && !isDisabled ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
      ]}
      {...pressableProps}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? colors.textOnAccent : colors.textMuted} size="small" /> : icon}
      <Text
        style={[
          styles.label,
          variant === 'danger' ? styles.dangerLabel : null,
          variant === 'ghost' ? styles.ghostLabel : null,
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
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  compact: {
    paddingHorizontal: spacing.md,
  },
  danger: {
    backgroundColor: colors.dangerBackground,
    borderColor: colors.dangerBorder,
  },
  dangerLabel: {
    color: colors.danger,
  },
  disabled: {
    opacity: 0.48,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  ghostLabel: {
    color: colors.textMuted,
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
