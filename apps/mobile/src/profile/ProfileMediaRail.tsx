import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MediaPoster } from '../components/MediaPoster';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { getProfileMediaStatus } from './profileMediaModel';

type ProfileMediaRailProps = {
  emptyLabel: string;
  items: readonly LibraryMediaItem[];
  onOpen: (item: LibraryMediaItem) => void;
  onViewAll?: () => void;
  title: string;
};

export function ProfileMediaRail({
  emptyLabel,
  items,
  onOpen,
  onViewAll,
  title,
}: ProfileMediaRailProps) {
  return (
    <View style={styles.section}>
      <SectionHeader
        actionAccessibilityLabel={onViewAll ? `View all ${title.toLowerCase()}` : undefined}
        actionLabel={onViewAll ? 'View all' : undefined}
        onActionPress={onViewAll}
        title={title}
      />
      {items.length ? (
        <ScrollView
          alwaysBounceVertical={false}
          contentContainerStyle={styles.rail}
          directionalLockEnabled
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {items.map((item) => (
            <ProfileMediaPoster item={item} key={item.key} onPress={() => onOpen(item)} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const ProfileMediaPoster = memo(function ProfileMediaPoster({
  item,
  onPress,
}: {
  item: LibraryMediaItem;
  onPress: () => void;
}) {
  const meta = getMediaMeta(item);

  return (
    <Pressable
      accessibilityLabel={`Open ${item.title}, ${meta}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <MediaPoster
        accessibilityLabel={`${item.title} poster`}
        posterUrl={item.posterUrl}
        style={styles.poster}
      />
      <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
      <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
    </Pressable>
  );
});

function getMediaMeta(item: LibraryMediaItem) {
  const status = getProfileMediaStatus(item);

  if (status === 'completed') return 'Completed';
  if (status === 'inProgress') {
    if (item.contentType === 'series' && item.watchedEpisodeCount > 0) {
      return item.numberOfEpisodes
        ? `${item.watchedEpisodeCount}/${item.numberOfEpisodes} watched`
        : `${item.watchedEpisodeCount} watched`;
    }
    return 'In progress';
  }
  if (item.favorite && item.hasReleaseAlert) return 'Favorite · Alert';
  if (item.favorite) return 'Favorite';
  return 'Release alert';
}

const styles = StyleSheet.create({
  card: {
    width: 104,
  },
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  empty: {
    ...typography.body,
    color: colors.textSubtle,
    paddingBottom: spacing.sm,
  },
  meta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  poster: {
    height: 156,
    width: 104,
  },
  rail: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  section: {
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.xs,
  },
});
