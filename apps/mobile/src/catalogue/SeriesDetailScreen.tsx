import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSeriesDetails, SeriesDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ReleaseAlertControl } from '../notifications/ReleaseAlertControl';
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
import { SeriesProgressSummary } from '../tracking/SeriesProgressSummary';
import { TrackingControls } from '../tracking/TrackingControls';
import { HeaderInfoItem, HeaderInfoPills } from './HeaderInfoPills';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';
import { SynopsisPanel } from './SynopsisPanel';
import { AddToWatchlistControl } from '../watchlists/AddToWatchlistControl';

type SeriesDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'SeriesDetail'>;

export function SeriesDetailScreen({ route }: SeriesDetailScreenProps) {
  const { tmdbId } = route.params;
  const [series, setSeries] = useState<SeriesDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSeries = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await getSeriesDetails(tmdbId);

      setSeries(response.item);
    } catch (caughtError) {
      setSeries(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Series details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [tmdbId]);

  useEffect(() => {
    void loadSeries();
  }, [loadSeries]);

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
            <Button label="Retry" onPress={loadSeries} />
          </EmptyState>
        ) : series ? (
          <SeriesDetailContent series={series} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeriesDetailContent({ series }: { series: SeriesDetails }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const firstYear = series.firstAirDate ? series.firstAirDate.slice(0, 4) : null;
  const seasons = series.numberOfSeasons ? `${series.numberOfSeasons} seasons` : null;
  const episodes = series.numberOfEpisodes ? `${series.numberOfEpisodes} episodes` : null;
  const infoItems = [firstYear, seasons, episodes, formatTmdbRating(series.voteAverage)]
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
      <SynopsisPanel overview={series.overview} />
      <TrackingControls contentType="series" tmdbId={series.tmdbId} />
      <StreamingAvailabilityPanel contentType="series" tmdbId={series.tmdbId} />
      <SeriesProgressSummary
        seasons={series.seasons}
        seriesTitle={series.title}
        seriesTmdbId={series.tmdbId}
      />
      <ComputedRatingSummary seriesTmdbId={series.tmdbId} title="My computed series rating" />
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Seasons</Text>
        {series.seasons.length > 0 ? (
          series.seasons.map((season) => (
            <SeasonRow
              key={season.id}
              onPress={() =>
                navigation.navigate('SeasonDetail', {
                  seasonNumber: season.seasonNumber,
                  seriesTitle: series.title,
                  title: season.name,
                  tmdbId: series.tmdbId,
                })
              }
              season={season}
            />
          ))
        ) : (
          <Text style={styles.body}>No season data available yet.</Text>
        )}
      </View>
    </View>
  );
}

function SeasonRow({
  onPress,
  season,
}: {
  onPress: () => void;
  season: SeriesDetails['seasons'][number];
}) {
  const episodeCount = season.episodeCount ? `${season.episodeCount} episodes` : 'Episodes unknown';
  const airDate = season.airDate ?? 'Air date unknown';

  return (
    <Pressable
      accessibilityLabel={`Open ${season.name}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.seasonRow, pressed && styles.seasonRowPressed]}
    >
      {season.posterUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${season.name} poster`}
          source={{ uri: season.posterUrl }}
          style={styles.seasonPoster}
        />
      ) : (
        <View style={styles.seasonPosterPlaceholder} />
      )}
      <View style={styles.seasonCopy}>
        <Text style={styles.seasonTitle}>{season.name}</Text>
        <Text style={styles.seasonMeta}>
          {episodeCount} / {airDate}
        </Text>
      </View>
    </Pressable>
  );
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
  seasonPoster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 90,
    width: 60,
  },
  seasonPosterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 90,
    width: 60,
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
});
