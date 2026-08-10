import { ImageBackground, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { ViewingStats } from '../api/viewings';
import { colors, radii, spacing } from '../design/tokens';

type Highlight = ViewingStats['highlights'][number];

export function ViewingHighlightCard({
  highlight,
  label = 'BIGGEST OBSESSION',
  style,
}: {
  highlight: Highlight;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const hours = Math.max(1, Math.round(highlight.minutes / 60));
  const countLabel = highlight.contentType === 'series'
    ? `${highlight.views} ${highlight.views === 1 ? 'episode' : 'episodes'}`
    : `${highlight.views} ${highlight.views === 1 ? 'view' : 'views'}`;
  const gradientId = `viewing-highlight-shade-${highlight.contentType}-${highlight.tmdbId}`;
  const copy = (
    <>
      <View style={styles.scrim} />
      <View pointerEvents="none" style={styles.gradientOverlay}>
        <Svg height="100%" preserveAspectRatio="none" viewBox="0 0 1 1" width="100%">
          <Defs>
            <SvgLinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="rgb(5, 6, 10)" stopOpacity={0.58} />
              <Stop offset="0.45" stopColor="rgb(5, 6, 10)" stopOpacity={0.48} />
              <Stop offset="0.72" stopColor="rgb(5, 6, 10)" stopOpacity={0.22} />
              <Stop offset="1" stopColor="rgb(5, 6, 10)" stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>
          <Rect fill={`url(#${gradientId})`} height="1" width="1" />
        </Svg>
      </View>
      <View style={styles.copy}>
        <Text style={styles.kicker}>{label}</Text>
        <Text numberOfLines={2} style={styles.title}>{highlight.title}</Text>
        <Text style={styles.meta}>
          <Text style={styles.metaAccent}>{countLabel}</Text>
          {`  ·  ${hours} ${hours === 1 ? 'hour' : 'hours'}`}
        </Text>
      </View>
    </>
  );

  return highlight.artworkUrl ? (
    <ImageBackground
      accessibilityIgnoresInvertColors
      accessibilityLabel={`${highlight.title}, ${countLabel}`}
      imageStyle={styles.image}
      source={{ uri: highlight.artworkUrl }}
      style={[styles.card, style]}
    >
      {copy}
    </ImageBackground>
  ) : (
    <View accessibilityLabel={`${highlight.title}, ${countLabel}`} style={[styles.card, style]}>
      {copy}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: 'rgba(229, 91, 118, 0.28)',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    height: 158,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 350,
  },
  copy: {
    gap: 5,
    maxWidth: '62%',
    padding: spacing.lg,
  },
  image: {
    borderRadius: radii.md,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  kicker: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  metaAccent: {
    color: colors.accent,
    fontWeight: '900',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 10, 0.18)',
    borderRadius: radii.md,
  },
  title: {
    color: colors.text,
    fontFamily: 'Georgia',
    fontSize: 27,
    lineHeight: 29,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 8,
  },
});
