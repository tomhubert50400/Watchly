import { useCallback, useLayoutEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ChevronDown } from 'lucide-react-native';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SeriesDetails } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaHero } from '../components/MediaHero';
import { SegmentedControl } from '../components/SegmentedControl';
import { colors, radii, spacing, typography } from '../design/tokens';
import { SeasonEpisodeList } from '../episodes/SeasonEpisodeList';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { SeriesProgressSummary } from '../tracking/SeriesProgressSummary';
import { TrackingControls } from '../tracking/TrackingControls';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { useCatalogueCache } from './CatalogueCacheContext';
import { formatFivePointRating, getDetailRenderMode } from './detailModel';
import { isReleasedDate } from './releaseDates';

type Props = NativeStackScreenProps<RootStackParamList, 'SeriesDetail'>;

export function SeriesDetailScreen({ navigation, route }: Props) {
  const { tmdbId } = route.params;
  const { getCachedSeries, refreshSeries } = useCatalogueCache();
  const load = useCallback(() => refreshSeries(tmdbId), [refreshSeries, tmdbId]);
  const resource = useCachedResource<SeriesDetails>({
    key: `watchly:public:catalogue:series:${tmdbId}`,
    load,
  });
  const series = resource.data ?? getCachedSeries(tmdbId);
  const renderMode = getDetailRenderMode({
    hasData: Boolean(series),
    hasError: Boolean(resource.error),
    isInitialLoading: resource.isInitialLoading,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: colors.text,
      headerTitle: '',
      headerTransparent: true,
    });
  }, [navigation]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
        {renderMode === 'loading' ? (
          <View style={styles.stateFrame}><LoadingState label="Loading series details" /></View>
        ) : renderMode === 'fullError' ? (
          <View style={styles.stateFrame}>
            <EmptyState body={resource.error ?? 'Series details failed.'} title="Series detail failed">
              <Button label="Retry" onPress={resource.retry} />
            </EmptyState>
          </View>
        ) : series ? (
          <SeriesDetailContent
            error={resource.error}
            isRefreshing={resource.isRefreshing || resource.isInitialLoading}
            onRetry={resource.retry}
            series={series}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeriesDetailContent({ error, isRefreshing, onRetry, series }: {
  error: string | null;
  isRefreshing: boolean;
  onRetry: () => void;
  series: SeriesDetails;
}) {
  const [activeView, setActiveView] = useState<'details' | 'episodes'>('details');
  const isReleased = isReleasedDate(series.firstAirDate);
  const infoItems = [
    series.firstAirDate ? series.firstAirDate.slice(0, 4) : null,
    series.numberOfSeasons ? `${series.numberOfSeasons} seasons` : null,
    series.numberOfEpisodes ? `${series.numberOfEpisodes} episodes` : null,
    isReleased ? formatTmdbRating(series.voteAverage) : null,
  ].filter(Boolean).map((item) => item as HeaderInfoItem);

  return (
    <View>
      <MediaHero
        actionAccessory={<ReleaseAlertControl contentType="series" tmdbId={series.tmdbId} />}
        actions={<AddToWatchlistControl contentType="series" tmdbId={series.tmdbId} />}
        backdropUrl={series.backdropUrl}
        eyebrow="Series"
        posterAccessibilityLabel={`${series.title} poster`}
        posterUrl={series.posterUrl}
        title={series.title}
      >
        <HeaderInfoPills items={infoItems} />
        {series.genres.length > 0 ? <Text numberOfLines={1} style={styles.genres}>{series.genres.join(' · ')}</Text> : null}
        {series.tagline ? <Text numberOfLines={2} style={styles.tagline}>{series.tagline}</Text> : null}
      </MediaHero>
      <View style={styles.bodyStack}>
        {isRefreshing ? (
          <InlineStatusBanner detail="Refreshing series details" tone="updating" />
        ) : error ? (
          <InlineStatusBanner detail={error} onRetry={onRetry} title="Series update failed" tone="error" />
        ) : null}
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
          <SeriesEpisodesPanel seasons={series.seasons} seriesTitle={series.title} seriesTmdbId={series.tmdbId} />
        ) : (
          <>
            <TrackingControls contentType="series" tmdbId={series.tmdbId} />
            <SeriesProgressSummary seasons={series.seasons} seriesTitle={series.title} seriesTmdbId={series.tmdbId} />
            <SynopsisPanel overview={series.overview} />
            <StreamingAvailabilityPanel contentType="series" tmdbId={series.tmdbId} />
          </>
        )}
      </View>
    </View>
  );
}

function SeriesEpisodesPanel({ seasons, seriesTitle, seriesTmdbId }: {
  seasons: SeriesDetails['seasons'];
  seriesTitle: string;
  seriesTmdbId: number;
}) {
  const ordered = [...seasons].filter((season) => (season.episodeCount ?? 0) > 0).sort((a, b) => {
    if (a.seasonNumber === 0) return 1;
    if (b.seasonNumber === 0) return -1;
    return a.seasonNumber - b.seasonNumber;
  });
  const [selected, setSelected] = useState(ordered.find((season) => season.seasonNumber > 0)?.seasonNumber ?? ordered[0]?.seasonNumber ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (selected === null) {
    return <Text style={styles.body}>No season data available yet.</Text>;
  }

  return (
    <View style={styles.episodesPanel}>
      <Pressable
        accessibilityLabel="Choose season"
        accessibilityRole="button"
        accessibilityState={{ expanded: pickerOpen }}
        onPress={() => setPickerOpen((value) => !value)}
        style={({ pressed }) => [styles.seasonButton, pressed && styles.pressed]}
      >
        <Text style={styles.seasonButtonText}>Season {selected}</Text>
        <ChevronDown color={colors.accent} size={20} style={pickerOpen ? styles.chevronOpen : undefined} />
      </Pressable>
      {pickerOpen ? (
        <View style={styles.picker}>
          {ordered.map((season) => (
            <Pressable
              accessibilityLabel={`Select ${season.name || `Season ${season.seasonNumber}`}`}
              accessibilityRole="button"
              accessibilityState={{ selected: selected === season.seasonNumber }}
              key={season.id}
              onPress={() => {
                setSelected(season.seasonNumber);
                setPickerOpen(false);
              }}
              style={({ pressed }) => [styles.pickerRow, selected === season.seasonNumber && styles.pickerRowActive, pressed && styles.pressed]}
            >
              <Text style={styles.pickerTitle}>{season.name || `Season ${season.seasonNumber}`}</Text>
              <Text style={styles.pickerMeta}>{season.episodeCount ?? 0} episodes{season.airDate ? ` · ${season.airDate}` : ''}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <SeasonEpisodeList seasonNumber={selected} seriesTitle={seriesTitle} seriesTmdbId={seriesTmdbId} />
    </View>
  );
}

function formatTmdbRating(voteAverage: number | null) {
  if (!voteAverage) return null;
  return { icon: 'star', label: formatFivePointRating(voteAverage, 10) } satisfies HeaderInfoItem;
}

const styles = StyleSheet.create({
  body: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
  bodyStack: { paddingHorizontal: spacing.xl },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
  episodesPanel: { gap: spacing.sm, marginTop: spacing.sm },
  genres: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  picker: { backgroundColor: colors.panelSoft, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, overflow: 'hidden' },
  pickerMeta: { ...typography.meta, color: colors.muted, marginTop: 2 },
  pickerRow: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  pickerRowActive: { backgroundColor: colors.accentSoft },
  pickerTitle: { ...typography.body, color: colors.text, fontWeight: '800' },
  pressed: { opacity: 0.76 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  seasonButton: { alignItems: 'center', backgroundColor: colors.panelSoft, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: spacing.md },
  seasonButtonText: { ...typography.body, color: colors.text, fontWeight: '900' },
  stateFrame: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 120 },
  tagline: { ...typography.meta, color: colors.text, fontStyle: 'italic', marginTop: spacing.xs },
  viewSwitchControl: { marginBottom: spacing.md, marginTop: spacing.md },
});
