import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CatalogueRelatedItem, SeriesDetails } from '../api/catalogue';
import { useCachedResource } from '../cache/useCachedResource';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { MediaHero } from '../components/MediaHero';
import { SegmentedControl } from '../components/SegmentedControl';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, radii, spacing, typography } from '../design/tokens';
import { SeasonEpisodeList } from '../episodes/SeasonEpisodeList';
import { RootStackParamList } from '../navigation/types';
import { CharacterAlertsPanel } from '../notifications/CharacterAlertsPanel';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { SeriesProgressSummary } from '../tracking/SeriesProgressSummary';
import { SeriesRatingControl } from '../tracking/SeriesRatingControl';
import { TrackingControls } from '../tracking/TrackingControls';
import { ViewingCountControl } from '../viewings/ViewingCountControl';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';
import {
  CatalogueCastRail,
  CatalogueKeywordList,
  CatalogueRelatedRail,
  CatalogueVideoRail,
} from './CatalogueDetailSections';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { DetailFacts } from './DetailFacts';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { useCatalogueCache } from './CatalogueCacheContext';
import { ensureSeasonDetails } from './cataloguePrefetch';
import {
  formatDetailDate,
  formatFivePointRating,
  getDetailRenderMode,
  getDistinctOriginalTitle,
} from './detailModel';
import { isReleasedDate } from './releaseDates';

type Props = NativeStackScreenProps<RootStackParamList, 'SeriesDetail'>;

export function SeriesDetailScreen({ navigation, route }: Props) {
  const { tmdbId } = route.params;
  const { getCachedSeries, refreshSeries } = useCatalogueCache();
  const load = useCallback(() => refreshSeries(tmdbId), [refreshSeries, tmdbId]);
  const resource = useCachedResource<SeriesDetails>({
    key: `watchly:public:catalogue:series:${tmdbId}:v4`,
    load,
  });
  const series = resource.data ?? getCachedSeries(tmdbId);
  const renderMode = getDetailRenderMode({
    hasData: Boolean(series),
    hasError: Boolean(resource.error),
    isInitialLoading: resource.isInitialLoading,
  });
  const atmosphereUrl = series?.posterUrl ?? series?.backdropUrl ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: 'transparent' },
      headerTintColor: colors.text,
      headerTitle: '',
      headerTransparent: true,
    });
  }, [navigation]);

  useEffect(() => {
    const firstSeason = series?.seasons
      .filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
      .sort((left, right) => left.seasonNumber - right.seasonNumber)[0];

    if (firstSeason) {
      void ensureSeasonDetails(tmdbId, firstSeason.seasonNumber).catch(() => undefined);
    }
  }, [series?.seasons, tmdbId]);

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      {atmosphereUrl ? <SpotlightAtmosphere blurRadius={28} imageUrl={atmosphereUrl} /> : null}
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="never" showsVerticalScrollIndicator={false}>
        {renderMode === 'loading' ? (
          <View style={styles.stateFrame}><LoadingState variant="detail" label="Loading series details" /></View>
        ) : renderMode === 'fullError' ? (
          <View style={styles.stateFrame}>
            <EmptyState body={resource.error ?? 'Series details failed.'} title="Series detail failed">
              <Button label="Retry" onPress={resource.retry} />
            </EmptyState>
          </View>
        ) : series ? (
          <SeriesDetailContent
            onOpenRelated={(item) => openRelatedSeries(navigation, item)}
            series={series}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeriesDetailContent({ onOpenRelated, series }: {
  onOpenRelated: (item: CatalogueRelatedItem) => void;
  series: SeriesDetails;
}) {
  const [activeView, setActiveView] = useState<'details' | 'episodes'>('details');
  const [isWatched, setIsWatched] = useState(false);
  const isReleased = isReleasedDate(series.firstAirDate);
  const infoItems = [
    'Series',
    series.firstAirDate ? series.firstAirDate.slice(0, 4) : null,
    series.numberOfSeasons ? `${series.numberOfSeasons} seasons` : null,
    series.numberOfEpisodes ? `${series.numberOfEpisodes} episodes` : null,
    isReleased ? formatTmdbRating(series.voteAverage) : null,
  ].filter(Boolean).map((item) => item as HeaderInfoItem);
  const detailFacts = [
    { label: 'Original title', value: getDistinctOriginalTitle(series.originalTitle, series.title) },
    { label: 'Created by', value: series.createdBy?.join(', ') || null },
    { label: 'First aired', value: formatDetailDate(series.firstAirDate) },
    { label: 'Last aired', value: formatDetailDate(series.lastAirDate) },
    { label: 'Seasons', value: series.numberOfSeasons ? String(series.numberOfSeasons) : null },
    { label: 'Episodes', value: series.numberOfEpisodes ? String(series.numberOfEpisodes) : null },
    { label: 'Status', value: series.status },
    { label: 'Networks', value: series.networks?.map((network) => network.name).join(', ') || null },
    { label: 'Production', value: series.productionCompanies?.map((company) => company.name).join(', ') || null },
  ];

  return (
    <View>
      <ScreenReveal delay={50}><MediaHero
        actionAccessory={<ReleaseAlertControl contentType="series" tmdbId={series.tmdbId} />}
        actions={<AddToWatchlistControl contentType="series" tmdbId={series.tmdbId} />}
        backdropUrl={series.backdropUrl}
        logoAspectRatio={series.logoAspectRatio}
        logoUrl={series.logoUrl}
        posterUrl={series.posterUrl}
        title={series.title}
      >
        {series.genres.length > 0 ? <Text numberOfLines={1} style={styles.genres}>{series.genres.join(' · ')}</Text> : null}
        <HeaderInfoPills items={infoItems} />
      </MediaHero></ScreenReveal>
      <ScreenReveal delay={100} style={styles.bodyStack}>
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
            {series.tagline ? <Text style={styles.tagline}>{series.tagline}</Text> : null}
            <SynopsisPanel overview={series.overview} />
            <View style={styles.personalSection}>
              <Text style={styles.personalEyebrow}>Your activity</Text>
              <TrackingControls contentType="series" onWatchedChange={setIsWatched} tmdbId={series.tmdbId} />
              <SeriesRatingControl
                posterUrl={series.posterUrl}
                seriesTitle={series.title}
                seriesTmdbId={series.tmdbId}
              />
              <ViewingCountControl contentType="series" seriesTmdbId={series.tmdbId} />
              {isWatched ? <SeriesProgressSummary seasons={series.seasons} seriesTitle={series.title} seriesTmdbId={series.tmdbId} /> : null}
            </View>
            <DetailFacts items={detailFacts} />
            <CatalogueVideoRail videos={series.videos ?? []} />
            <StreamingAvailabilityPanel contentType="series" tmdbId={series.tmdbId} />
            <CatalogueCastRail cast={series.cast ?? []} />
            <CharacterAlertsPanel contentType="series" tmdbId={series.tmdbId} />
            <CatalogueKeywordList keywords={series.keywords ?? []} />
            {!isWatched ? <SeriesProgressSummary seasons={series.seasons} seriesTitle={series.title} seriesTmdbId={series.tmdbId} /> : null}
            <CatalogueRelatedRail items={series.recommendations ?? []} onOpen={onOpenRelated} />
          </>
        )}
      </ScreenReveal>
    </View>
  );
}

function openRelatedSeries(navigation: Props['navigation'], item: CatalogueRelatedItem) {
  if (item.mediaType === 'movie') {
    navigation.push('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
    return;
  }

  navigation.push('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
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

  if (selected === null) {
    return <Text style={styles.body}>No season data available yet.</Text>;
  }

  return (
    <View style={styles.episodesPanel}>
      {ordered.length > 1 ? (
        <View style={styles.seasonSelectorSection}>
          <ScrollView
            contentContainerStyle={styles.seasonSelector}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {ordered.map((item) => {
              const isSelected = item.seasonNumber === selected;

              return (
                <Pressable
                  accessibilityLabel={`Select ${item.name || `Season ${item.seasonNumber}`}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={item.id}
                  onPress={() => setSelected(item.seasonNumber)}
                  onPressIn={() => {
                    void ensureSeasonDetails(seriesTmdbId, item.seasonNumber).catch(() => undefined);
                  }}
                  style={({ pressed }) => [
                    styles.seasonChip,
                    isSelected && styles.seasonChipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.seasonChipLabel, isSelected && styles.seasonChipLabelSelected]}>
                    {item.seasonNumber === 0 ? 'SP' : `S${item.seasonNumber}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
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
  bodyStack: { paddingBottom: spacing.xxl, paddingHorizontal: spacing.xl },
  content: { flexGrow: 1, paddingBottom: spacing.xxxl },
  episodesPanel: { marginTop: spacing.sm },
  genres: { ...typography.meta, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  personalEyebrow: { ...typography.eyebrow, color: colors.textSubtle, marginBottom: spacing.sm },
  personalSection: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xl },
  pressed: { opacity: 0.76 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  seasonChip: { alignItems: 'center', backgroundColor: colors.panelSoft, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, justifyContent: 'center', minHeight: 52, minWidth: 64, paddingHorizontal: spacing.md },
  seasonChipLabel: { color: colors.textMuted, fontSize: 15, fontWeight: '800' },
  seasonChipLabelSelected: { color: colors.accentText },
  seasonChipSelected: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  seasonSelector: { gap: spacing.sm, paddingRight: spacing.xl },
  seasonSelectorSection: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
  stateFrame: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: 120 },
  tagline: { color: colors.accentText, fontSize: 16, fontStyle: 'italic', fontWeight: '700', lineHeight: 23, paddingTop: spacing.lg, textAlign: 'center' },
  viewSwitchControl: { backgroundColor: colors.interactiveSurface, marginBottom: spacing.md, marginTop: spacing.md },
});
