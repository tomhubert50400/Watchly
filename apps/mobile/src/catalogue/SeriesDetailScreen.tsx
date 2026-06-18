import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown } from 'lucide-react-native';
import { ActivityIndicator, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSeasonDetails, SeasonDetails, SeriesDetails } from '../api/catalogue';
import { listSeriesProgress, SeriesProgress } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { useToast } from '../notifications/ToastContext';
import { SeriesProgressSummary } from '../tracking/SeriesProgressSummary';
import { TrackingControls } from '../tracking/TrackingControls';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';
import { useCatalogueCache } from './CatalogueCacheContext';
import { isReleasedDate } from './releaseDates';

type SeriesDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'SeriesDetail'>;
const SEASON_PICKER_VISIBLE_ROWS = 3;
const SEASON_PICKER_ROW_HEIGHT = 72;
const SEASON_PICKER_GAP = spacing.sm;
const SEASON_PICKER_MAX_HEIGHT =
  SEASON_PICKER_VISIBLE_ROWS * SEASON_PICKER_ROW_HEIGHT +
  (SEASON_PICKER_VISIBLE_ROWS - 1) * SEASON_PICKER_GAP;

export function SeriesDetailScreen({ route }: SeriesDetailScreenProps) {
  const { tmdbId } = route.params;
  const { getCachedSeries, refreshSeries } = useCatalogueCache();
  const [series, setSeries] = useState<SeriesDetails | null>(() => getCachedSeries(tmdbId));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(() => !getCachedSeries(tmdbId));
  const hasVisibleSeriesRef = useRef(Boolean(series));

  const loadSeries = useCallback(async (showLoading = false) => {
    setError(null);
    setIsLoading(showLoading || !hasVisibleSeriesRef.current);

    try {
      const nextSeries = await refreshSeries(tmdbId);

      setSeries(nextSeries);
      hasVisibleSeriesRef.current = true;
    } catch (caughtError) {
      if (!hasVisibleSeriesRef.current) {
        setSeries(null);
      }
      setError(caughtError instanceof Error ? caughtError.message : 'Series details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [refreshSeries, tmdbId]);

  useEffect(() => {
    const cached = getCachedSeries(tmdbId);

    if (cached) {
      setSeries(cached);
      hasVisibleSeriesRef.current = true;
      setIsLoading(false);
      void loadSeries(false);
      return;
    }

    hasVisibleSeriesRef.current = false;
    void loadSeries(true);
  }, [loadSeries, tmdbId]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading series details</Text>
          </View>
        ) : error ? (
          <EmptyState body={error} title="Series detail failed">
            <Button label="Retry" onPress={() => loadSeries(true)} />
          </EmptyState>
        ) : series ? (
          <SeriesDetailContent series={series} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeriesDetailContent({ series }: { series: SeriesDetails }) {
  const [activeView, setActiveView] = useState<'details' | 'episodes'>('details');
  const isReleased = isReleasedDate(series.firstAirDate);
  const firstYear = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const seasons = series.numberOfSeasons ? `${series.numberOfSeasons} seasons` : null;
  const episodes = series.numberOfEpisodes ? `${series.numberOfEpisodes} episodes` : null;
  const infoItems = [firstYear, seasons, episodes, isReleased ? formatTmdbRating(series.voteAverage) : null]
    .filter(Boolean)
    .map((item) => item as HeaderInfoItem);
  return (
    <View>
      <View style={styles.header}>
        {series.posterUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${series.title} poster`}
            source={{ uri: series.posterUrl }}
            style={styles.poster}
          />
        ) : (
          <View style={styles.posterPlaceholder} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{series.title}</Text>
          <HeaderInfoPills items={infoItems} />
          {series.genres.length > 0 ? (
            <Text numberOfLines={2} style={styles.genres}>
              {series.genres.join(', ')}
            </Text>
          ) : null}
          <AddToWatchlistControl contentType="series" tmdbId={series.tmdbId} />
        </View>
        <ReleaseAlertControl contentType="series" tmdbId={series.tmdbId} />
      </View>
      {series.tagline ? <Text style={styles.tagline}>{series.tagline}</Text> : null}
      <SegmentedControl
        containerStyle={styles.viewSwitchControl}
        onChange={setActiveView}
        options={[
          { accessibilityLabel: 'Show details', label: 'Details', value: 'details' },
          { accessibilityLabel: 'Show episodes', label: 'Episodes', value: 'episodes' },
        ]}
        value={activeView}
      />
      {activeView === 'episodes' ? (
        <SeriesEpisodesPanel
          seasons={series.seasons}
          seriesTitle={series.title}
          seriesTmdbId={series.tmdbId}
        />
      ) : (
        <>
          <TrackingControls contentType="series" tmdbId={series.tmdbId} />
          <SynopsisPanel overview={series.overview} />
          <SeriesProgressSummary
            seasons={series.seasons}
            seriesTitle={series.title}
            seriesTmdbId={series.tmdbId}
          />
          <StreamingAvailabilityPanel contentType="series" tmdbId={series.tmdbId} />
        </>
      )}
    </View>
  );
}

function SeriesEpisodesPanel({
  seasons,
  seriesTitle,
  seriesTmdbId,
}: {
  seasons: SeriesDetails['seasons'];
  seriesTitle: string;
  seriesTmdbId: number;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseIdToken, trackingRevision } = useAuthSession();
  const { showToast } = useToast();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [shouldRenderPicker, setShouldRenderPicker] = useState(false);
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null);
  const [progress, setProgress] = useState<SeriesProgress | null>(null);
  const [season, setSeason] = useState<SeasonDetails | null>(null);
  const [isLoadingSeason, setIsLoadingSeason] = useState(false);
  const pickerAnimation = useRef(new Animated.Value(0)).current;

  const orderedSeasons = orderSeasonsForPicker(seasons);
  const defaultSeasonNumber = getDefaultSeasonNumber(seasons, progress);
  const activeSeasonNumber = selectedSeasonNumber ?? defaultSeasonNumber;
  const activeSeason = orderedSeasons.find((item) => item.seasonNumber === activeSeasonNumber) ?? null;
  const pickerAnimatedStyle = {
    opacity: pickerAnimation,
    transform: [
      {
        translateY: pickerAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [-8, 0],
        }),
      },
    ],
  };

  useEffect(() => {
    if (!firebaseIdToken) {
      setProgress(null);
      return;
    }

    const token = firebaseIdToken;
    let isMounted = true;

    async function loadProgress() {
      try {
        const nextProgress = await listSeriesProgress(token, seriesTmdbId);

        if (isMounted) {
          setProgress(nextProgress);
        }
      } catch {
        if (isMounted) {
          setProgress(null);
        }
      }
    }

    void loadProgress();

    return () => {
      isMounted = false;
    };
  }, [firebaseIdToken, seriesTmdbId, trackingRevision]);

  useEffect(() => {
    if (isPickerOpen) {
      setShouldRenderPicker(true);
    }

    Animated.timing(pickerAnimation, {
      duration: 180,
      toValue: isPickerOpen ? 1 : 0,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !isPickerOpen) {
        setShouldRenderPicker(false);
      }
    });
  }, [isPickerOpen, pickerAnimation]);

  useEffect(() => {
    if (activeSeasonNumber === null) {
      return;
    }

    const seasonNumber = activeSeasonNumber;
    let isMounted = true;

    async function loadSeason() {
      setIsLoadingSeason(true);

      try {
        const response = await getSeasonDetails(seriesTmdbId, seasonNumber);

        if (isMounted) {
          setSeason(response.item);
        }
      } catch {
        if (isMounted) {
          setSeason(null);
          showToast('Could not load episodes.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingSeason(false);
        }
      }
    }

    void loadSeason();

    return () => {
      isMounted = false;
    };
  }, [activeSeasonNumber, seriesTmdbId, showToast]);

  function selectSeason(nextSeasonNumber: number) {
    setSelectedSeasonNumber(nextSeasonNumber);
    setIsPickerOpen(false);
  }

  function openEpisode(episode: SeasonDetails['episodes'][number]) {
    navigation.navigate('EpisodeDetail', {
      episodeNumber: episode.episodeNumber,
      seasonNumber: episode.seasonNumber,
      seriesTitle,
      title: episode.title,
      tmdbId: seriesTmdbId,
    });
  }

  return (
    <View style={styles.episodesPanel}>
      <Pressable
        accessibilityLabel="Choose season"
        accessibilityRole="button"
        accessibilityState={{ expanded: isPickerOpen }}
        onPress={() => setIsPickerOpen((current) => !current)}
        style={({ pressed }) => [styles.selectedSeasonButton, pressed && styles.seasonRowPressed]}
      >
        <View style={styles.selectedSeasonCopy}>
          <Text style={styles.selectedSeasonLabel}>Season</Text>
          <Text style={styles.selectedSeasonText}>
            {activeSeason ? formatSeasonName(activeSeason) : 'Select season'}
          </Text>
        </View>
        <ChevronDown
          color={colors.accent}
          size={20}
          strokeWidth={2.5}
          style={isPickerOpen ? styles.dropdownIconOpen : undefined}
        />
      </Pressable>

      {shouldRenderPicker ? (
        <Animated.View style={[styles.seasonPicker, pickerAnimatedStyle]}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator={orderedSeasons.length > SEASON_PICKER_VISIBLE_ROWS}
            style={styles.seasonPickerScroll}
          >
            <View style={styles.seasonPickerContent}>
              {orderedSeasons.map((item) => (
                <Pressable
                  accessibilityLabel={`Select ${formatSeasonName(item)}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: activeSeasonNumber === item.seasonNumber }}
                  key={item.id}
                  onPress={() => selectSeason(item.seasonNumber)}
                  style={({ pressed }) => [
                    styles.seasonOption,
                    activeSeasonNumber === item.seasonNumber && styles.seasonOptionActive,
                    pressed && styles.seasonRowPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.seasonOptionTitle,
                      activeSeasonNumber === item.seasonNumber && styles.seasonOptionTitleActive,
                    ]}
                  >
                    {formatSeasonName(item)}
                  </Text>
                  <Text style={styles.seasonOptionMeta}>
                    {formatSeasonMeta(item)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}

      <View style={styles.episodeList}>
        {isLoadingSeason ? (
          <View style={styles.inlineLoading}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.body}>Loading episodes</Text>
          </View>
        ) : season && season.episodes.length > 0 ? (
          season.episodes.map((episode) => (
            <EpisodeRow
              episode={episode}
              key={episode.id}
              onPress={() => openEpisode(episode)}
            />
          ))
        ) : (
          <Text style={styles.body}>No episode data available yet.</Text>
        )}
      </View>
    </View>
  );
}

function EpisodeRow({
  episode,
  onPress,
}: {
  episode: SeasonDetails['episodes'][number];
  onPress: () => void;
}) {
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const metadata = [`E${episode.episodeNumber}`, episode.airDate, runtime].filter(Boolean).join(' / ');

  return (
    <Pressable
      accessibilityLabel={`Open ${episode.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.seasonRow, pressed && styles.seasonRowPressed]}
    >
      {episode.stillUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${episode.title} still`}
          source={{ uri: episode.stillUrl }}
          style={styles.episodeStill}
        />
      ) : (
        <View style={styles.episodeStillPlaceholder} />
      )}
      <View style={styles.seasonCopy}>
        <Text style={styles.seasonTitle}>{episode.title}</Text>
        <Text style={styles.seasonMeta}>{metadata}</Text>
        <Text numberOfLines={2} style={styles.episodeOverview}>
          {episode.overview || 'No synopsis available yet.'}
        </Text>
      </View>
    </Pressable>
  );
}

function orderSeasonsForPicker(seasons: SeriesDetails['seasons']) {
  return [...seasons].sort((left, right) => {
    const leftIsSpecial = left.seasonNumber === 0;
    const rightIsSpecial = right.seasonNumber === 0;

    if (leftIsSpecial !== rightIsSpecial) {
      return leftIsSpecial ? 1 : -1;
    }

    return left.seasonNumber - right.seasonNumber;
  });
}

function getDefaultSeasonNumber(seasons: SeriesDetails['seasons'], progress: SeriesProgress | null) {
  const orderedRegularSeasons = seasons
    .filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);

  if (orderedRegularSeasons.length === 0) {
    return seasons.find((season) => (season.episodeCount ?? 0) > 0)?.seasonNumber ?? null;
  }

  if (!progress || progress.episodes.length === 0) {
    return orderedRegularSeasons[0].seasonNumber;
  }

  const latestWatched = [...progress.episodes].sort((left, right) => {
    if (left.seasonNumber !== right.seasonNumber) {
      return right.seasonNumber - left.seasonNumber;
    }

    return right.episodeNumber - left.episodeNumber;
  })[0];
  const currentSeason = orderedRegularSeasons.find(
    (season) => season.seasonNumber === latestWatched.seasonNumber,
  );
  const currentSeasonEpisodeCount = currentSeason?.episodeCount ?? 0;

  if (currentSeason && latestWatched.episodeNumber < currentSeasonEpisodeCount) {
    return latestWatched.seasonNumber;
  }

  return (
    orderedRegularSeasons.find((season) => season.seasonNumber > latestWatched.seasonNumber)
      ?.seasonNumber ?? currentSeason?.seasonNumber ?? orderedRegularSeasons[0].seasonNumber
  );
}

function formatSeasonName(season: SeriesDetails['seasons'][number]) {
  return season.seasonNumber === 0 ? season.name : `Saison ${season.seasonNumber}`;
}

function formatSeasonMeta(season: SeriesDetails['seasons'][number]) {
  const episodeCount = season.episodeCount ? `${season.episodeCount} episodes` : 'Episodes unknown';
  const airDate = season.airDate ?? 'Air date unknown';

  return `${episodeCount} / ${airDate}`;
}

function formatTmdbRating(voteAverage: number | null) {
  if (!voteAverage) {
    return null;
  }

  return {
    icon: 'star',
    label: (voteAverage / 2).toFixed(1),
  } satisfies HeaderInfoItem;
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  genres: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  episodeOverview: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  episodeList: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },
  episodesPanel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  episodesButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  episodesButtonMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  episodeStill: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 78,
    width: 112,
  },
  episodeStillPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 78,
    width: 112,
  },
  dropdownIconOpen: {
    transform: [{ rotate: '180deg' }],
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
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
  inlineLoading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 174,
    width: 116,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 174,
    width: 116,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  seasonCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  seasonMeta: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  seasonOption: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: SEASON_PICKER_ROW_HEIGHT,
    justifyContent: 'center',
    padding: spacing.md,
  },
  seasonOptionActive: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.accent,
  },
  seasonOptionMeta: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: spacing.xs,
  },
  seasonOptionTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  seasonOptionTitleActive: {
    color: colors.accent,
  },
  seasonPicker: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.md,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  seasonPickerContent: {
    gap: SEASON_PICKER_GAP,
  },
  seasonPickerScroll: {
    maxHeight: SEASON_PICKER_MAX_HEIGHT,
  },
  seasonRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  seasonRowPressed: {
    opacity: 0.78,
  },
  seasonTitle: {
    ...typography.title,
    color: colors.text,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  selectedSeasonButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  selectedSeasonCopy: {
    flex: 1,
    minWidth: 0,
  },
  selectedSeasonLabel: {
    ...typography.eyebrow,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  selectedSeasonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '800',
  },
  tagline: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  viewSwitchControl: {
    marginBottom: spacing.md,
  },
});
