import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { getSeriesRatingSummary, SeriesRatingSummary } from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { useUserDataRevision } from '../sync/userDataEvents';

type ComputedRatingSummaryProps = {
  seasonNumber?: number;
  seriesTmdbId: number;
  title: string;
};

export function ComputedRatingSummary({
  seasonNumber,
  seriesTmdbId,
  title,
}: ComputedRatingSummaryProps) {
  const { currentUser, firebaseIdToken } = useAuthSession();
  const opinionRevision = useUserDataRevision('opinions');

  const loadSummary = useCallback(
    (): Promise<SeriesRatingSummary> => getSeriesRatingSummary(firebaseIdToken!, seriesTmdbId),
    [firebaseIdToken, opinionRevision, seriesTmdbId],
  );
  const resource = useCachedResource({
    enabled: Boolean(currentUser && firebaseIdToken),
    key: getPrivateCacheKey(currentUser?.id ?? 'visitor', `series-rating:${seriesTmdbId}:v1`),
    load: loadSummary,
  });
  const summary = resource.data;

  if (!firebaseIdToken) {
    return (
      <SignInRequiredCard
        body="You need to be signed in to use personal ratings. Sign in here to rate episodes and see your computed score."
        title="Sign in to see your rating"
      />
    );
  }

  const computed = getComputedRating(summary, seasonNumber);
  const body = getBody({
    averageScore: computed.averageScore,
    ratedEpisodeCount: computed.ratedEpisodeCount,
    seasonNumber,
  });

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
        </View>

      </View>
      {computed.averageScore !== null ? (
        <Text style={styles.score}>{formatScore(computed.averageScore)}/5</Text>
      ) : null}
    </View>
  );
}

function getComputedRating(summary: SeriesRatingSummary | null, seasonNumber: number | undefined) {
  if (!summary) {
    return {
      averageScore: null,
      ratedEpisodeCount: 0,
    };
  }

  if (seasonNumber === undefined) {
    return {
      averageScore: summary.averageScore,
      ratedEpisodeCount: summary.ratedEpisodeCount,
    };
  }

  const seasonSummary = summary.seasons.find((season) => season.seasonNumber === seasonNumber);

  return {
    averageScore: seasonSummary?.averageScore ?? null,
    ratedEpisodeCount: seasonSummary?.ratedEpisodeCount ?? 0,
  };
}

function getBody({
  averageScore,
  ratedEpisodeCount,
  seasonNumber,
}: {
  averageScore: number | null;
  ratedEpisodeCount: number;
  seasonNumber: number | undefined;
}) {
  if (averageScore === null) {
    return seasonNumber === undefined
      ? 'Rate episodes to compute your series rating.'
      : 'Rate episodes in this season to compute your season rating.';
  }

  return `Computed from ${ratedEpisodeCount} rated episode${ratedEpisodeCount === 1 ? '' : 's'}.`;
}

function formatScore(score: number) {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
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
  score: {
    color: colors.accent,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 38,
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
});
