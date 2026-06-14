import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trash2, Users } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { getMovieDetails, getSeriesDetails, SeriesDetails } from '../api/catalogue';
import {
  listSeriesProgressSummaries,
  SeriesProgressSummariesResponse,
  SeriesProgressSummary,
} from '../api/progress';
import { listMovieRatings, MovieRating } from '../api/ratings';
import {
  createSharedWatchlist,
  deleteSharedWatchlist,
  listSharedWatchlists,
  SharedWatchlistSummary,
} from '../api/sharedWatchlists';
import { listTrackingStates, TrackingState } from '../api/tracking';
import {
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  PersonalWatchlistSummary,
} from '../api/watchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { TextInput } from '../components/TextInput';
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
  const [isSavingWatchlist, setIsSavingWatchlist] = useState(false);
  const [isSavingSharedWatchlist, setIsSavingSharedWatchlist] = useState(false);
  const [sharedWatchlistActionError, setSharedWatchlistActionError] = useState<string | null>(null);
  const [sharedWatchlistName, setSharedWatchlistName] = useState('');
  const [sharedWatchlists, setSharedWatchlists] = useState<SharedWatchlistSummary[]>([]);
  const [watchlistActionError, setWatchlistActionError] = useState<string | null>(null);
  const [watchlistName, setWatchlistName] = useState('');
  const [watchlists, setWatchlists] = useState<PersonalWatchlistSummary[]>([]);

  const loadItems = useCallback(async () => {
    if (!firebaseIdToken) {
      setItems([]);
      setError(null);
      setSharedWatchlists([]);
      setWatchlists([]);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const [statesResult, ratingsResult, progressResult, watchlistsResult, sharedWatchlistsResult] =
        await Promise.allSettled([
        listTrackingStates(firebaseIdToken),
        listMovieRatings(firebaseIdToken),
        listSeriesProgressSummaries(firebaseIdToken),
        listWatchlists(firebaseIdToken),
        listSharedWatchlists(firebaseIdToken),
      ]);

      if (
        statesResult.status === 'rejected' &&
        ratingsResult.status === 'rejected' &&
        progressResult.status === 'rejected' &&
        watchlistsResult.status === 'rejected' &&
        sharedWatchlistsResult.status === 'rejected'
      ) {
        throw new Error(
          buildPartialErrorMessage(
            statesResult,
            ratingsResult,
            progressResult,
            watchlistsResult,
            sharedWatchlistsResult,
          ),
        );
      }

      const states = statesResult.status === 'fulfilled' ? statesResult.value : [];
      const ratings = ratingsResult.status === 'fulfilled' ? ratingsResult.value : [];
      const progress = progressResult.status === 'fulfilled' ? progressResult.value.items : [];
      const nextWatchlists = watchlistsResult.status === 'fulfilled' ? watchlistsResult.value.items : [];
      const nextSharedWatchlists =
        sharedWatchlistsResult.status === 'fulfilled' ? sharedWatchlistsResult.value.items : [];
      const hasPartialFailure =
        statesResult.status === 'rejected' ||
        ratingsResult.status === 'rejected' ||
        progressResult.status === 'rejected' ||
        watchlistsResult.status === 'rejected' ||
        sharedWatchlistsResult.status === 'rejected';
      const libraryItems = mergeLibraryItems(states, ratings, progress);
      const hydratedItems = await Promise.all(libraryItems.map(hydrateLibraryItem));

      setItems(hydratedItems);
      setSharedWatchlists(nextSharedWatchlists);
      setWatchlists(nextWatchlists);
      setError(
        hasPartialFailure
          ? buildPartialErrorMessage(
              statesResult,
              ratingsResult,
              progressResult,
              watchlistsResult,
              sharedWatchlistsResult,
            )
          : null,
      );
    } catch (loadError) {
      setItems([]);
      setSharedWatchlists([]);
      setWatchlists([]);
      setError(loadError instanceof Error ? loadError.message : 'Could not load your tracked titles.');
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

  async function handleCreateWatchlist() {
    const name = watchlistName.trim();

    if (!firebaseIdToken || name.length === 0) {
      return;
    }

    setIsSavingWatchlist(true);
    setWatchlistActionError(null);

    try {
      const watchlist = await createWatchlist(firebaseIdToken, name);

      setWatchlists((current) => [watchlist, ...current]);
      setWatchlistName('');
    } catch (createError) {
      setWatchlistActionError(
        createError instanceof Error ? createError.message : 'Could not create the watchlist.',
      );
    } finally {
      setIsSavingWatchlist(false);
    }
  }

  async function handleCreateSharedWatchlist() {
    const name = sharedWatchlistName.trim();

    if (!firebaseIdToken || name.length === 0) {
      return;
    }

    setIsSavingSharedWatchlist(true);
    setSharedWatchlistActionError(null);

    try {
      const watchlist = await createSharedWatchlist(firebaseIdToken, name);

      setSharedWatchlists((current) => [watchlist, ...current]);
      setSharedWatchlistName('');
    } catch (createError) {
      setSharedWatchlistActionError(
        createError instanceof Error ? createError.message : 'Could not create the shared list.',
      );
    } finally {
      setIsSavingSharedWatchlist(false);
    }
  }

  async function handleDeleteWatchlist(watchlistId: string) {
    if (!firebaseIdToken) {
      return;
    }

    setWatchlistActionError(null);

    try {
      await deleteWatchlist(firebaseIdToken, watchlistId);
      setWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
    } catch (deleteError) {
      setWatchlistActionError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the watchlist.',
      );
    }
  }

  async function handleDeleteSharedWatchlist(watchlistId: string) {
    if (!firebaseIdToken) {
      return;
    }

    setSharedWatchlistActionError(null);

    try {
      await deleteSharedWatchlist(firebaseIdToken, watchlistId);
      setSharedWatchlists((current) => current.filter((watchlist) => watchlist.id !== watchlistId));
    } catch (deleteError) {
      setSharedWatchlistActionError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the shared list.',
      );
    }
  }

  function openSharedWatchlist(watchlist: SharedWatchlistSummary) {
    navigation.navigate('SharedWatchlist', {
      title: watchlist.name,
      watchlistId: watchlist.id,
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
      ) : error && items.length === 0 && watchlists.length === 0 && sharedWatchlists.length === 0 ? (
        <EmptyState body={error} title="My TV failed">
          <Button label="Retry" onPress={loadItems} />
        </EmptyState>
      ) : items.length === 0 && watchlists.length === 0 && sharedWatchlists.length === 0 ? (
        <>
          <WatchlistsSection
            actionError={watchlistActionError}
            isSaving={isSavingWatchlist}
            name={watchlistName}
            onChangeName={setWatchlistName}
            onCreate={handleCreateWatchlist}
            onDelete={handleDeleteWatchlist}
            watchlists={watchlists}
          />
          <SharedWatchlistsSection
            actionError={sharedWatchlistActionError}
            isSaving={isSavingSharedWatchlist}
            name={sharedWatchlistName}
            onChangeName={setSharedWatchlistName}
            onCreate={handleCreateSharedWatchlist}
            onDelete={handleDeleteSharedWatchlist}
            onOpen={openSharedWatchlist}
            watchlists={sharedWatchlists}
          />
          <EmptyState
            body="Open a film or series from Explore, then track it, rate it, or mark an episode watched."
            title="No tracked titles yet"
          />
        </>
      ) : (
        <>
          {error ? <Text style={styles.warning}>{error}</Text> : null}
          <WatchlistsSection
            actionError={watchlistActionError}
            isSaving={isSavingWatchlist}
            name={watchlistName}
            onChangeName={setWatchlistName}
            onCreate={handleCreateWatchlist}
            onDelete={handleDeleteWatchlist}
            watchlists={watchlists}
          />
          <SharedWatchlistsSection
            actionError={sharedWatchlistActionError}
            isSaving={isSavingSharedWatchlist}
            name={sharedWatchlistName}
            onChangeName={setSharedWatchlistName}
            onCreate={handleCreateSharedWatchlist}
            onDelete={handleDeleteSharedWatchlist}
            onOpen={openSharedWatchlist}
            watchlists={sharedWatchlists}
          />
          {items.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tracked titles</Text>
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
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

type WatchlistsSectionProps = {
  actionError: string | null;
  isSaving: boolean;
  name: string;
  onChangeName: (name: string) => void;
  onCreate: () => void;
  onDelete: (watchlistId: string) => void;
  watchlists: PersonalWatchlistSummary[];
};

function WatchlistsSection({
  actionError,
  isSaving,
  name,
  onChangeName,
  onCreate,
  onDelete,
  watchlists,
}: WatchlistsSectionProps) {
  const canCreate = name.trim().length > 0 && !isSaving;

  return (
    <View style={styles.section}>
      <View style={styles.watchlistsPanel}>
        <View>
          <Text style={styles.sectionTitle}>Personal lists</Text>
          <Text style={styles.sectionBody}>Private lists for films and series. Shared lists come later.</Text>
        </View>
        <TextInput
          label="List name"
          maxLength={80}
          onChangeText={onChangeName}
          onSubmitEditing={canCreate ? onCreate : undefined}
          placeholder="Weekend ideas"
          returnKeyType="done"
          value={name}
        />
        <Button
          disabled={!canCreate}
          label={isSaving ? 'Creating...' : 'Create list'}
          onPress={onCreate}
        />
        {actionError ? <Text style={styles.warning}>{actionError}</Text> : null}
        {watchlists.length === 0 ? (
          <Text style={styles.emptyInline}>No personal lists yet.</Text>
        ) : (
          <View style={styles.watchlistRows}>
            {watchlists.map((watchlist) => (
              <View key={watchlist.id} style={styles.watchlistRow}>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.watchlistName}>
                    {watchlist.name}
                  </Text>
                  <Text style={styles.meta}>
                    {watchlist.itemCount === 1 ? '1 title' : `${watchlist.itemCount} titles`}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`Delete ${watchlist.name}`}
                  accessibilityRole="button"
                  onPress={() => onDelete(watchlist.id)}
                  style={({ pressed }) => [styles.deleteButton, pressed && styles.rowPressed]}
                >
                  <Trash2 color={colors.danger} size={18} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

type SharedWatchlistsSectionProps = {
  actionError: string | null;
  isSaving: boolean;
  name: string;
  onChangeName: (name: string) => void;
  onCreate: () => void;
  onDelete: (watchlistId: string) => void;
  onOpen: (watchlist: SharedWatchlistSummary) => void;
  watchlists: SharedWatchlistSummary[];
};

function SharedWatchlistsSection({
  actionError,
  isSaving,
  name,
  onChangeName,
  onCreate,
  onDelete,
  onOpen,
  watchlists,
}: SharedWatchlistsSectionProps) {
  const canCreate = name.trim().length > 0 && !isSaving;

  return (
    <View style={styles.section}>
      <View style={styles.watchlistsPanel}>
        <View>
          <Text style={styles.sectionTitle}>Shared lists</Text>
          <Text style={styles.sectionBody}>Member-only lists for planning what to watch together.</Text>
        </View>
        <TextInput
          label="Shared list name"
          maxLength={80}
          onChangeText={onChangeName}
          onSubmitEditing={canCreate ? onCreate : undefined}
          placeholder="Tonight"
          returnKeyType="done"
          value={name}
        />
        <Button
          disabled={!canCreate}
          label={isSaving ? 'Creating...' : 'Create shared list'}
          onPress={onCreate}
        />
        {actionError ? <Text style={styles.warning}>{actionError}</Text> : null}
        {watchlists.length === 0 ? (
          <Text style={styles.emptyInline}>No shared lists yet.</Text>
        ) : (
          <View style={styles.watchlistRows}>
            {watchlists.map((watchlist) => (
              <Pressable
                accessibilityLabel={`Open ${watchlist.name}`}
                accessibilityRole="button"
                key={watchlist.id}
                onPress={() => onOpen(watchlist)}
                style={({ pressed }) => [styles.watchlistRow, pressed && styles.rowPressed]}
              >
                <View style={styles.sharedIconFrame}>
                  <Users color={colors.accent} size={18} strokeWidth={2} />
                </View>
                <View style={styles.rowCopy}>
                  <Text numberOfLines={1} style={styles.watchlistName}>
                    {watchlist.name}
                  </Text>
                  <Text style={styles.meta}>
                    {watchlist.memberCount === 1 ? '1 member' : `${watchlist.memberCount} members`} /{' '}
                    {watchlist.itemCount === 1 ? '1 title' : `${watchlist.itemCount} titles`}
                  </Text>
                </View>
                {watchlist.isOwner ? (
                  <Pressable
                    accessibilityLabel={`Delete ${watchlist.name}`}
                    accessibilityRole="button"
                    onPress={(event) => {
                      event.stopPropagation();
                      onDelete(watchlist.id);
                    }}
                    style={({ pressed }) => [styles.deleteButton, pressed && styles.rowPressed]}
                  >
                    <Trash2 color={colors.danger} size={18} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
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

function buildPartialErrorMessage(
  statesResult: PromiseSettledResult<TrackingState[]>,
  ratingsResult: PromiseSettledResult<MovieRating[]>,
  progressResult: PromiseSettledResult<SeriesProgressSummariesResponse>,
  watchlistsResult: PromiseSettledResult<{ items: PersonalWatchlistSummary[] }>,
  sharedWatchlistsResult: PromiseSettledResult<{ items: SharedWatchlistSummary[] }>,
) {
  const failedLabels = [
    statesResult.status === 'rejected' ? `tracking (${getErrorLabel(statesResult.reason)})` : null,
    ratingsResult.status === 'rejected' ? `ratings (${getErrorLabel(ratingsResult.reason)})` : null,
    progressResult.status === 'rejected' ? `progress (${getErrorLabel(progressResult.reason)})` : null,
    watchlistsResult.status === 'rejected'
      ? `watchlists (${getErrorLabel(watchlistsResult.reason)})`
      : null,
    sharedWatchlistsResult.status === 'rejected'
      ? `shared lists (${getErrorLabel(sharedWatchlistsResult.reason)})`
      : null,
  ].filter(Boolean);

  return `Some My TV data could not load: ${failedLabels.join(', ')}.`;
}

function getErrorLabel(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return 'unknown error';
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
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerBackground,
    borderColor: colors.danger,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  emptyInline: {
    ...typography.body,
    color: colors.muted,
  },
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
  section: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  sharedIconFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  sectionBody: {
    ...typography.body,
    color: colors.muted,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
  },
  watchlistName: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  watchlistRow: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  watchlistRows: {
    gap: spacing.sm,
  },
  watchlistsPanel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
});
