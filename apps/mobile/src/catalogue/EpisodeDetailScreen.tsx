import { useCallback, useEffect, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EpisodeDetails, getEpisodeDetails } from '../api/catalogue';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { EpisodeReviewEditor } from '../reviews/EpisodeReviewEditor';
import { EpisodeProgressControl } from '../tracking/EpisodeProgressControl';
import { EpisodeRatingControl } from '../tracking/EpisodeRatingControl';
import { isReleasedDate } from './releaseDates';

type EpisodeDetailScreenProps = NativeStackScreenProps<RootStackParamList, 'EpisodeDetail'>;

export function EpisodeDetailScreen({ route }: EpisodeDetailScreenProps) {
  const { episodeNumber, seasonNumber, tmdbId } = route.params;
  const [episode, setEpisode] = useState<EpisodeDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadEpisode = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await getEpisodeDetails(tmdbId, seasonNumber, episodeNumber);

      setEpisode(response.item);
    } catch (caughtError) {
      setEpisode(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Episode details failed.');
    } finally {
      setIsLoading(false);
    }
  }, [episodeNumber, seasonNumber, tmdbId]);

  useEffect(() => {
    void loadEpisode();
  }, [loadEpisode]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>Loading episode details</Text>
          </View>
        ) : error ? (
          <EmptyState body={error} title="Episode detail failed">
            <Button label="Retry" onPress={loadEpisode} />
          </EmptyState>
        ) : episode ? (
          <EpisodeDetailContent episode={episode} seriesTitle={route.params.seriesTitle} />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function EpisodeDetailContent({
  episode,
  seriesTitle,
}: {
  episode: EpisodeDetails;
  seriesTitle: string;
}) {
  const runtime = episode.runtimeMinutes ? `${episode.runtimeMinutes}m` : null;
  const isReleased = isReleasedDate(episode.airDate);
  const metadata = [
    seriesTitle,
    `S${episode.seasonNumber}`,
    `E${episode.episodeNumber}`,
    episode.airDate,
    runtime,
    isReleased && episode.voteAverage ? episode.voteAverage.toFixed(1) : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <View>
      {episode.stillUrl ? (
        <Image
          accessibilityIgnoresInvertColors
          accessibilityLabel={`${episode.title} still`}
          source={{ uri: episode.stillUrl }}
          style={styles.still}
        />
      ) : (
        <View style={styles.stillPlaceholder} />
      )}
      <Text style={styles.eyebrow}>TMDB episode</Text>
      <Text style={styles.title}>{episode.title}</Text>
      <Text style={styles.metadata}>{metadata}</Text>
      <EpisodeProgressControl
        episodeNumber={episode.episodeNumber}
        seasonNumber={episode.seasonNumber}
        seriesTmdbId={episode.seriesTmdbId}
      />
      {isReleased ? (
        <>
          <EpisodeRatingControl
            episodeNumber={episode.episodeNumber}
            seasonNumber={episode.seasonNumber}
            seriesTmdbId={episode.seriesTmdbId}
          />
          <EpisodeReviewEditor
            episodeNumber={episode.episodeNumber}
            seasonNumber={episode.seasonNumber}
            seriesTmdbId={episode.seriesTmdbId}
          />
        </>
      ) : null}
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Synopsis</Text>
        <Text style={styles.body}>{episode.overview || 'No synopsis available yet.'}</Text>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="TMDB ID" value={String(episode.tmdbId)} />
        <DetailRow label="Season" value={String(episode.seasonNumber)} />
        <DetailRow label="Episode" value={String(episode.episodeNumber)} />
        <DetailRow label="Air date" value={episode.airDate ?? 'Unknown'} />
        <DetailRow label="Runtime" value={runtime ?? 'Unknown'} />
      </View>
    </View>
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
    marginBottom: spacing.sm,
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
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  still: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 190,
    marginBottom: spacing.lg,
    width: '100%',
  },
  stillPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 190,
    marginBottom: spacing.lg,
    width: '100%',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 36,
  },
});
