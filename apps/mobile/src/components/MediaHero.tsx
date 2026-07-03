import { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { MediaPoster } from './MediaPoster';

type MediaHeroProps = {
  actionAccessory?: ReactNode;
  actions?: ReactNode;
  backdropUrl: string | null;
  children?: ReactNode;
  eyebrow?: string;
  posterAccessibilityLabel?: string;
  posterUrl: string | null;
  title: string;
};

export function MediaHero({
  actionAccessory,
  actions,
  backdropUrl,
  children,
  eyebrow,
  posterAccessibilityLabel,
  posterUrl,
  title,
}: MediaHeroProps) {
  return (
    <View style={styles.container}>
      <View style={styles.backdropFrame}>
        {backdropUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${title} backdrop`}
            source={{ uri: backdropUrl }}
            style={styles.backdrop}
          />
        ) : (
          <View style={styles.backdropPlaceholder} />
        )}
        <View style={styles.scrim} />
        <View style={styles.bottomShade} />
      </View>
      <View style={styles.identityRow}>
        <MediaPoster
          accessibilityLabel={posterAccessibilityLabel}
          posterUrl={posterUrl}
          style={styles.poster}
        />
        <View style={styles.copy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={styles.title}>{title}</Text>
          {children}
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {actionAccessory ? <View style={styles.accessory}>{actionAccessory}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    marginBottom: spacing.md,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  backdrop: {
    height: '100%',
    width: '100%',
  },
  backdropFrame: {
    backgroundColor: colors.panelSoft,
    height: 236,
    overflow: 'hidden',
  },
  backdropPlaceholder: {
    backgroundColor: colors.panelSoft,
    flex: 1,
  },
  bottomShade: {
    backgroundColor: colors.background,
    bottom: 0,
    height: 82,
    left: 0,
    opacity: 0.78,
    position: 'absolute',
    right: 0,
  },
  container: {
    marginBottom: spacing.xl,
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  identityRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -82,
    paddingHorizontal: spacing.xl,
  },
  poster: {
    ...shadows.raised,
    height: 198,
    width: 132,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 35,
  },
});
