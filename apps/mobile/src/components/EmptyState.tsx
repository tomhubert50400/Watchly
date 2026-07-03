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
      <View style={styles.marker}>
        <View style={styles.markerCore} />
      </View>
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
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  container: {
    ...shadows.panel,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
  },
  marker: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 8,
  },
  markerCore: {
    backgroundColor: colors.accentText,
    borderRadius: radii.xs,
    height: 28,
    width: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
