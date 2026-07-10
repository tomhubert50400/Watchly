import { memo } from 'react';
import { CalendarDays, Star } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogueSearchItem } from '../api/catalogue';
import { MediaPoster } from '../components/MediaPoster';
import { colors, spacing, typography } from '../design/tokens';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';

type ExploreMediaCardProps = {
  item: CatalogueSearchItem;
  layout?: 'grid' | 'rail';
  onPress: () => void;
  showReleaseAlert?: boolean;
};

export const ExploreMediaCard = memo(function ExploreMediaCard({
  item,
  layout = 'rail',
  onPress,
  showReleaseAlert = false,
}: ExploreMediaCardProps) {
  const metadata = formatMetadata(item, showReleaseAlert);

  return (
    <View style={[styles.shell, layout === 'grid' ? styles.gridShell : styles.railShell]}>
      <Pressable
        accessibilityLabel={`Open ${item.title}`}
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.mediaButton, pressed ? styles.pressed : null]}
      >
        <MediaPoster
          accessibilityLabel={`${item.title} poster`}
          posterUrl={item.posterUrl}
          style={[styles.poster, layout === 'grid' ? styles.gridPoster : styles.railPoster]}
        />
        <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
        {metadata ? (
          <View style={styles.metaRow}>
            {showReleaseAlert ? (
              <CalendarDays color={colors.textSubtle} size={13} strokeWidth={2} />
            ) : item.voteAverage !== null ? (
              <Star color={colors.rating} fill={colors.rating} size={13} strokeWidth={2} />
            ) : null}
            <Text numberOfLines={1} style={styles.meta}>{metadata}</Text>
          </View>
        ) : null}
      </Pressable>
      {showReleaseAlert && item.mediaType === 'movie' ? (
        <View style={styles.alert}>
          <ReleaseAlertControl contentType="movie" tmdbId={item.tmdbId} />
        </View>
      ) : null}
    </View>
  );
});

function formatMetadata(item: CatalogueSearchItem, showReleaseAlert: boolean) {
  if (showReleaseAlert) {
    return formatReleaseDate(item.releaseDate) ?? 'Date to be announced';
  }

  const year = item.releaseDate?.match(/^\d{4}/)?.[0] ?? null;
  const rating = item.voteAverage === null ? null : `TMDB ${item.voteAverage.toFixed(1)}/10`;

  return [rating, year].filter(Boolean).join(' · ');
}

function formatReleaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

const styles = StyleSheet.create({
  alert: {
    position: 'absolute',
    right: spacing.xs,
    top: spacing.xs,
  },
  gridPoster: {
    aspectRatio: 2 / 3,
    width: '100%',
  },
  gridShell: {
    flexBasis: '47%',
    flexGrow: 1,
    maxWidth: '50%',
  },
  mediaButton: {
    minWidth: 0,
  },
  meta: {
    ...typography.meta,
    color: colors.textSubtle,
    flexShrink: 1,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: spacing.xs,
  },
  poster: {
    width: '100%',
  },
  pressed: {
    opacity: 0.76,
    transform: [{ scale: 0.99 }],
  },
  railPoster: {
    height: 190,
  },
  railShell: {
    width: 126,
  },
  shell: {
    position: 'relative',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
