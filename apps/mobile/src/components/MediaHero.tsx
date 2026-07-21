import { ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, shadows, spacing, typography } from '../design/tokens';
import { mediaHeroFadeColors } from './mediaHeroGradient';
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
        <View pointerEvents="none" style={styles.backdropFade}>
          {mediaHeroFadeColors.map((backgroundColor) => (
            <View key={backgroundColor} style={[styles.fadeBand, { backgroundColor }]} />
          ))}
        </View>
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
        </View>
      </View>
      {actions || actionAccessory ? (
        <View style={styles.actionBar}>
          <View style={styles.actions}>{actions}</View>
          {actionAccessory ? <View style={styles.accessory}>{actionAccessory}</View> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  accessory: {
    alignItems: 'center',
    alignSelf: 'stretch',
    justifyContent: 'flex-end',
  },
  actionBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 54,
    paddingHorizontal: spacing.xl,
  },
  actions: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  backdrop: {
    height: '100%',
    width: '100%',
  },
  backdropFrame: {
    backgroundColor: colors.panelSoft,
    height: 238,
    overflow: 'hidden',
  },
  backdropPlaceholder: {
    backgroundColor: colors.panelSoft,
    flex: 1,
  },
  backdropFade: {
    bottom: 0,
    height: 158,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: {
    marginBottom: spacing.sm,
  },
  copy: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
    paddingBottom: spacing.sm,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accentText,
    marginBottom: spacing.xs,
  },
  fadeBand: {
    flex: 1,
  },
  identityRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: -55,
    paddingHorizontal: spacing.xl,
  },
  poster: {
    ...shadows.raised,
    height: 156,
    width: 104,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '800',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
});
