import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { listSeriesProgress } from '../api/progress';
import { getSeriesViewingSummary } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { SeriesDetails } from '../api/catalogue';
import { colors, radii, shadows, spacing } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useUserDataRevision } from '../sync/userDataEvents';
import { ensureSeasonDetails } from '../catalogue/cataloguePrefetch';
import { findNextSeriesEpisode, getSeriesRewatchAnchor } from '../catalogue/whatsNextModel';

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
  const { currentUser, firebaseIdToken } = useAuthSession();
  const episodeProgressRevision = useUserDataRevision('episodeProgress', 'viewings');

  const loadProgress = useCallback(async () => {
    const [progress, viewings] = await Promise.all([
      listSeriesProgress(firebaseIdToken!, seriesTmdbId),
      getSeriesViewingSummary(firebaseIdToken!, seriesTmdbId),
    ]);
    const anchor = getSeriesRewatchAnchor(viewings.episodes ?? []);
    const watched = anchor ? (viewings.episodes ?? []).filter((item) => item.latestLoggedAt >= anchor.latestLoggedAt) : progress.episodes;
    const episode = await findNextSeriesEpisode(seasons, watched,
      async (seasonNumber) => (await ensureSeasonDetails(seriesTmdbId, seasonNumber)).item,
      undefined, anchor);
    return { episode, watchedCount: progress.watchedEpisodeCount };
  }, [episodeProgressRevision, firebaseIdToken, seasons, seriesTmdbId]);
  const resource = useCachedResource({
    enabled: Boolean(currentUser && firebaseIdToken),
    key: getPrivateCacheKey(currentUser?.id ?? 'visitor', `whats-next:series:${seriesTmdbId}:v2`),
    load: loadProgress,
  });
  const resumeEpisode = resource.data?.episode ?? null;
  const body = !resource.data
    ? resource.error ? 'Could not load your next episode.' : 'Finding your next episode…'
    : getBody({ resumeEpisode, watchedCount: resource.data.watchedCount });

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
          <Text style={styles.sectionTitle}>What's next</Text>
          <Text style={styles.body}>{body}</Text>
        </View>
        {!resource.data && resource.error ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry next episode" onPress={resource.retry}
            style={styles.compactButton}>
            <Text style={styles.compactButtonText}>Retry</Text>
          </Pressable>
        ) : firebaseIdToken && resumeEpisode ? (
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
    return 'Start at season 1, episode 1.';
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
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
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
