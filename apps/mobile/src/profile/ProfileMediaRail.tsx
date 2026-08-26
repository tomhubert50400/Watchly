import { memo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { MediaPoster } from '../components/MediaPoster';
import { SectionHeader } from '../components/SectionHeader';
import { colors, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { getProfileMediaStatus } from './profileMediaModel';
import {
  getProfileMediaDisplayTitle,
  useHydratedProfileMediaItem,
} from './useHydratedProfileMediaItems';

const PROFILE_MEDIA_CARD_WIDTH = 104;

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
        <FlatList
          alwaysBounceVertical={false}
          contentContainerStyle={styles.rail}
          data={items}
          directionalLockEnabled
          getItemLayout={(_data, index) => ({
            index,
            length: PROFILE_MEDIA_CARD_WIDTH + spacing.sm,
            offset: (PROFILE_MEDIA_CARD_WIDTH + spacing.sm) * index,
          })}
          horizontal
          initialNumToRender={4}
          ItemSeparatorComponent={ProfileMediaSeparator}
          keyExtractor={(item) => item.key}
          maxToRenderPerBatch={4}
          renderItem={({ item }) => (
            <ProfileMediaPoster item={item} onOpen={onOpen} />
          )}
          showsHorizontalScrollIndicator={false}
          windowSize={3}
        />
      ) : (
        <Text style={styles.empty}>{emptyLabel}</Text>
      )}
    </View>
  );
}

const ProfileMediaPoster = memo(function ProfileMediaPoster({
  item,
  onOpen,
}: {
  item: LibraryMediaItem;
  onOpen: (item: LibraryMediaItem) => void;
}) {
  const hydratedItem = useHydratedProfileMediaItem(item);
  const meta = getMediaMeta(hydratedItem);
  const title = getProfileMediaDisplayTitle(hydratedItem);

  return (
    <Pressable
      accessibilityLabel={`Open ${title}, ${meta}`}
      accessibilityRole="button"
      onPress={() => onOpen(hydratedItem)}
      style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}
    >
      <MediaPoster
        accessibilityLabel={`${title} poster`}
        posterUrl={hydratedItem.posterUrl}
        style={styles.poster}
      />
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <Text numberOfLines={1} style={styles.meta}>{meta}</Text>
    </Pressable>
  );
});

function ProfileMediaSeparator() {
  return <View style={styles.separator} />;
}

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
    width: PROFILE_MEDIA_CARD_WIDTH,
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
    width: PROFILE_MEDIA_CARD_WIDTH,
  },
  rail: {
    paddingRight: spacing.xl,
  },
  separator: {
    width: spacing.sm,
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
