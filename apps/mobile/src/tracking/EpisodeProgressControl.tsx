import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { clearEpisodeProgress, EpisodeProgress, getEpisodeProgress, markEpisodeWatched } from '../api/progress';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type EpisodeProgressControlProps = {
  episodeNumber: number;
  seasonNumber: number;
  seriesTmdbId: number;
};

export function EpisodeProgressControl({
  episodeNumber,
  seasonNumber,
  seriesTmdbId,
}: EpisodeProgressControlProps) {
  const { firebaseIdToken, notifyTrackingChanged } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<EpisodeProgress | null>(null);

  const loadProgress = useCallback(async () => {
    if (!firebaseIdToken) {
      setProgress(null);
      setError(null);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setProgress(await getEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber));
    } catch {
      setError('Could not load your episode progress.');
    } finally {
      setIsLoading(false);
    }
  }, [episodeNumber, firebaseIdToken, seasonNumber, seriesTmdbId]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  async function markWatched() {
    if (!firebaseIdToken || isSaving) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      setProgress(await markEpisodeWatched(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber));
      notifyTrackingChanged();
    } catch {
      setError('Could not save your episode progress.');
    } finally {
      setIsSaving(false);
    }
  }

  async function clearProgress() {
    if (!firebaseIdToken || isSaving || !progress) {
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await clearEpisodeProgress(firebaseIdToken, seriesTmdbId, seasonNumber, episodeNumber);
      setProgress(null);
      notifyTrackingChanged();
    } catch {
      setError('Could not clear your episode progress.');
    } finally {
      setIsSaving(false);
    }
  }

  const isWatched = progress !== null;

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.copy}>
          <Text style={styles.sectionTitle}>My progress</Text>
          <Text style={styles.body}>
            {firebaseIdToken
              ? isWatched
                ? `Watched ${formatWatchedAt(progress.watchedAt)}`
                : 'Mark this episode and earlier episodes in this season as watched.'
              : 'Sign in from Profile to track episode progress.'}
          </Text>
        </View>
        {isLoading || isSaving ? <ActivityIndicator color={colors.accent} /> : null}
      </View>

      {firebaseIdToken ? (
        <View style={styles.actions}>
          {isWatched ? (
            <Button disabled={isSaving} label="Mark unwatched" onPress={clearProgress} variant="secondary" />
          ) : (
            <Button disabled={isSaving} label="Mark watched" onPress={markWatched} />
          )}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function formatWatchedAt(value: string) {
  return new Date(value).toLocaleDateString();
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
