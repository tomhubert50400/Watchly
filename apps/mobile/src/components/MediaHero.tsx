import { ReactNode } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { colors, spacing } from '../design/tokens';
import { mediaHeroGradientStops } from './mediaHeroGradient';

type MediaHeroProps = {
  actionAccessory?: ReactNode;
  actions?: ReactNode;
  backdropUrl: string | null;
  children?: ReactNode;
  logoAspectRatio?: number | null;
  logoUrl?: string | null;
  posterUrl: string | null;
  title: string;
};

export function MediaHero({
  actionAccessory,
  actions,
  backdropUrl,
  children,
  logoAspectRatio,
  logoUrl,
  posterUrl,
  title,
}: MediaHeroProps) {
  const { width } = useWindowDimensions();
  const artworkUrl = backdropUrl ?? posterUrl;
  const heroHeight = Math.min(Math.max(width * 1.08, 390), 480);

  return (
    <View style={styles.container}>
      <View style={[styles.backdropFrame, { height: heroHeight }]}>
        {artworkUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${title} artwork`}
            resizeMode="cover"
            source={{ uri: artworkUrl }}
            style={styles.backdrop}
          />
        ) : (
          <View style={styles.backdropPlaceholder} />
        )}
        <View style={styles.scrim} />
        <View style={styles.tint} />
        <View pointerEvents="none" style={styles.backdropFade}>
          <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" width="100%">
            <Defs>
              <SvgLinearGradient id="mediaHeroFade" x1="0" x2="0" y1="0" y2="1">
                {mediaHeroGradientStops.map(({ offset, opacity }) => (
                  <Stop
                    key={offset}
                    offset={offset}
                    stopColor={colors.background}
                    stopOpacity={opacity}
                  />
                ))}
              </SvgLinearGradient>
            </Defs>
            <Rect fill="url(#mediaHeroFade)" height="1" width="1" />
          </Svg>
        </View>
        <View style={styles.identity}>
          <View style={styles.copy}>
            {logoUrl ? (
              <View
                accessibilityLabel={title}
                accessibilityRole="header"
                accessible
                style={styles.logoFrame}
              >
                <Image
                  accessibilityIgnoresInvertColors
                  accessible={false}
                  resizeMode="contain"
                  source={{ uri: logoUrl }}
                  style={[styles.logo, { aspectRatio: logoAspectRatio ?? 3 }]}
                />
              </View>
            ) : (
              <Text
                accessibilityRole="header"
                minimumFontScale={0.72}
                numberOfLines={2}
                style={styles.title}
              >
                {title}
              </Text>
            )}
            {children}
          </View>
        </View>
      </View>
      {actions || actionAccessory ? (
        <View style={styles.actionBar}>
          <View pointerEvents="none" style={styles.actionBarFade}>
            <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" width="100%">
              <Defs>
                <SvgLinearGradient id="mediaHeroActionFade" x1="0" x2="0" y1="0" y2="1">
                  <Stop offset="0" stopColor={colors.background} stopOpacity={1} />
                  <Stop offset="0.48" stopColor={colors.background} stopOpacity={0.72} />
                  <Stop offset="1" stopColor={colors.background} stopOpacity={0} />
                </SvgLinearGradient>
              </Defs>
              <Rect fill="url(#mediaHeroActionFade)" height="1" width="1" />
            </Svg>
          </View>
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
    justifyContent: 'center',
  },
  actionBar: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 60,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  actionBarFade: {
    ...StyleSheet.absoluteFillObject,
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
    overflow: 'hidden',
  },
  backdropPlaceholder: {
    backgroundColor: colors.panelSoft,
    flex: 1,
  },
  backdropFade: {
    bottom: -1,
    height: 260,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: {
    backgroundColor: 'transparent',
    marginBottom: spacing.xs,
  },
  copy: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 0,
    width: '100%',
  },
  identity: {
    alignItems: 'center',
    bottom: spacing.lg,
    left: spacing.xl,
    position: 'absolute',
    right: spacing.xl,
  },
  logo: {
    height: '100%',
    maxWidth: '100%',
  },
  logoFrame: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 86,
    maxWidth: 330,
    width: '100%',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 12, 19, 0.24)',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.accentSoft,
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 44,
    textAlign: 'center',
  },
});
