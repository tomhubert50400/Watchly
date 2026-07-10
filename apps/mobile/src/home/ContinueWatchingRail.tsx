import { ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '../design/tokens';
import type { HomeProgressItem } from './homeData';

type ContinueWatchingRailProps = {
  items: HomeProgressItem[];
  onOpen: (item: HomeProgressItem) => void;
};

export function ContinueWatchingRail({ items, onOpen }: ContinueWatchingRailProps) {
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
          style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
        >
          {item.backdropUrl ? (
            <ImageBackground
              accessibilityIgnoresInvertColors
              imageStyle={styles.image}
              source={{ uri: item.backdropUrl }}
              style={styles.artwork}
            >
              <View style={styles.scrim} />
              <CardCopy item={item} />
            </ImageBackground>
          ) : (
            <View style={[styles.artwork, styles.placeholder]}>
              <CardCopy item={item} />
            </View>
          )}
        </Pressable>
      ))}
    </ScrollView>
  );
}

function CardCopy({ item }: { item: HomeProgressItem }) {
  return (
    <View style={styles.copy}>
      <Text numberOfLines={1} style={styles.title}>{item.seriesTitle}</Text>
      <Text numberOfLines={1} style={styles.meta}>
        S{item.seasonNumber} E{item.episodeNumber} · {item.episodeTitle}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    height: 146,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    width: 266,
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
