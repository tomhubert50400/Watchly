import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMovieDetails, getSeriesDetails, SeriesDetails } from '../api/catalogue';
import { listSeriesProgressSummaries, SeriesProgressSummary } from '../api/progress';
import { listMovieRatings, MovieRating } from '../api/ratings';
import { listTrackingStates, TrackingState } from '../api/tracking';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type LibraryItem = {
  contentType: TrackingState['contentType'];
  favorite: boolean;
  key: string;
  posterUrl: string | null;
  ratingScore: number | null;
  resumeEpisodeNumber: number | null;
  resumeSeasonNumber: number | null;
  status: TrackingState['status'];
  title: string;
  tmdbId: number;
  updatedAt: string;
  watchedEpisodeCount: number;
};

type LibraryItemBase = Omit<LibraryItem, 'posterUrl' | 'title'>;

type HydratedLibraryItem = LibraryItemBase & {
  posterUrl: string | null;
  title: string;
};

const statusLabels: Record<NonNullable<TrackingState['status']>, string> = {
  dropped: 'Dropped',
  watched: 'Watched',
  watching: 'Watching',
  watchlisted: 'Watchlist',
};

export function MyTvScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseIdToken, trackingRevision } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<HydratedLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadItems = useCallback(async () => {
    if (!firebaseIdToken) {
      setItems([]);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const [states, ratings, progress] = await Promise.all([
        listTrackingStates(firebaseIdToken),
        listMovieRatings(firebaseIdToken),
        listSeriesProgressSummaries(firebaseIdToken),
      ]);
      const libraryItems = mergeLibraryItems(states, ratings, progress.items);
      const hydratedItems = await Promise.all(libraryItems.map(hydrateLibraryItem));

      setItems(hydratedItems);
    } catch {
      setItems([]);
      setError('Could not load your tracked titles.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken]);

  useEffect(() => {
    void loadItems();
  }, [loadItems, trackingRevision]);

  function openItem(item: HydratedLibraryItem) {
    if (item.contentType === 'movie') {
      navigation.navigate('FilmDetail', {
        title: item.title,
        tmdbId: item.tmdbId,
      });
      return;
    }

    navigation.navigate('SeriesDetail', {
      title: item.title,
      tmdbId: item.tmdbId,
    });
  }

  return (
    <Screen title="Manage your watch life">
      {!firebaseIdToken ? (
        <EmptyState
          body="Sign in from Profile, then track a film or series from its detail page."
          title="Sign in to build My TV"
        />
      ) : isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading My TV</Text>
        </View>
      ) : error ? (
        <EmptyState body={error} title="My TV failed">
          <Button label="Retry" onPress={loadItems} />
        </EmptyState>
      ) : items.length === 0 ? (
        <EmptyState
          body="Open a film or series from Explore, then track it, rate it, or mark an episode watched."
          title="No tracked titles yet"
        />
      ) : (
        <View style={styles.list}>
          {items.map((item) => (
            <Pressable
              accessibilityLabel={`Open ${item.title}`}
              accessibilityRole="button"
              key={item.key}
              onPress={() => openItem(item)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              {item.posterUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  accessibilityLabel={`${item.title} poster`}
                  source={{ uri: item.posterUrl }}
                  style={styles.poster}
                />
              ) : (
                <View style={styles.posterPlaceholder} />
              )}
              <View style={styles.rowCopy}>
                <Text numberOfLines={2} style={styles.title}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>{buildMeta(item)}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

function mergeLibraryItems(
  states: TrackingState[],
  ratings: MovieRating[],
  progress: SeriesProgressSummary[],
): LibraryItemBase[] {
  const byContent = new Map<string, LibraryItemBase>();

  states.forEach((state) => {
    const key = `${state.contentType}:${state.tmdbId}`;

    byContent.set(key, {
      contentType: state.contentType,
      favorite: state.favorite,
      key,
      ratingScore: null,
      resumeEpisodeNumber: null,
      resumeSeasonNumber: null,
      status: state.status,
      tmdbId: state.tmdbId,
      updatedAt: state.updatedAt,
      watchedEpisodeCount: 0,
    });
  });

  ratings.forEach((rating) => {
    const key = `movie:${rating.tmdbId}`;
    const existing = byContent.get(key);

    byContent.set(key, {
      contentType: 'movie',
      favorite: existing?.favorite ?? false,
      key,
      ratingScore: rating.score,
      resumeEpisodeNumber: existing?.resumeEpisodeNumber ?? null,
      resumeSeasonNumber: existing?.resumeSeasonNumber ?? null,
      status: existing?.status ?? null,
      tmdbId: rating.tmdbId,
      updatedAt: maxDateString(existing?.updatedAt, rating.updatedAt),
      watchedEpisodeCount: existing?.watchedEpisodeCount ?? 0,
    });
  });

  progress.forEach((summary) => {
    const key = `series:${summary.seriesTmdbId}`;
    const existing = byContent.get(key);

    byContent.set(key, {
      contentType: 'series',
      favorite: existing?.favorite ?? false,
      key,
      ratingScore: existing?.ratingScore ?? null,
      resumeEpisodeNumber: summary.latestEpisodeNumber,
      resumeSeasonNumber: summary.latestSeasonNumber,
      status: existing?.status ?? null,
      tmdbId: summary.seriesTmdbId,
      updatedAt: maxDateString(existing?.updatedAt, summary.updatedAt),
      watchedEpisodeCount: summary.watchedEpisodeCount,
    });
  });

  return Array.from(byContent.values()).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt),
  );
}

async function hydrateLibraryItem(item: LibraryItemBase): Promise<HydratedLibraryItem> {
  try {
    if (item.contentType === 'movie') {
      const response = await getMovieDetails(item.tmdbId);

      return {
        ...item,
        posterUrl: response.item.posterUrl,
        title: response.item.title,
      };
    }

    const response = await getSeriesDetails(item.tmdbId);
    const resumeEpisode = getResumeEpisode(response.item.seasons, item);

    return {
      ...item,
      posterUrl: response.item.posterUrl,
      resumeEpisodeNumber: resumeEpisode?.episodeNumber ?? null,
      resumeSeasonNumber: resumeEpisode?.seasonNumber ?? null,
      title: response.item.title,
    };
  } catch {
    return {
      ...item,
      posterUrl: null,
      title: `TMDB ${item.tmdbId}`,
    };
  }
}

function maxDateString(left: string | undefined, right: string) {
  if (!left) {
    return right;
  }

  return left.localeCompare(right) > 0 ? left : right;
}

function buildMeta(item: HydratedLibraryItem) {
  const typeLabel = item.contentType === 'movie' ? 'Film' : 'Series';
  const labels = [typeLabel];

  if (item.status) {
    labels.push(statusLabels[item.status]);
  }

  if (item.favorite) {
    labels.push('Favorite');
  }

  if (item.ratingScore !== null) {
    labels.push(`Rating ${item.ratingScore}/5`);
  }

  if (item.contentType === 'series' && item.watchedEpisodeCount > 0) {
    labels.push(
      item.resumeSeasonNumber && item.resumeEpisodeNumber
        ? `Current S${item.resumeSeasonNumber} E${item.resumeEpisodeNumber}`
        : 'All caught up',
    );
    labels.push(`${item.watchedEpisodeCount} watched`);
  }

  return labels.join(' / ');
}

function getResumeEpisode(
  seasons: SeriesDetails['seasons'],
  item: LibraryItemBase,
): { episodeNumber: number; seasonNumber: number } | null {
  if (!item.resumeSeasonNumber || !item.resumeEpisodeNumber) {
    return null;
  }

  const currentEpisodeNumber = item.resumeEpisodeNumber;
  const currentSeasonNumber = item.resumeSeasonNumber;
  const orderedSeasons = seasons
    .filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);
  const currentSeason = orderedSeasons.find((season) => season.seasonNumber === currentSeasonNumber);
  const currentSeasonEpisodeCount = currentSeason?.episodeCount ?? 0;

  if (currentSeason && currentEpisodeNumber < currentSeasonEpisodeCount) {
    return {
      episodeNumber: currentEpisodeNumber + 1,
      seasonNumber: currentSeasonNumber,
    };
  }

  const nextSeason = orderedSeasons.find((season) => season.seasonNumber > currentSeasonNumber);

  if (!nextSeason) {
    return null;
  }

  return {
    episodeNumber: 1,
    seasonNumber: nextSeason.seasonNumber,
  };
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 108,
    width: 72,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 108,
    width: 72,
  },
  row: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  rowPressed: {
    opacity: 0.78,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
});
