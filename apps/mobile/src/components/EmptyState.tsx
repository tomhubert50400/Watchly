import { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';

type EmptyStateProps = PropsWithChildren<{
  body: string;
  illustration?: ReactNode;
  title: string;
}>;

export function EmptyState({ body, children, illustration, title }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {illustration ?? (
        <View accessibilityElementsHidden style={styles.artwork}>
          <View style={[styles.poster, styles.posterLeft]} />
          <View style={[styles.poster, styles.posterCenter]} />
          <View style={[styles.poster, styles.posterRight]} />
          <Text style={styles.mark}>＋</Text>
        </View>
      )}
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {children ? <View style={styles.action}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    minHeight: touchTargets.min,
  },
  artwork: {
    height: 132,
    marginBottom: spacing.lg,
    position: 'relative',
    width: 174,
  },
  body: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    maxWidth: 320,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxxl,
  },
  mark: {
    color: colors.accentText,
    fontSize: 27,
    fontWeight: '700',
    left: 72,
    position: 'absolute',
    top: 46,
    zIndex: 4,
  },
  poster: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 120,
    position: 'absolute',
    top: 4,
    width: 78,
  },
  posterCenter: {
    backgroundColor: colors.panel,
    borderColor: colors.accentBorder,
    left: 48,
    top: 0,
    zIndex: 2,
  },
  posterLeft: {
    left: 12,
    transform: [{ rotate: '-10deg' }],
  },
  posterRight: {
    right: 12,
    transform: [{ rotate: '10deg' }],
  },
  title: {
    ...typography.title,
    color: colors.text,
    textAlign: 'center',
  },
});
