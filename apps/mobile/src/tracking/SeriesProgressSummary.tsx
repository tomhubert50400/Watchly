import { useCallback, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listSeriesProgress, SeriesProgress } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { SeriesDetails } from '../api/catalogue';
import { colors, radii, shadows, spacing } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useToast } from '../notifications/ToastContext';

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
  const { currentUser, firebaseIdToken, trackingRevision } = useAuthSession();
  const { showToast } = useToast();

  const loadProgress = useCallback(async (): Promise<SeriesProgress> => {
    try {
      return await listSeriesProgress(firebaseIdToken!, seriesTmdbId);
    } catch {
      showToast('Could not load your series progress.');
      throw new Error('Could not update your series progress.');
    }
  }, [firebaseIdToken, seriesTmdbId, showToast, trackingRevision]);
  const resource = useCachedResource({
    enabled: Boolean(currentUser && firebaseIdToken),
    key: getPrivateCacheKey(currentUser?.id ?? 'visitor', `series-progress:${seriesTmdbId}:v1`),
    load: loadProgress,
  });
  const progress = resource.data;

  const resumeEpisode = useMemo(
    () => getResumeEpisode(seasons, progress),
    [progress, seasons],
  );
  const watchedCount = progress?.watchedEpisodeCount ?? 0;
  const body = getBody({
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

  if (!firebaseIdToken) {
    return (
      <SignInRequiredCard
        body="You need to be signed in to track this series. Sign in here to save progress and continue watching."
        title="Sign in to track this series"
      />
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>Continue watching</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {firebaseIdToken && resumeEpisode ? (
          <Pressable
            accessibilityLabel="Open next episode"
            accessibilityRole="button"
            onPress={openResumeEpisode}
            style={({ pressed }) => [styles.compactButton, pressed && styles.compactButtonPressed]}
          >
            <Text style={styles.compactButtonText}>Open</Text>
          </Pressable>
        ) : null}
      </View>
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
  resumeEpisode,
  watchedCount,
}: {
  resumeEpisode: ResumeEpisode | null;
  watchedCount: number;
}) {
  if (!resumeEpisode) {
    return watchedCount > 0 ? 'All available episodes are marked watched.' : 'No episodes available to resume.';
  }

  if (resumeEpisode.seasonNumber === 1 && resumeEpisode.episodeNumber === 1) {
    return 'Start to watch';
  }

  const prefix = watchedCount === 0 ? 'Start at' : 'Continue at';

  return `${prefix} season ${resumeEpisode.seasonNumber}, episode ${resumeEpisode.episodeNumber}.`;
}

const styles = StyleSheet.create({
  body: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  compactButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    borderRadius: radii.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  compactButtonPressed: {
    opacity: 0.84,
  },
  compactButtonText: {
    color: colors.textOnAccent,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
  },
  copy: {
    flex: 1,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.interactiveSurface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 20,
  },
});
