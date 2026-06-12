import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listSeasonProgress, SeasonProgress } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type SeasonProgressSummaryProps = {
  episodeCount: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function useSeasonProgressSummary({
  episodeCount,
  seasonNumber,
  seriesTmdbId,
}: SeasonProgressSummaryProps) {
  const { firebaseIdToken, trackingRevision } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<SeasonProgress | null>(null);

  const loadProgress = useCallback(async () => {
    if (!firebaseIdToken) {
      setProgress(null);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setProgress(await listSeasonProgress(firebaseIdToken, seriesTmdbId, seasonNumber));
    } catch {
      setError('Could not load your season progress.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, seasonNumber, seriesTmdbId]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress, trackingRevision]),
  );

  const watchedEpisodeNumbers = useMemo(
    () => new Set(progress?.episodes.map((episode) => episode.episodeNumber) ?? []),
    [progress],
  );

  return {
    summary: (
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <View style={styles.copy}>
            <Text style={styles.sectionTitle}>My season progress</Text>
            <Text style={styles.body}>
              {firebaseIdToken
                ? `${progress?.watchedEpisodeCount ?? 0}/${episodeCount} watched`
                : 'Sign in from Profile to track episode progress.'}
            </Text>
          </View>
          {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    ),
    watchedEpisodeNumbers,
  };
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  copy: {
    flex: 1,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    marginTop: spacing.md,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
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
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
