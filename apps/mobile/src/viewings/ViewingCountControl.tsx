import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';
import { randomUUID } from 'expo-crypto';
import {
  EpisodeViewingSummary,
  getEpisodeViewingSummary,
  getMovieViewingSummary,
  getSeriesViewingSummary,
  MovieViewingSummary,
  SeriesViewingSummary,
  saveViewingHistory,
  ViewingHistoryDate,
  ViewingHistoryItem,
  ViewingTarget,
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
import { ViewingHistorySheet } from './ViewingHistorySheet';
import { localViewingDay, resolveHistoryDraft, toHistoryDraft } from './viewingHistoryModel';
import { getViewingHistoryUpdates, setViewingHistoryUpdate, viewingTargetKey } from './viewingHistoryUpdates';

type Props = {
  title?: string;
  onEditorClose?: () => void;
  variant?: 'activity' | 'default' | 'editor';
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
  const [editorHistory, setEditorHistory] = useState<ViewingHistoryItem[] | null>(null);
  const [summaryScope, setSummaryScope] = useState('');
  const lastConfirmedSummaryRef = useRef<Summary | null>(null);
  const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingMutationCountRef = useRef(0);
  const historyMutationVersionRef = useRef(0);
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
        if (cached && isCurrent() && !summaryRef.current) { setSummary(cached.data); setSummaryScope(scope); }
      }
      const token = await getFirebaseIdToken();

      if (!token || !isCurrent()) {
        return;
      }

      const loadedSummary = await getSummary(token, props);
      if (!isCurrent() || pendingMutationCountRef.current) return;
      setSummary(loadedSummary);
      setSummaryScope(scope);
      if (props.variant === 'editor' && 'history' in loadedSummary && loadedSummary.history) setEditorHistory((current) => current ?? loadedSummary.history!);
      if (cacheKey) void writePersistedCache(cacheKey, loadedSummary).catch(() => undefined);
    } catch {
      // Existing local data stays mounted while the backend refreshes silently.
      if (props.variant === 'editor') { showToast('Could not open viewing history. Try again.'); props.onEditorClose?.(); }
    }
  }, [cacheKey, firebaseIdToken, getFirebaseIdToken, requestScope, viewingRevision]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => { setEditorHistory(null); }, [requestScope]);

  async function openHistory() {
    if (props.contentType === 'series') return;
    const current = summaryRef.current;
    if (summaryScope === requestScope && current && 'history' in current && current.history) {
      setEditorHistory(current.history);
      return;
    }
    const scope = requestScope;
    try {
      const token = await getFirebaseIdToken();
      if (!token) return;
      const loaded = await getSummary(token, props);
      if (requestRef.current.scope !== scope) return;
      if ('history' in loaded && loaded.history) {
        setSummary(loaded); setSummaryScope(scope); setEditorHistory(loaded.history);
      } else showToast('Viewing history is unavailable. Try again.');
    } catch { showToast('Could not open viewing history. Try again.'); }
  }

  function saveHistory(entries: ViewingHistoryDate[], previous = editorHistory) {
    if (!currentUser || props.contentType === 'series' || !previous) return;
    const ownerId = currentUser.id;
    const scope = requestScope;
    const target: ViewingTarget = props.contentType === 'movie' ? { contentType: 'movie', tmdbId: props.tmdbId } : {
      contentType: 'episode', tmdbId: props.seriesTmdbId, seasonNumber: props.seasonNumber, episodeNumber: props.episodeNumber,
    };
    const previousSummary = summaryRef.current;
    const history = resolveHistoryDraft(entries, previous, localViewingDay());
    const optimisticSummary = { ...previousSummary, ...target, viewCount: history.length, history } as Summary;
    const mutationVersion = ++historyMutationVersionRef.current;
    if (!pendingMutationCountRef.current) lastConfirmedSummaryRef.current = previousSummary;
    setEditorHistory(null);
    props.onEditorClose?.();
    requestRef.current = { scope, version: requestRef.current.version + 1 };
    setSummary(optimisticSummary); summaryRef.current = optimisticSummary;
    if (cacheKey) void writePersistedCache(cacheKey, optimisticSummary).catch(() => undefined);
    setViewingHistoryUpdate(ownerId, target, { target, history, title: props.title, pending: true });
    pendingMutationCountRef.current += 1;
    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!token || requestRef.current.scope !== scope) throw new Error('Sign in again to save your viewing history.');
        const result = await saveViewingHistory(token, target, previous, entries);
        if (requestRef.current.scope !== scope || !getViewingHistoryUpdates(ownerId).some((item) => viewingTargetKey(item.target) === viewingTargetKey(target))) return;
        const confirmed = { ...optimisticSummary, history: result.items, viewCount: result.items.length };
        lastConfirmedSummaryRef.current = confirmed;
        if (mutationVersion !== historyMutationVersionRef.current) return;
        setSummary(confirmed); summaryRef.current = confirmed;
        if (cacheKey) void writePersistedCache(cacheKey, confirmed).catch(() => undefined);
        setViewingHistoryUpdate(ownerId, target, { target, history: result.items, title: props.title, pending: false });
        notifyUserDataChanged('viewings', ...(target.contentType === 'episode' ? ['episodeProgress' as const] : previous.length ? [] : ['tracking' as const]));
      } catch (error) {
        if (requestRef.current.scope !== scope || mutationVersion !== historyMutationVersionRef.current || !getViewingHistoryUpdates(ownerId).some((item) => viewingTargetKey(item.target) === viewingTargetKey(target))) return;
        const rollback = lastConfirmedSummaryRef.current;
        setViewingHistoryUpdate(ownerId, target, null);
        setSummary(rollback); summaryRef.current = rollback;
        if (cacheKey && rollback) void writePersistedCache(cacheKey, rollback).catch(() => undefined);
        hapticError(); showToast(error instanceof Error ? error.message : 'Could not save viewing history.');
        notifyUserDataChanged('viewings');
      } finally {
        pendingMutationCountRef.current -= 1;
      }
    };
    const queuedMutation = mutationQueueRef.current.then(commitMutation, commitMutation);
    mutationQueueRef.current = queuedMutation.catch(() => undefined);
  }

  function addQuickViewing() {
    const current = summaryRef.current;
    if (summaryScope !== requestScope || !current || !('history' in current) || !current.history || current.history.length >= 1000) return;
    saveHistory([...toHistoryDraft(current.history), { id: randomUUID(), watchedDate: localViewingDay() }], current.history);
  }

  if (!firebaseIdToken) {
    return null;
  }

  const viewCount = summaryScope === requestScope && summary && 'viewCount' in summary ? summary.viewCount : 0;
  const canEditDates = props.contentType !== 'series' && viewCount > 0;
  const editorTitle = props.contentType === 'episode' ? `${props.title ?? ''} · S${props.seasonNumber} E${props.episodeNumber}` : props.title;
  const editor = editorHistory !== null ? <ViewingHistorySheet history={editorHistory} onClose={() => { setEditorHistory(null); props.onEditorClose?.(); }} onSave={saveHistory} title={editorTitle} /> : null;

  if (props.variant === 'editor') return editor;
  const quickAdd = canEditDates ? <Pressable
    accessibilityLabel="Add one viewing today" accessibilityRole="button"
    disabled={viewCount >= 1000 || !summary || !('history' in summary) || !summary.history}
    onPress={addQuickViewing}
    style={({ pressed }) => [styles.rewatchButton, styles.quickAdd, pressed && styles.rewatchButtonPressed, viewCount >= 1000 && { opacity: 0.4 }]}
  ><Text style={styles.rewatchLabel}>+1</Text></Pressable> : null;

  if (props.variant === 'activity') {
    return (
      <><View style={styles.activityActions}><Pressable
        accessibilityHint="Edit viewing dates and total"
        accessibilityLabel={`Viewing dates, ${formatActivityViewingCount(viewCount)}`}
        accessibilityRole="button"
        disabled={props.contentType === 'series'}
        onPress={() => void openHistory()}
        style={({ pressed }) => [
          styles.activityContainer,
          pressed && styles.activityContainerPressed,
        ]}
      >
        <CalendarDays color={colors.accentText} size={23} strokeWidth={2.1} />
        <View style={{ flexShrink: 1 }}>
        <Text style={styles.rewatchLabel}>Viewing dates</Text>
        <Text accessibilityLiveRegion="polite" style={styles.activityValue}>
          {formatActivityViewingCount(viewCount)}
        </Text>
        </View>
      </Pressable>{quickAdd}</View>{editor}</>
    );
  }

  return (
    <><View style={styles.container}>
      <View style={styles.copy}>
        <Text style={styles.label}>VIEWING HISTORY</Text>
        <Text accessibilityLiveRegion="polite" style={styles.value}>
          {formatSummary(props, summaryScope === requestScope ? summary : null)}
        </Text>
      </View>
      {canEditDates ? (
        <View style={styles.dateActions}>
        <Pressable
          accessibilityLabel="Viewing dates"
          accessibilityRole="button"
          onPress={() => void openHistory()}
          style={({ pressed }) => [
            styles.rewatchButton,
            pressed ? styles.rewatchButtonPressed : null,
          ]}
        >
          <CalendarDays color={colors.accentText} size={15} strokeWidth={2.3} />
          <Text style={styles.rewatchLabel}>Viewing dates</Text>
        </Pressable>
        {quickAdd}
        </View>
      ) : null}
    </View>{editor}</>
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
  activityActions: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dateActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  quickAdd: { minWidth: touchTargets.min },
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
