import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Clock3, Crown, Users } from 'lucide-react-native';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import {
  closeSharedVotingSession,
  getSharedWatchlist,
  removeSharedCandidateVote,
  type SharedVotingSession,
  type SharedWatchlist,
  voteForSharedCandidate,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import {
  beginOptimisticClose,
  beginOptimisticVote,
  canCloseVote,
  getSelectedCandidateIds,
  getVoteLifecycle,
  getVoteLeaders,
  getVoteRemainingLabel,
  rollbackVoteMutation,
} from './sharedVoteModel';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedVotingSession'>;
type CandidateMedia = { genres: string[]; posterUrl: string | null; title: string | null };
type VoteDetails = {
  candidateMedia: Record<string, CandidateMedia>;
  isOwner: boolean;
  memberCount: number;
  members: SharedWatchlist['members'];
  session: SharedVotingSession;
  watchlistName: string;
};
type OwnedVote = { data: VoteDetails | null; ownerId: string | null };

export function SharedVoteScreen({ route }: Props) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const ownerId = currentUser?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const cacheResource = `shared-vote:${route.params.watchlistId}:${route.params.sessionId}:v1`;
  const cacheKey = getPrivateCacheKey(ownerId ?? 'visitor', cacheResource);
  const load = useCallback(async (): Promise<VoteDetails> => {
    const expectedOwnerId = ownerId;
    const token = await getFirebaseIdToken();
    if (!expectedOwnerId || ownerIdRef.current !== expectedOwnerId || !token) {
      throw new Error('Sign in again to load this private vote.');
    }
    const watchlist = await getSharedWatchlist(token, route.params.watchlistId);
    if (ownerIdRef.current !== expectedOwnerId) throw new Error('The active account changed while loading this vote.');
    const session = watchlist.votingSessions.find((item) => item.id === route.params.sessionId);
    if (!session) throw new Error('This voting session is no longer available.');

    const entries = await Promise.all(session.candidates.map(async (candidate): Promise<[string, CandidateMedia]> => {
      try {
        const media = candidate.contentType === 'movie'
          ? await refreshMovie(candidate.tmdbId)
          : await refreshSeries(candidate.tmdbId);
        return [candidate.id, { genres: media.genres, posterUrl: media.posterUrl, title: media.title }];
      } catch {
        return [candidate.id, { genres: [], posterUrl: null, title: null }];
      }
    }));
    if (ownerIdRef.current !== expectedOwnerId) throw new Error('The active account changed while loading this vote.');
    return {
      candidateMedia: Object.fromEntries(entries),
      isOwner: watchlist.isOwner,
      memberCount: watchlist.memberCount,
      members: watchlist.members,
      session,
      watchlistName: watchlist.name,
    };
  }, [getFirebaseIdToken, ownerId, refreshMovie, refreshSeries, route.params.sessionId, route.params.watchlistId]);
  const resource = useCachedResource<VoteDetails>({ enabled: Boolean(ownerId && firebaseIdToken), key: cacheKey, load });
  const [ownedVote, setOwnedVote] = useState<OwnedVote>({ data: null, ownerId: null });
  const ownedVoteRef = useRef(ownedVote);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ownerId) {
      const empty = { data: null, ownerId: null };
      ownedVoteRef.current = empty;
      setOwnedVote(empty);
      setPendingCandidateId(null);
      setIsClosing(false);
      return;
    }
    if (resource.data) {
      const next = { data: resource.data, ownerId };
      ownedVoteRef.current = next;
      setOwnedVote(next);
    }
  }, [ownerId, resource.data]);

  const details = ownedVote.ownerId === ownerId ? ownedVote.data : null;
  const session = details?.session ?? null;
  const lifecycle = session ? getVoteLifecycle(session, now) : null;
  const leaderState = useMemo(() => session ? getVoteLeaders(session.candidates) : null, [session]);
  const selectedIds = useMemo(() => session ? new Set(getSelectedCandidateIds(session)) : new Set<string>(), [session]);

  const commitDetails = useCallback((expectedOwnerId: string, next: VoteDetails) => {
    if (ownerIdRef.current !== expectedOwnerId) return;
    const owned = { data: next, ownerId: expectedOwnerId };
    ownedVoteRef.current = owned;
    setOwnedVote(owned);
    void writePersistedCache(getPrivateCacheKey(expectedOwnerId, cacheResource), next).catch(() => undefined);
  }, [cacheResource]);

  async function handleVote(candidateId: string) {
    const expectedOwnerId = ownerIdRef.current;
    const snapshot = ownedVoteRef.current.data;
    if (!expectedOwnerId || !snapshot || pendingCandidateId || isClosing) return;
    const mutation = beginOptimisticVote(snapshot.session, candidateId, new Date());
    if (!mutation) return;
    const wasSelected = snapshot.session.candidates.find((candidate) => candidate.id === candidateId)?.userHasVoted === true;
    setMutationError(null);
    setPendingCandidateId(candidateId);
    commitDetails(expectedOwnerId, { ...snapshot, session: mutation.optimistic });
    try {
      const token = await getFirebaseIdToken();
      if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to save your vote.');
      const confirmed = wasSelected
        ? await removeSharedCandidateVote(token, route.params.watchlistId, route.params.sessionId, candidateId)
        : await voteForSharedCandidate(token, route.params.watchlistId, route.params.sessionId, candidateId);
      if (ownerIdRef.current !== expectedOwnerId) return;
      const current = ownedVoteRef.current.data;
      if (current) commitDetails(expectedOwnerId, { ...current, session: confirmed });
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        const current = ownedVoteRef.current.data;
        if (current) commitDetails(expectedOwnerId, { ...current, session: rollbackVoteMutation(mutation) });
        setMutationError(error instanceof Error ? error.message : 'Your vote could not be saved.');
        resource.retry();
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setPendingCandidateId(null);
    }
  }

  function confirmClose() {
    if (!details || !canCloseVote(details.isOwner, details.session, new Date()) || isClosing || pendingCandidateId) return;
    Alert.alert(
      'Close this vote?',
      'Voting will stop immediately. This action cannot be undone.',
      [{ style: 'cancel', text: 'Keep open' }, { onPress: () => void handleClose(), style: 'destructive', text: 'Close vote' }],
    );
  }

  async function handleClose() {
    const expectedOwnerId = ownerIdRef.current;
    const snapshot = ownedVoteRef.current.data;
    if (!expectedOwnerId || !snapshot) return;
    const mutation = beginOptimisticClose(snapshot.session, snapshot.isOwner, new Date());
    if (!mutation) return;
    setMutationError(null);
    setIsClosing(true);
    commitDetails(expectedOwnerId, { ...snapshot, session: mutation.optimistic });
    try {
      const token = await getFirebaseIdToken();
      if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to close this vote.');
      const confirmed = await closeSharedVotingSession(token, route.params.watchlistId, route.params.sessionId);
      if (ownerIdRef.current !== expectedOwnerId) return;
      const current = ownedVoteRef.current.data;
      if (current) commitDetails(expectedOwnerId, { ...current, session: confirmed });
      resource.retry();
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        const current = ownedVoteRef.current.data;
        if (current) commitDetails(expectedOwnerId, { ...current, session: rollbackVoteMutation(mutation) });
        setMutationError(error instanceof Error ? error.message : 'The vote could not be closed.');
        resource.retry();
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setIsClosing(false);
    }
  }

  if (!ownerId || !firebaseIdToken) {
    return <Screen title=""><EmptyState body="Sign in from Profile to join this shared vote." title="Sign in required" /></Screen>;
  }
  if (resource.isInitialLoading && !details) {
    return <Screen title="" statusBanner={<InlineStatusBanner detail="Loading candidates and current votes." tone="updating" />} />;
  }
  if (resource.error && !details) {
    return <Screen title=""><EmptyState body={resource.error} title="Vote unavailable"><Button label="Retry" onPress={resource.retry} /></EmptyState></Screen>;
  }
  if (!details || !session || !lifecycle || !leaderState) return null;

  const statusBanner = resource.isRefreshing
    ? <InlineStatusBanner detail="Keeping the saved vote visible." tone="updating" />
    : resource.error
      ? <InlineStatusBanner detail={resource.error} onRetry={resource.retry} tone="offline" />
      : mutationError
        ? <InlineStatusBanner detail={mutationError} tone="error" />
        : undefined;
  const lifecycleCopy = lifecycle === 'open' ? 'Vote open' : lifecycle === 'expired' ? 'Voting time ended' : 'Final result';

  return (
    <Screen
      refreshControl={<RefreshControl onRefresh={resource.retry} refreshing={resource.isRefreshing} tintColor={colors.accent} />}
      statusBanner={statusBanner}
      title=""
    >
      <View style={styles.sharedHeader}>
        <View style={styles.headerCopy}><Text style={styles.eyebrow}>Shared list</Text><Text style={styles.watchlistTitle}>{details.watchlistName}</Text><View style={styles.memberMeta}><Users color={colors.textSubtle} size={15} /><Text style={styles.meta}>{details.memberCount === 1 ? '1 member' : `${details.memberCount} members`}</Text></View></View>
        <View style={styles.avatarStack}>{details.members.slice(0, 3).map((member, index) => <View key={member.id} style={[styles.avatar, { marginLeft: index === 0 ? 0 : -8 }]}><Text style={styles.avatarText}>{initials(member.displayName)}</Text></View>)}</View>
      </View>

      <Text style={styles.voteTitle}>{session.title}</Text>
      <View style={[styles.lifecycleBar, lifecycle !== 'open' && styles.lifecycleBarNeutral]}>
        <View style={[styles.liveDot, lifecycle !== 'open' && styles.liveDotNeutral]} />
        <Text style={[styles.lifecycleText, lifecycle !== 'open' && styles.lifecycleTextNeutral]}>{lifecycleCopy}</Text>
        <Clock3 color={colors.textSubtle} size={15} />
        <Text style={styles.remaining}>{getVoteRemainingLabel(session, now)}</Text>
      </View>

      {leaderState.isTie ? <Text style={styles.resultSummary}>Tie between {leaderState.leaderIds.length} candidates with {leaderState.maxVotes} votes.</Text> : lifecycle === 'closed' && session.winningCandidateId ? <Text style={styles.resultSummary}>A winner has been selected.</Text> : null}

      <View style={styles.candidateList}>{session.candidates.map((candidate) => {
        const media = details.candidateMedia[candidate.id];
        const isLeader = leaderState.leaderIds.includes(candidate.id);
        const isSelected = selectedIds.has(candidate.id);
        const isPending = pendingCandidateId === candidate.id;
        const canMutate = lifecycle === 'open' && !pendingCandidateId && !isClosing;
        const leaderLabel = isLeader && leaderState.isTie ? 'Tied leader' : isLeader ? 'Leading' : null;
        return <View key={candidate.id} style={[styles.candidateCard, isLeader && styles.candidateLeading]}>
          <MediaPoster accessibilityLabel={media?.title ? `${media.title} poster` : 'Unavailable candidate poster'} posterUrl={media?.posterUrl ?? null} style={styles.candidatePoster} />
          <View style={styles.candidateCopy}>
            <Text numberOfLines={2} style={styles.candidateTitle}>{media?.title ?? 'Title unavailable'}</Text>
            <Text numberOfLines={1} style={styles.meta}>{media?.genres.slice(0, 2).join(' · ') || (candidate.contentType === 'movie' ? 'Film' : 'Series')}</Text>
            {leaderLabel ? <View style={styles.leaderRow}><Crown color={colors.accentText} size={14} /><Text style={styles.leaderText}>{leaderLabel}</Text></View> : null}
            <Text style={styles.voteCount}>{candidate.voteCount === 1 ? '1 vote' : `${candidate.voteCount} votes`}</Text>
          </View>
          <Pressable
            accessibilityLabel={`${isSelected ? 'Remove your vote from' : 'Vote for'} ${media?.title ?? 'this candidate'}`}
            accessibilityRole="button"
            accessibilityState={{ busy: isPending, disabled: !canMutate, selected: isSelected }}
            disabled={!canMutate}
            onPress={() => void handleVote(candidate.id)}
            style={({ pressed }) => [styles.voteButton, isSelected && styles.voteButtonSelected, (!canMutate || isPending) && styles.disabled, pressed && styles.pressed]}
          >
            {isSelected ? <Check color={colors.textOnAccent} size={15} strokeWidth={3} /> : null}
            <Text style={[styles.voteButtonText, isSelected && styles.voteButtonTextSelected]}>{isPending ? 'Saving…' : isSelected ? 'Your vote' : lifecycle === 'open' ? 'Vote' : 'Closed'}</Text>
          </Pressable>
        </View>;
      })}</View>

      {details.isOwner ? <View style={styles.closeArea}><Button disabled={!canCloseVote(true, session, now) || Boolean(pendingCandidateId)} fullWidth label="Close vote" loading={isClosing} onPress={confirmClose} variant="secondary" /><Text style={styles.closeHelp}>{lifecycle === 'open' ? 'Only the list owner can close voting early.' : 'This vote no longer accepts changes.'}</Text></View> : null}
    </Screen>
  );
}

function initials(name: string | null) {
  const value = name?.trim();
  return value ? value.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') : 'W';
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', backgroundColor: colors.panelElevated, borderColor: colors.background, borderRadius: 18, borderWidth: 2, height: 34, justifyContent: 'center', width: 34 },
  avatarStack: { flexDirection: 'row' },
  avatarText: { color: colors.accentText, fontSize: 10, fontWeight: '800' },
  candidateCard: { backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 138, padding: spacing.sm, position: 'relative' },
  candidateCopy: { flex: 1, minWidth: 0, paddingTop: spacing.xs, paddingRight: 4 },
  candidateLeading: { backgroundColor: colors.accentSoft, borderColor: colors.accentBorder },
  candidateList: { gap: spacing.sm, marginTop: spacing.md },
  candidatePoster: { borderRadius: radii.md, height: 116, width: 78 },
  candidateTitle: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 20 },
  closeArea: { gap: spacing.sm, marginTop: spacing.xl },
  closeHelp: { ...typography.meta, color: colors.textSubtle, textAlign: 'center' },
  disabled: { opacity: 0.5 },
  eyebrow: { ...typography.eyebrow, color: colors.accentText },
  headerCopy: { flex: 1 },
  leaderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  leaderText: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  lifecycleBar: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radii.md, flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, minHeight: touchTargets.min, paddingHorizontal: spacing.md },
  lifecycleBarNeutral: { backgroundColor: colors.panelElevated },
  lifecycleText: { color: colors.accentText, flex: 1, fontSize: 12, fontWeight: '800' },
  lifecycleTextNeutral: { color: colors.textMuted },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 8, width: 8 },
  liveDotNeutral: { backgroundColor: colors.textSubtle },
  memberMeta: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  meta: { ...typography.meta, color: colors.textSubtle },
  pressed: { opacity: 0.72 },
  remaining: { ...typography.meta, color: colors.textMuted },
  resultSummary: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  sharedHeader: { alignItems: 'center', backgroundColor: colors.panel, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  voteButton: { alignItems: 'center', backgroundColor: colors.panelElevated, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, bottom: spacing.sm, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: touchTargets.min, minWidth: 88, paddingHorizontal: spacing.sm, position: 'absolute', right: spacing.sm },
  voteButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  voteButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  voteButtonTextSelected: { color: colors.textOnAccent },
  voteCount: { ...typography.meta, color: colors.textMuted, marginTop: spacing.sm },
  voteTitle: { color: colors.text, fontSize: 28, fontWeight: '800', lineHeight: 34, marginTop: spacing.xl },
  watchlistTitle: { color: colors.text, fontSize: 18, fontWeight: '800', marginTop: spacing.xs },
});
