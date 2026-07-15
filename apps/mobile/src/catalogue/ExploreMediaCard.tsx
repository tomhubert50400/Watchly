import { memo } from 'react';
import { CalendarDays } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CatalogueSearchItem } from '../api/catalogue';
import { MediaPoster } from '../components/MediaPoster';
import { colors, spacing, typography } from '../design/tokens';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { CatalogueRating } from './CatalogueRating';

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
  const releaseMetadata = showReleaseAlert
    ? formatReleaseDate(item.releaseDate) ?? 'Date to be announced'
    : null;
  const year = showReleaseAlert ? null : item.releaseDate?.match(/^\d{4}/)?.[0] ?? null;
  const hasRating = !showReleaseAlert && item.voteAverage !== null;

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
        <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
        {showReleaseAlert ? (
          <View style={styles.metaRow}>
            <CalendarDays color={colors.textSubtle} size={13} strokeWidth={2} />
            <Text numberOfLines={1} style={styles.meta}>{releaseMetadata}</Text>
          </View>
        ) : year || hasRating ? (
          <View style={styles.metaRow}>
            {year ? <Text numberOfLines={1} style={styles.meta}>{year}</Text> : null}
            {year && hasRating ? <Text style={styles.metaSeparator}>·</Text> : null}
            <CatalogueRating voteAverage={item.voteAverage} />
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
  metaSeparator: {
    ...typography.meta,
    color: colors.textSubtle,
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
