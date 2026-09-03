import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { History, RotateCcw } from 'lucide-react-native';
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
import {
  getPrivateCacheKey,
  readPersistedCache,
  writePersistedCache,
} from '../cache/persistedCache';
import { colors, radii, spacing, touchTargets } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';
import { notifyUserDataChanged, useUserDataRevision } from '../sync/userDataEvents';

type Props = {
  variant?: 'activity' | 'default';
} & (
  | { contentType: 'movie'; tmdbId: number }
  | { contentType: 'series'; seriesTmdbId: number }
  | {
      contentType: 'episode';
      episodeNumber: number;
      seasonNumber: number;
      seriesTmdbId: number;
    }
);

type Summary = MovieViewingSummary | SeriesViewingSummary | EpisodeViewingSummary;

export function ViewingCountControl(props: Props) {
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
  } = useAuthSession();
  const viewingRevision = useUserDataRevision('episodeProgress', 'viewings');
  const { showToast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const lastConfirmedSummaryRef = useRef<Summary | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const summaryRef = useRef(summary);
  const resourceKey = getResourceKey(props);
  const cacheKey = currentUser
    ? getPrivateCacheKey(currentUser.id, `viewings:${resourceKey}`)
    : null;
  const requestScope = `${currentUser?.id ?? 'signed-out'}:${resourceKey}`;
  const requestRef = useRef({ scope: requestScope, version: 0 });
  summaryRef.current = summary;

  if (requestRef.current.scope !== requestScope) {
    requestRef.current = { scope: requestScope, version: requestRef.current.version + 1 };
  }

  const loadSummary = useCallback(async () => {
    const scope = requestScope;
    const version = requestRef.current.version + 1;
    requestRef.current = { scope, version };
    const isCurrent = () => requestRef.current.scope === scope && requestRef.current.version === version;

    if (!firebaseIdToken) {
      if (isCurrent()) setSummary(null);
      return;
    }

    try {
      if (cacheKey) {
        const cached = await readPersistedCache<Summary>(cacheKey).catch(() => null);
        if (cached && isCurrent()) setSummary(cached.data);
      }
      const token = await getFirebaseIdToken();

      if (!token || !isCurrent()) {
        return;
      }

      const loadedSummary = await getSummary(token, props);
      if (!isCurrent()) return;
      setSummary(loadedSummary);
      if (cacheKey) void writePersistedCache(cacheKey, loadedSummary).catch(() => undefined);
    } catch {
      // Existing local data stays mounted while the backend refreshes silently.
    }
  }, [cacheKey, firebaseIdToken, getFirebaseIdToken, requestScope, viewingRevision]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  async function logAnotherWatch() {
    if (!firebaseIdToken || props.contentType === 'series') {
      return;
    }
    const scope = requestScope;
    requestRef.current = { scope, version: requestRef.current.version + 1 };
    const currentSummary = summaryRef.current;
    if (!currentSummary || !('viewCount' in currentSummary)) return;

    const optimisticSummary = { ...currentSummary, viewCount: currentSummary.viewCount + 1 };
    setSummary(optimisticSummary);
    summaryRef.current = optimisticSummary;
    if (cacheKey) void writePersistedCache(cacheKey, optimisticSummary).catch(() => undefined);
    pendingMutationCountRef.current += 1;

    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token) throw new Error('Sign in again to log another watch.');

        lastConfirmedSummaryRef.current = props.contentType === 'movie'
          ? await logMovieViewing(token, props.tmdbId)
          : await logEpisodeViewing(
              token,
              props.seriesTmdbId,
              props.seasonNumber,
              props.episodeNumber,
            );
      } catch (error) {
        const rolledBack = summaryRef.current && 'viewCount' in summaryRef.current
          ? { ...summaryRef.current, viewCount: Math.max(0, summaryRef.current.viewCount - 1) }
          : summaryRef.current;
        setSummary(rolledBack);
        summaryRef.current = rolledBack;
        if (cacheKey && rolledBack) {
          void writePersistedCache(cacheKey, rolledBack).catch(() => undefined);
        }
        hapticError();
        showToast(error instanceof Error ? error.message : 'Could not log another watch.');
      } finally {
        pendingMutationCountRef.current -= 1;
        if (pendingMutationCountRef.current === 0 && requestRef.current.scope === scope) {
          const confirmed = lastConfirmedSummaryRef.current;
          if (confirmed) {
            setSummary(confirmed);
            summaryRef.current = confirmed;
            if (cacheKey) void writePersistedCache(cacheKey, confirmed).catch(() => undefined);
          }
          lastConfirmedSummaryRef.current = null;
          notifyUserDataChanged('viewings');
        }
      }
    };
    const queuedMutation = mutationQueueRef.current.then(commitMutation, commitMutation);
    mutationQueueRef.current = queuedMutation.catch(() => undefined);
    await queuedMutation;
  }

  if (!firebaseIdToken) {
    return null;
  }

  const viewCount = summary && 'viewCount' in summary ? summary.viewCount : 0;
  const canLogAgain = props.contentType !== 'series' && viewCount > 0;

  if (props.variant === 'activity') {
    return (
      <Pressable
        accessibilityHint={canLogAgain ? 'Logs another viewing' : undefined}
        accessibilityLabel={formatActivityViewingCount(viewCount)}
        accessibilityRole={canLogAgain ? 'button' : 'text'}
        disabled={!canLogAgain}
        onPress={canLogAgain ? () => void logAnotherWatch() : undefined}
        style={({ pressed }) => [
          styles.activityContainer,
          pressed && styles.activityContainerPressed,
        ]}
      >
        <History color={colors.textMuted} size={23} strokeWidth={2.1} />
        <Text accessibilityLiveRegion="polite" style={styles.activityValue}>
          {formatActivityViewingCount(viewCount)}
        </Text>
      </Pressable>
    );
  }

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
          onPress={() => void logAnotherWatch()}
          style={({ pressed }) => [
            styles.rewatchButton,
            pressed ? styles.rewatchButtonPressed : null,
          ]}
        >
          <RotateCcw color={colors.accentText} size={15} strokeWidth={2.3} />
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

function formatActivityViewingCount(viewCount: number) {
  return `${viewCount} ${viewCount === 1 ? 'viewing' : 'viewings'}`;
}

const styles = StyleSheet.create({
  activityContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 58,
  },
  activityContainerPressed: {
    opacity: 0.72,
  },
  activityValue: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
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
