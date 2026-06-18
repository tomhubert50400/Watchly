import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getSeasonDetails, SeasonDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { ComputedRatingSummary } from '../tracking/ComputedRatingSummary';
import { useSeasonProgressSummary } from '../tracking/SeasonProgressSummary';
import { isReleasedDate } from './releaseDates';

type SeasonDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'SeasonDetail'>;

export function SeasonDetailScreen({ route }: SeasonDetailScreenProps) {
  const { seasonNumber, tmdbId } = route.params;
  const [season, setSeason] = useState<SeasonDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSeason = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await getSeasonDetails(tmdbId, seasonNumber);

      setSeason(response.item);
    } catch (caughtError) {
      setSeason(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Season details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [seasonNumber, tmdbId]);

  useEffect(() => {
    void loadSeason();
  }, [loadSeason]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading season details</Text>
          </View>
        ) : error ? (
          <EmptyState body={error} title="Season detail failed">
            <Button label="Retry" onPress={loadSeason} />
          </EmptyState>
        ) : season ? (
          <SeasonDetailContent season={season} seriesTitle={route.params.seriesTitle} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function SeasonDetailContent({ season, seriesTitle }: { season: SeasonDetails; seriesTitle: string }) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { summary: progressSummary, watchedEpisodeNumbers } = useSeasonProgressSummary({
    episodeCount: season.episodes.length,
    seasonNumber: season.seasonNumber,
    seriesTmdbId: season.seriesTmdbId,
  });
  const episodeCount = `${season.episodes.length} episodes`;
  const metadata = [seriesTitle, `Season ${season.seasonNumber}`, season.airDate, episodeCount]
    .filter(Boolean)
    .join(' / ');

  return (
    <View>
      <View style={styles.header}>
        {season.posterUrl ? (
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={`${season.title} poster`}
            source={{ uri: season.posterUrl }}
            style={styles.poster}
          />
        ) : (
          <View style={styles.posterPlaceholder} />
        )}
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>TMDB season</Text>
          <Text style={styles.title}>{season.title}</Text>
          <Text style={styles.metadata}>{metadata}</Text>
        </View>
      </View>
      <ComputedRatingSummary
        seasonNumber={season.seasonNumber}
        seriesTmdbId={season.seriesTmdbId}
        title="My computed season rating"
      />
      {progressSummary}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Synopsis</Text>
        <Text style={styles.body}>{season.overview || 'No synopsis available yet.'}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Episodes</Text>
        {season.episodes.length > 0 ? (
          season.episodes.map((episode) => (
            <EpisodeRow
              episode={episode}
              key={episode.id}
              isWatched={watchedEpisodeNumbers.has(episode.episodeNumber)}
              onPress={() =>
                navigation.navigate('EpisodeDetail', {
                  episodeNumber: episode.episodeNumber,
                  seasonNumber: episode.seasonNumber,
                  seriesTitle,
                  title: episode.title,
                  tmdbId: season.seriesTmdbId,
                })
              }
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
  isWatched,
  onPress,
}: {
  episode: SeasonDetails['episodes'][number];
  isWatched: boolean;
  onPress: () => void;
}) {
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const isReleased = isReleasedDate(episode.airDate);
  const metadata = [
    `Episode ${episode.episodeNumber}`,
    episode.airDate,
    runtime,
    isReleased && episode.voteAverage ? episode.voteAverage.toFixed(1) : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <Pressable
      accessibilityLabel={`Open ${episode.title}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.episodeRow, pressed && styles.episodeRowPressed]}
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
      <View style={styles.episodeCopy}>
        <Text style={styles.episodeTitle}>{episode.title}</Text>
        <Text style={styles.episodeMeta}>{metadata}</Text>
        {isWatched ? <Text style={styles.watchedLabel}>Watched</Text> : null}
        <Text numberOfLines={3} style={styles.episodeOverview}>
          {episode.overview || 'No synopsis available yet.'}
        </Text>
      </View>
    </Pressable>
  );
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
    paddingTop: spacing.xxxl,
  },
  episodeCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  episodeMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  episodeOverview: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  episodeRow: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  episodeRowPressed: {
    opacity: 0.78,
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
  episodeTitle: {
    ...typography.title,
    color: colors.text,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
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
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 34,
  },
  watchedLabel: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
});
