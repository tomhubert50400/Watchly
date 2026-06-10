import { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type EmptyStateProps = PropsWithChildren<{
  body: string;
  title: string;
}>;

export function EmptyState({ body, children, title }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.marker} />
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {children ? <View style={styles.action}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  container: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  marker: {
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
    height: 42,
    marginRight: spacing.md,
    opacity: 0.92,
    width: 6,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
