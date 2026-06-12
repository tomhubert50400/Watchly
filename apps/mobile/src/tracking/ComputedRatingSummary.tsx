import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { getSeriesRatingSummary, SeriesRatingSummary } from '../api/ratings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

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
  const { firebaseIdToken } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState<SeriesRatingSummary | null>(null);

  const loadSummary = useCallback(async () => {
    if (!firebaseIdToken) {
      setSummary(null);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setSummary(await getSeriesRatingSummary(firebaseIdToken, seriesTmdbId));
    } catch {
      setError('Could not load your computed rating.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, seriesTmdbId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  const computed = getComputedRating(summary, seasonNumber);
  const body = getBody({
    averageScore: computed.averageScore,
    isSignedIn: Boolean(firebaseIdToken),
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
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>
      {computed.averageScore !== null ? (
        <Text style={styles.score}>{formatScore(computed.averageScore)}/5</Text>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  isSignedIn,
  ratedEpisodeCount,
  seasonNumber,
}: {
  averageScore: number | null;
  isSignedIn: boolean;
  ratedEpisodeCount: number;
  seasonNumber: number | undefined;
}) {
  if (!isSignedIn) {
    return 'Sign in from Profile to see your computed ratings.';
  }

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
