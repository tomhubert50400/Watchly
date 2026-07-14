import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, touchTargets, typography } from '../design/tokens';

type SectionHeaderProps = {
  actionLabel?: string;
  onActionPress?: () => void;
  subtitle?: string;
  title: string;
};

export function SectionHeader({ actionLabel, onActionPress, subtitle, title }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onActionPress ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={4}
          onPress={onActionPress}
          style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
        >
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingLeft: spacing.md,
  },
  actionLabel: {
    ...typography.meta,
    color: colors.accentText,
  },
  container: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: touchTargets.min,
  },
  copy: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.72,
  },
  subtitle: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
