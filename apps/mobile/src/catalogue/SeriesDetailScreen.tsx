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
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
import { SeriesProgressSummary } from '../tracking/SeriesProgressSummary';
import { TrackingControls } from '../tracking/TrackingControls';
import { WatchlistControls } from '../watchlists/WatchlistControls';
import { StreamingAvailabilityPanel } from './StreamingAvailabilityPanel';

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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
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
  const metadata = ['Series', firstYear, seasons, episodes, series.voteAverage ? series.voteAverage.toFixed(1) : null]
    .filter(Boolean)
    .join(' / ');

  return (
    <View>
      {series.backdropUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${series.title} backdrop`}
          source={{ uri: series.backdropUrl }}
          style={styles.backdrop}
        />
      ) : null}
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
          <Text style={styles.eyebrow}>TMDB series</Text>
          <Text style={styles.title}>{series.title}</Text>
          {metadata ? <Text style={styles.metadata}>{metadata}</Text> : null}
          {series.genres.length > 0 ? (
            <Text numberOfLines={2} style={styles.genres}>
              {series.genres.join(', ')}
            </Text>
          ) : null}
        </View>
      </View>
      {series.tagline ? <Text style={styles.tagline}>{series.tagline}</Text> : null}
      <TrackingControls contentType="series" tmdbId={series.tmdbId} />
      <WatchlistControls contentType="series" tmdbId={series.tmdbId} />
      <StreamingAvailabilityPanel contentType="series" tmdbId={series.tmdbId} />
      <SeriesProgressSummary
        seasons={series.seasons}
        seriesTitle={series.title}
        seriesTmdbId={series.tmdbId}
      />
      <ComputedRatingSummary seriesTmdbId={series.tmdbId} title="My computed series rating" />
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Synopsis</Text>
        <Text style={styles.body}>{series.overview || 'No synopsis available yet.'}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="TMDB ID" value={String(series.tmdbId)} />
        <DetailRow label="First air date" value={series.firstAirDate ?? 'Unknown'} />
        <DetailRow label="Status" value={series.status ?? 'Unknown'} />
        <DetailRow label="In production" value={series.inProduction ? 'Yes' : 'No'} />
      </View>
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
      <Text style={styles.tmdbNotice}>
        This product uses the TMDB API but is not endorsed or certified by TMDB.
      </Text>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 170,
    marginBottom: spacing.lg,
    width: '100%',
  },
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  detailLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  detailRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  detailValue: {
    ...typography.body,
    color: colors.text,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  genres: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerCopy: {
    flex: 1,
    justifyContent: 'center',
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
  metadata: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.sm,
    textTransform: 'uppercase',
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
  tmdbNotice: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
});
