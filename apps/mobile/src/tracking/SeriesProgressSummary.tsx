import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { listSeriesProgress, SeriesProgress } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { SeriesDetails } from '../api/catalogue';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';

type SeriesProgressSummaryProps = {
  seasons: SeriesDetails['seasons'];
  seriesTitle: string;
  seriesTmdbId: number;
};

type ResumeEpisode = {
  episodeNumber: number;
  seasonNumber: number;
};

export function SeriesProgressSummary({
  seasons,
  seriesTitle,
  seriesTmdbId,
}: SeriesProgressSummaryProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { firebaseIdToken, trackingRevision } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<SeriesProgress | null>(null);

  const loadProgress = useCallback(async () => {
    if (!firebaseIdToken) {
      setProgress(null);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setProgress(await listSeriesProgress(firebaseIdToken, seriesTmdbId));
    } catch {
      setError('Could not load your series progress.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, seriesTmdbId]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress, trackingRevision]),
  );

  const resumeEpisode = useMemo(
    () => getResumeEpisode(seasons, progress),
    [progress, seasons],
  );
  const watchedCount = progress?.watchedEpisodeCount ?? 0;
  const body = getBody({
    isSignedIn: Boolean(firebaseIdToken),
    resumeEpisode,
    watchedCount,
  });

  function openResumeEpisode() {
    if (!resumeEpisode) {
      return;
    }

    navigation.navigate('EpisodeDetail', {
      episodeNumber: resumeEpisode.episodeNumber,
      seasonNumber: resumeEpisode.seasonNumber,
      seriesTitle,
      title: `S${resumeEpisode.seasonNumber} E${resumeEpisode.episodeNumber}`,
      tmdbId: seriesTmdbId,
    });
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>Continue watching</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {isLoading ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {firebaseIdToken && resumeEpisode ? (
        <View style={styles.actions}>
          <Button label="Open episode" onPress={openResumeEpisode} />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function getResumeEpisode(seasons: SeriesDetails['seasons'], progress: SeriesProgress | null): ResumeEpisode | null {
  const orderedSeasons = seasons
    .filter((season) => season.seasonNumber > 0 && (season.episodeCount ?? 0) > 0)
    .sort((left, right) => left.seasonNumber - right.seasonNumber);

  if (orderedSeasons.length === 0) {
    return null;
  }

  if (!progress || progress.episodes.length === 0) {
    return {
      episodeNumber: 1,
      seasonNumber: orderedSeasons[0].seasonNumber,
    };
  }

  const latestWatched = [...progress.episodes].sort((left, right) => {
    if (left.seasonNumber !== right.seasonNumber) {
      return right.seasonNumber - left.seasonNumber;
    }

    return right.episodeNumber - left.episodeNumber;
  })[0];
  const currentSeason = orderedSeasons.find((season) => season.seasonNumber === latestWatched.seasonNumber);
  const currentSeasonEpisodeCount = currentSeason?.episodeCount ?? 0;

  if (currentSeason && latestWatched.episodeNumber < currentSeasonEpisodeCount) {
    return {
      episodeNumber: latestWatched.episodeNumber + 1,
      seasonNumber: latestWatched.seasonNumber,
    };
  }

  const nextSeason = orderedSeasons.find((season) => season.seasonNumber > latestWatched.seasonNumber);

  if (!nextSeason) {
    return null;
  }

  return {
    episodeNumber: 1,
    seasonNumber: nextSeason.seasonNumber,
  };
}

function getBody({
  isSignedIn,
  resumeEpisode,
  watchedCount,
}: {
  isSignedIn: boolean;
  resumeEpisode: ResumeEpisode | null;
  watchedCount: number;
}) {
  if (!isSignedIn) {
    return 'Sign in from Profile to resume this series.';
  }

  if (!resumeEpisode) {
    return watchedCount > 0 ? 'All available episodes are marked watched.' : 'No episodes available to resume.';
  }

  const prefix = watchedCount === 0 ? 'Start at' : 'Continue at';

  return `${prefix} season ${resumeEpisode.seasonNumber}, episode ${resumeEpisode.episodeNumber}.`;
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },
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
