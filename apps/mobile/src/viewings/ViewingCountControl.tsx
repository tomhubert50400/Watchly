import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RotateCcw } from 'lucide-react-native';
import {
  EpisodeViewingSummary,
  getEpisodeViewingSummary,
  getMovieViewingSummary,
  getSeriesViewingSummary,
  logEpisodeViewing,
  logMovieViewing,
  MovieViewingSummary,
  SeriesViewingSummary,
} from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { colors, radii, spacing, touchTargets } from '../design/tokens';
import { hapticConfirm, hapticError } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';

type Props =
  | { contentType: 'movie'; tmdbId: number }
  | { contentType: 'series'; seriesTmdbId: number }
  | {
      contentType: 'episode';
      episodeNumber: number;
      seasonNumber: number;
      seriesTmdbId: number;
    };

type Summary = MovieViewingSummary | SeriesViewingSummary | EpisodeViewingSummary;

export function ViewingCountControl(props: Props) {
  const {
    firebaseIdToken,
    getFirebaseIdToken,
    notifyTrackingChanged,
    trackingRevision,
  } = useAuthSession();
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const resourceKey = getResourceKey(props);

  const loadSummary = useCallback(async () => {
    if (!firebaseIdToken) {
      setSummary(null);
      return;
    }

    setIsLoading(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        return;
      }

      setSummary(await getSummary(token, props));
    } catch {
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, getFirebaseIdToken, resourceKey, trackingRevision]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function logAnotherWatch() {
    if (!firebaseIdToken || isSaving || props.contentType === 'series') {
      return;
    }

    setIsSaving(true);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to log another watch.');
      }

      const next = props.contentType === 'movie'
        ? await logMovieViewing(token, props.tmdbId)
        : await logEpisodeViewing(
            token,
            props.seriesTmdbId,
            props.seasonNumber,
            props.episodeNumber,
          );

      setSummary(next);
      notifyTrackingChanged();
      hapticConfirm();
      showToast('Another watch was logged.', 'success');
    } catch (error) {
      hapticError();
      showToast(error instanceof Error ? error.message : 'Could not log another watch.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!firebaseIdToken) {
    return null;
  }

  if (isLoading && !summary) {
    return null;
  }

  const viewCount = summary && 'viewCount' in summary ? summary.viewCount : 0;
  const canLogAgain = props.contentType !== 'series' && viewCount > 0;

  return (
    <View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.label}>VIEWING HISTORY</Text>
        <Text accessibilityLiveRegion="polite" style={styles.value}>
          {formatSummary(props, summary)}
        </Text>
      </View>
      {canLogAgain ? (
        <Pressable
          accessibilityLabel="Log another watch"
          accessibilityRole="button"
          disabled={isSaving}
          onPress={() => void logAnotherWatch()}
          style={({ pressed }) => [
            styles.rewatchButton,
            pressed ? styles.rewatchButtonPressed : null,
            isSaving ? styles.rewatchButtonDisabled : null,
          ]}
        >
          {isSaving
            ? <ActivityIndicator color={colors.accentText} size="small" />
            : <RotateCcw color={colors.accentText} size={15} strokeWidth={2.3} />}
          <Text style={styles.rewatchLabel}>Log another watch</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function getSummary(token: string, props: Props) {
  if (props.contentType === 'movie') {
    return getMovieViewingSummary(token, props.tmdbId);
  }

  if (props.contentType === 'series') {
    return getSeriesViewingSummary(token, props.seriesTmdbId);
  }

  return getEpisodeViewingSummary(
    token,
    props.seriesTmdbId,
    props.seasonNumber,
    props.episodeNumber,
  );
}

function getResourceKey(props: Props) {
  if (props.contentType === 'movie') {
    return `movie:${props.tmdbId}`;
  }

  if (props.contentType === 'series') {
    return `series:${props.seriesTmdbId}`;
  }

  return `episode:${props.seriesTmdbId}:${props.seasonNumber}:${props.episodeNumber}`;
}

function formatSummary(props: Props, summary: Summary | null) {
  if (!summary) {
    return 'View count unavailable';
  }

  if (props.contentType === 'series' && 'watchedEpisodeCount' in summary) {
    const episodeLabel = summary.watchedEpisodeCount === 1 ? 'episode watched' : 'episodes watched';
    const rewatchLabel = summary.rewatchCount === 1 ? 'rewatch' : 'rewatches';

    return `${summary.watchedEpisodeCount} ${episodeLabel}, ${summary.rewatchCount} ${rewatchLabel}`;
  }

  const viewCount = 'viewCount' in summary ? summary.viewCount : 0;

  if (viewCount === 0) {
    return 'Not watched yet';
  }

  return `Watched ${viewCount} ${viewCount === 1 ? 'time' : 'times'}`;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    minHeight: 66,
    paddingVertical: spacing.sm,
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  rewatchButton: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.sm,
  },
  rewatchButtonDisabled: {
    opacity: 0.55,
  },
  rewatchButtonPressed: {
    backgroundColor: 'rgba(212, 58, 92, 0.22)',
  },
  rewatchLabel: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: '800',
  },
  value: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
