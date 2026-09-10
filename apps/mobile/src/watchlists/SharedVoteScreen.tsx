import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Check, Clock3, Crown } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  closeSharedVotingSession,
  getSharedWatchlist,
  removeSharedCandidateVote,
  type SharedVotingSession,
  voteForSharedCandidate,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { getPrivateCacheKey, writePersistedCache } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { ScreenReveal } from '../components/ScreenReveal';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { SectionHeader } from '../components/SectionHeader';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { RootStackParamList } from '../navigation/types';
import { notifyUserDataChanged } from '../sync/userDataEvents';
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
import { WatchlistPage, WatchlistSection } from './WatchlistDetailLayout';

type Props = NativeStackScreenProps<RootStackParamList, 'SharedVotingSession'>;
type CandidateMedia = { genres: string[]; posterUrl: string | null; title: string | null };
type VoteDetails = {
  candidateMedia: Record<string, CandidateMedia>;
  isOwner: boolean;
  session: SharedVotingSession;
};
type OwnedVote = { data: VoteDetails | null; ownerId: string | null };

export function SharedVoteScreen({ route }: Props) {
  const { currentUser, firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { getCachedMovie, getCachedSeries, preloadCatalogueItems } = useCatalogueCache();
  const ownerId = currentUser?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;
  const cacheResource = `shared-vote:${route.params.watchlistId}:${route.params.sessionId}:v2`;
  const cacheKey = getPrivateCacheKey(ownerId ?? 'visitor', cacheResource);
  const load = useCallback(async (cached?: VoteDetails): Promise<VoteDetails> => {
    const expectedOwnerId = ownerId;
    const token = await getFirebaseIdToken();
    if (!expectedOwnerId || ownerIdRef.current !== expectedOwnerId || !token) {
      throw new Error('Sign in again to load this private vote.');
    }
    const watchlist = await getSharedWatchlist(token, route.params.watchlistId);
    if (ownerIdRef.current !== expectedOwnerId) throw new Error('The active account changed while loading this vote.');
    const session = watchlist.votingSessions.find((item) => item.id === route.params.sessionId);
    if (!session) throw new Error('This voting session is no longer available.');

    const entries = session.candidates.map((candidate): [string, CandidateMedia] => [
      candidate.id,
      cached?.candidateMedia[candidate.id] ?? { genres: [], posterUrl: null, title: null },
    ]);
    if (ownerIdRef.current !== expectedOwnerId) throw new Error('The active account changed while loading this vote.');
    return {
      candidateMedia: Object.fromEntries(entries),
      isOwner: watchlist.isOwner,
      session,
    };
  }, [getFirebaseIdToken, ownerId, route.params.sessionId, route.params.watchlistId]);
  const resource = useCachedResource<VoteDetails>({ enabled: Boolean(ownerId && firebaseIdToken), key: cacheKey, load });
  const [ownedVote, setOwnedVote] = useState<OwnedVote>({ data: null, ownerId: null });
  const ownedVoteRef = useRef(ownedVote);
  const [pendingVoteCount, setPendingVoteCount] = useState(0);
  const confirmedSessionRef = useRef<SharedVotingSession | null>(null);
  const pendingVoteCountRef = useRef(0);
  const voteBatchChangedRef = useRef(false);
  const voteMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
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
      pendingVoteCountRef.current = 0;
      setPendingVoteCount(0);
      setIsClosing(false);
      return;
    }
    if (resource.data && pendingVoteCountRef.current === 0 && !isClosing) {
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

  useEffect(() => {
    if (!session) return;
    preloadCatalogueItems(session.candidates.map((candidate) => ({
      contentType: candidate.contentType,
      tmdbId: candidate.tmdbId,
    })));
  }, [preloadCatalogueItems, session]);

  const commitDetails = useCallback((expectedOwnerId: string, next: VoteDetails) => {
    if (ownerIdRef.current !== expectedOwnerId) return;
    const owned = { data: next, ownerId: expectedOwnerId };
    ownedVoteRef.current = owned;
    setOwnedVote(owned);
    void writePersistedCache(getPrivateCacheKey(expectedOwnerId, cacheResource), next).catch(() => undefined);
  }, [cacheResource]);

  async function handleVote(candidateId: string) {
    const expectedOwnerId = ownerIdRef.current;
    const owned = ownedVoteRef.current;
    const snapshot = owned.data;
    if (!expectedOwnerId || owned.ownerId !== expectedOwnerId || !snapshot || isClosing) return;
    const mutation = beginOptimisticVote(snapshot.session, candidateId, new Date());
    if (!mutation) return;
    const wasSelected = snapshot.session.candidates.find((candidate) => candidate.id === candidateId)?.userHasVoted === true;
    setMutationError(null);
    commitDetails(expectedOwnerId, { ...snapshot, session: mutation.optimistic });
    if (pendingVoteCountRef.current === 0) {
      confirmedSessionRef.current = snapshot.session;
      voteBatchChangedRef.current = false;
    }
    pendingVoteCountRef.current += 1;
    setPendingVoteCount(pendingVoteCountRef.current);

    const commitMutation = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (ownerIdRef.current !== expectedOwnerId || !token) throw new Error('Sign in again to save your vote.');
        confirmedSessionRef.current = wasSelected
          ? await removeSharedCandidateVote(token, route.params.watchlistId, route.params.sessionId, candidateId)
          : await voteForSharedCandidate(token, route.params.watchlistId, route.params.sessionId, candidateId);
        voteBatchChangedRef.current = true;
      } catch (error) {
        if (ownerIdRef.current === expectedOwnerId) {
          setMutationError(error instanceof Error ? error.message : 'Your vote could not be saved.');
          hapticError();
        }
      } finally {
        pendingVoteCountRef.current = Math.max(0, pendingVoteCountRef.current - 1);
        setPendingVoteCount(pendingVoteCountRef.current);
        if (pendingVoteCountRef.current === 0 && ownerIdRef.current === expectedOwnerId) {
          const current = ownedVoteRef.current.data;
          const confirmed = confirmedSessionRef.current;
          if (current && confirmed) commitDetails(expectedOwnerId, { ...current, session: confirmed });
          if (voteBatchChangedRef.current) notifyUserDataChanged('watchlists');
          voteBatchChangedRef.current = false;
        }
      }
    };
    const queuedMutation = voteMutationQueueRef.current.then(commitMutation, commitMutation);
    voteMutationQueueRef.current = queuedMutation.catch(() => undefined);
  }

  function confirmClose() {
    if (!details || !canCloseVote(details.isOwner, details.session, new Date()) || isClosing || pendingVoteCount > 0) return;
    Alert.alert(
      'Close this vote?',
      'Voting will stop immediately. This action cannot be undone.',
      [{ style: 'cancel', text: 'Keep open' }, { onPress: () => void handleClose(), style: 'destructive', text: 'Close vote' }],
    );
  }

  async function handleClose() {
    const expectedOwnerId = ownerIdRef.current;
    const owned = ownedVoteRef.current;
    const snapshot = owned.data;
    if (!expectedOwnerId || owned.ownerId !== expectedOwnerId || !snapshot) return;
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
      resource.revalidate();
      hapticSuccess();
    } catch (error) {
      if (ownerIdRef.current === expectedOwnerId) {
        const current = ownedVoteRef.current.data;
        if (current) commitDetails(expectedOwnerId, { ...current, session: rollbackVoteMutation(mutation, current.session) });
        setMutationError(error instanceof Error ? error.message : 'The vote could not be closed.');
        hapticError();
        resource.revalidate();
      }
    } finally {
      if (ownerIdRef.current === expectedOwnerId) setIsClosing(false);
    }
  }

  if (!ownerId || !firebaseIdToken) {
    return (
      <WatchlistPage>
        <SignInRequiredCard
          body="You need to be signed in to join this private shared vote. Sign in here to continue."
          title="Sign in to join this vote"
        />
      </WatchlistPage>
    );
  }
  if (resource.isInitialLoading && !details) {
    return <WatchlistPage><LoadingState label="Loading vote" /></WatchlistPage>;
  }
  if (resource.error && !details) {
    return (
      <WatchlistPage>
        <EmptyState body={resource.error} title="Vote unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      </WatchlistPage>
    );
  }
  if (!details || !session || !lifecycle || !leaderState) return null;

  const statusBanner = mutationError
    ? <InlineStatusBanner detail={mutationError} tone="error" />
    : undefined;
  const lifecycleCopy = lifecycle === 'open' ? 'Open' : lifecycle === 'expired' ? 'Time ended' : 'Final result';
  const totalVotes = session.candidates.reduce((total, candidate) => total + candidate.voteCount, 0);
  const candidateSubtitle = lifecycle === 'open'
    ? selectedIds.size === 0
      ? 'Choose one or more titles'
      : `${selectedIds.size} ${selectedIds.size === 1 ? 'title selected' : 'titles selected'}`
    : `${totalVotes} ${totalVotes === 1 ? 'vote' : 'votes'}`;

  return (
    <WatchlistPage isRefreshing={resource.isRefreshing} onRefresh={resource.retry}>
      {statusBanner}

      <ScreenReveal delay={50} style={styles.statusRow}>
        <View style={styles.statusPrimary}>
          <View style={[styles.liveDot, lifecycle !== 'open' && styles.liveDotNeutral]} />
          <Text style={[styles.lifecycleText, lifecycle !== 'open' && styles.lifecycleTextNeutral]}>
            {lifecycleCopy}
          </Text>
        </View>
        <View style={styles.statusTime}>
          <Clock3 color={colors.textSubtle} size={15} />
          <Text style={styles.remaining}>{getVoteRemainingLabel(session, now)}</Text>
        </View>
      </ScreenReveal>

      {leaderState.isTie ? (
        <Text style={styles.resultSummary}>
          {leaderState.leaderIds.length} titles are tied with {leaderState.maxVotes} votes.
        </Text>
      ) : lifecycle === 'closed' && session.winningCandidateId ? (
        <Text style={styles.resultSummary}>A winner has been selected.</Text>
      ) : null}

      <WatchlistSection>
        <SectionHeader subtitle={candidateSubtitle} title="Candidates" />
        <ScreenReveal delay={100} style={styles.candidateList}>
          {session.candidates.map((candidate) => {
            const catalogueMedia = candidate.contentType === 'movie'
              ? getCachedMovie(candidate.tmdbId)
              : getCachedSeries(candidate.tmdbId);
            const media = catalogueMedia
              ? { genres: catalogueMedia.genres, posterUrl: catalogueMedia.posterUrl, title: catalogueMedia.title }
              : details.candidateMedia[candidate.id];
            const isLeader = leaderState.leaderIds.includes(candidate.id);
            const isSelected = selectedIds.has(candidate.id);
            const canMutate = lifecycle === 'open' && !isClosing;
            const leaderLabel = isLeader && leaderState.isTie ? 'Tied leader' : isLeader ? 'Leading' : null;

            return (
              <View key={candidate.id} style={styles.candidateRow}>
                <MediaPoster
                  accessibilityLabel={media?.title ? `${media.title} poster` : 'Unavailable candidate poster'}
                  posterUrl={media?.posterUrl ?? null}
                  style={styles.candidatePoster}
                />
                <View style={styles.candidateCopy}>
                  <Text numberOfLines={2} style={styles.candidateTitle}>
                    {media?.title ?? 'Title unavailable'}
                  </Text>
                  <Text numberOfLines={1} style={styles.meta}>
                    {media?.genres.slice(0, 2).join(' · ') || (candidate.contentType === 'movie' ? 'Film' : 'Series')}
                  </Text>
                  {leaderLabel ? (
                    <View style={styles.leaderRow}>
                      <Crown color={colors.accentText} size={14} />
                      <Text style={styles.leaderText}>{leaderLabel}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.voteCount}>
                    {candidate.voteCount === 1 ? '1 vote' : `${candidate.voteCount} votes`}
                  </Text>
                </View>
                <Pressable
                  accessibilityLabel={`${isSelected ? 'Remove your vote from' : 'Vote for'} ${media?.title ?? 'this candidate'}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canMutate, selected: isSelected }}
                  disabled={!canMutate}
                  onPress={() => void handleVote(candidate.id)}
                  style={({ pressed }) => [
                    styles.voteButton,
                    isSelected ? styles.voteButtonSelected : null,
                    !canMutate ? styles.disabled : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  {isSelected ? <Check color={colors.textOnAccent} size={15} strokeWidth={3} /> : null}
                  <Text style={[styles.voteButtonText, isSelected ? styles.voteButtonTextSelected : null]}>
                    {isSelected ? 'Selected' : lifecycle === 'open' ? 'Vote' : 'Closed'}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </ScreenReveal>
      </WatchlistSection>

      {details.isOwner && lifecycle === 'open' ? (
        <ScreenReveal delay={150} style={styles.closeArea}>
          <Button
            compact
            disabled={!canCloseVote(true, session, now) || pendingVoteCount > 0}
            label="Close voting early"
            loading={isClosing}
            onPress={confirmClose}
            variant="ghost"
          />
        </ScreenReveal>
      ) : null}
    </WatchlistPage>
  );
}

const styles = StyleSheet.create({
  candidateCopy: { flex: 1, minWidth: 0 },
  candidateList: { borderTopColor: colors.border, borderTopWidth: 1 },
  candidatePoster: { borderRadius: radii.md, height: 105, width: 70 },
  candidateRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 126, paddingVertical: spacing.sm },
  candidateTitle: { color: colors.text, fontSize: 16, fontWeight: '800', lineHeight: 20 },
  closeArea: { alignItems: 'center' },
  disabled: { opacity: 0.5 },
  leaderRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  leaderText: { color: colors.accentText, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  lifecycleText: { color: colors.accentText, fontSize: 12, fontWeight: '800' },
  lifecycleTextNeutral: { color: colors.textMuted },
  liveDot: { backgroundColor: colors.accent, borderRadius: 4, height: 8, width: 8 },
  liveDotNeutral: { backgroundColor: colors.textSubtle },
  meta: { ...typography.meta, color: colors.textSubtle },
  pressed: { opacity: 0.72 },
  remaining: { ...typography.meta, color: colors.textMuted },
  resultSummary: { ...typography.body, color: colors.textMuted },
  statusPrimary: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  statusRow: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: spacing.md },
  statusTime: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  voteButton: { alignItems: 'center', backgroundColor: colors.panelElevated, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, justifyContent: 'center', minHeight: touchTargets.min, minWidth: 82, paddingHorizontal: spacing.sm },
  voteButtonSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  voteButtonText: { color: colors.textMuted, fontSize: 12, fontWeight: '800' },
  voteButtonTextSelected: { color: colors.textOnAccent },
  voteCount: { ...typography.meta, color: colors.textMuted, marginTop: spacing.sm },
});
