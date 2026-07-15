import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { listSeasonProgress, SeasonProgress } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { useToast } from '../notifications/ToastContext';

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
  const { currentUser, firebaseIdToken, trackingRevision } = useAuthSession();
  const { showToast } = useToast();

  const loadProgress = useCallback(async (): Promise<SeasonProgress> => {
    try {
      return await listSeasonProgress(firebaseIdToken!, seriesTmdbId, seasonNumber);
    } catch {
      showToast('Could not load your season progress.');
      throw new Error('Could not update your season progress.');
    }
  }, [firebaseIdToken, seasonNumber, seriesTmdbId, showToast, trackingRevision]);
  const resource = useCachedResource({
    enabled: Boolean(currentUser && firebaseIdToken),
    key: getPrivateCacheKey(
      currentUser?.id ?? 'visitor',
      `season-progress:${seriesTmdbId}:${seasonNumber}:v1`,
    ),
    load: loadProgress,
  });
  const progress = resource.data;

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
                : 'Sign in to track episode progress.'}
            </Text>
          </View>

        </View>
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
