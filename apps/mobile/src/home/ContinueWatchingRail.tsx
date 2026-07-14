import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';
import { resolveContinueWatchingLayout } from './continueWatchingLayout';
import type { HomeProgressItem } from './homeData';

type ContinueWatchingRailProps = {
  items: HomeProgressItem[];
  onOpen: (item: HomeProgressItem) => void;
};

export function ContinueWatchingRail({ items, onOpen }: ContinueWatchingRailProps) {
  const { fontScale } = useWindowDimensions();
  const layout = resolveContinueWatchingLayout(fontScale);

  return (
    <ScrollView
      contentContainerStyle={styles.rail}
      horizontal
      nestedScrollEnabled
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => (
        <Pressable
          accessibilityLabel={`Continue ${item.seriesTitle}, season ${item.seasonNumber}, episode ${item.episodeNumber}, ${item.episodeTitle}`}
          accessibilityRole="button"
          key={`${item.seriesTmdbId}:${item.seasonNumber}:${item.episodeNumber}`}
          onPress={() => onOpen(item)}
          style={({ pressed }) => [styles.card, { width: layout.cardWidth }, pressed ? styles.pressed : null]}
        >
          {item.backdropUrl ? (
            <ImageBackground
              accessibilityIgnoresInvertColors
              imageStyle={styles.image}
              source={{ uri: item.backdropUrl }}
              style={[styles.artwork, { minHeight: layout.artworkMinHeight }]}
            >
              <View style={styles.scrim} />
              <CardCopy item={item} layout={layout} />
            </ImageBackground>
          ) : (
            <View style={[styles.artwork, styles.placeholder, { minHeight: layout.artworkMinHeight }]}>
              <CardCopy item={item} layout={layout} />
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CardCopy({
  item,
  layout,
}: {
  item: HomeProgressItem;
  layout: ReturnType<typeof resolveContinueWatchingLayout>;
}) {
  return (
    <View style={styles.copy}>
      <Text numberOfLines={layout.titleNumberOfLines} style={styles.title}>{item.seriesTitle}</Text>
      <Text numberOfLines={layout.metaNumberOfLines} style={styles.meta}>
        S{item.seasonNumber} E{item.episodeNumber} · {item.episodeTitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  copy: {
    padding: spacing.md,
    paddingTop: spacing.xxl,
  },
  image: {
    borderRadius: radii.md,
  },
  meta: {
    ...typography.meta,
    color: colors.textMuted,
    marginTop: 2,
  },
  placeholder: {
    backgroundColor: colors.panelElevated,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.99 }],
  },
  rail: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  scrim: {
    backgroundColor: 'rgba(5, 7, 12, 0.42)',
    ...StyleSheet.absoluteFillObject,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
