import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, Ellipsis, Trash2, Trophy } from 'lucide-react-native';
import {
  addSharedVotingCandidates, closeSharedVotingSession, removeSharedCandidateVote,
  voteForSharedCandidate, type SharedVotingSession,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { InlineStatusBanner } from '../components/InlineStatusBanner';
import { MediaPoster } from '../components/MediaPoster';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { beginOptimisticClose, beginOptimisticVote, getVoteLeaders, getVoteLifecycle, getVotePercentage, getVoteRemainingLabel } from './sharedVoteModel';
import { VoteTitlePicker, voteMediaKey } from './VoteTitlePicker';
import type { WatchlistDisplayItem } from './WatchlistDetailLayout';
import { useVoteExpansion } from './useVoteExpansion';

export type VoteUpdateOptions = { media?: WatchlistDisplayItem[]; removeItemIds?: string[]; persist?: boolean };

export function InlineSharedVote({ session, watchlistId, items, isOwner, now, viewerAvatarUrl, onChange, onDismiss, onDelete }: {
  onDismiss: (session: SharedVotingSession) => void;
  onDelete: (session: SharedVotingSession) => void;
  session: SharedVotingSession; watchlistId: string; items: WatchlistDisplayItem[];
  isOwner: boolean; now: Date; viewerAvatarUrl?: string | null; onChange: (session: SharedVotingSession, options?: VoteUpdateOptions) => void;
}) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const [error, setError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selected, setSelected] = useState<WatchlistDisplayItem[]>([]);
  const [busy, setBusy] = useState(false);
  const pending = useRef(0);
  const structuralPending = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const current = useRef(session);
  const confirmed = useRef(session);
  current.current = session;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const open = getVoteLifecycle(session, now) === 'open';
  const [showCandidates, toggleExpanded] = useVoteExpansion(currentUser?.id ?? null, watchlistId, open ? session.id : `${session.id}:results`, open);
  const leaders = getVoteLeaders(session.candidates);
  const remaining = Math.max(0, 10 - session.candidates.length);
  const votingMode = session.allowMultipleVotes === false ? 'One title per member' : 'Multiple votes allowed';
  const winnerNames = session.candidates.filter(candidate => leaders.leaderIds.includes(candidate.id))
    .map(candidate => items.find(item => voteMediaKey(item) === voteMediaKey(candidate))?.title).filter(Boolean).join(', ');

  function vote(candidateId: string) {
    if (busy || session.id.startsWith('pending:')) return;
    const snapshot = current.current;
    const mutation = beginOptimisticVote(snapshot, candidateId, new Date(), currentUser ? {
      id: currentUser.id, displayName: currentUser.displayName ?? 'You', avatarUrl: viewerAvatarUrl,
    } : undefined);
    if (!mutation) return;
    const remove = snapshot.candidates.find(candidate => candidate.id === candidateId)?.userHasVoted;
    if (pending.current === 0) confirmed.current = snapshot;
    pending.current++;
    current.current = mutation.optimistic;
    onChange(mutation.optimistic, { persist: false });
    setError(null);
    const save = async () => {
      try {
        const token = await getFirebaseIdToken();
        if (!mounted.current) return;
        if (!token) throw new Error('Sign in again to save your vote.');
        confirmed.current = await (remove ? removeSharedCandidateVote : voteForSharedCandidate)(token, watchlistId, session.id, candidateId);
      } catch (cause) {
        if (mounted.current) { setError(cause instanceof Error ? cause.message : 'Your vote could not be saved.'); hapticError(); }
      } finally {
        pending.current--;
        if (mounted.current && pending.current === 0) { current.current = confirmed.current; onChange(confirmed.current); }
      }
    };
    queue.current = queue.current.then(save, save);
  }

  async function mutate(optimistic: SharedVotingSession, action: (token: string) => Promise<SharedVotingSession>, media: WatchlistDisplayItem[] = []) {
    if (structuralPending.current || pending.current || !open) return;
    structuralPending.current = true;
    const snapshot = session;
    const temporaryIds = optimistic.candidates.map(row => row.itemId).filter(id => id.startsWith('pending:'));
    setBusy(true); setError(null); setOptionsOpen(false); setSelected([]);
    onChange(optimistic, { media, persist: false });
    try {
      const token = await getFirebaseIdToken();
      if (!mounted.current) return;
      if (!token) throw new Error('Sign in again to update this vote.');
      const updated = await action(token);
      if (mounted.current) { onChange(updated, { media, removeItemIds: temporaryIds }); hapticSuccess(); }
    } catch (cause) {
      if (mounted.current) {
        onChange(snapshot, { removeItemIds: temporaryIds });
        setError(cause instanceof Error ? cause.message : 'Could not update this vote.'); hapticError();
      }
    } finally { structuralPending.current = false; if (mounted.current) setBusy(false); }
  }

  function addTitles() {
    if (!selected.length || selected.length > remaining) return;
    const additions = selected.map(item => ({ ...item,
      id: `pending:${session.id}:${voteMediaKey(item)}`,
      itemId: items.find(row => voteMediaKey(row) === voteMediaKey(item))?.id ?? `pending:${session.id}:${voteMediaKey(item)}`,
      userHasVoted: false, voteCount: 0,
    }));
    void mutate({ ...session, candidates: [...session.candidates, ...additions] },
      token => addSharedVotingCandidates(token, watchlistId, session.id, selected.map(({ contentType, tmdbId }) => ({ contentType, tmdbId }))), selected);
  }

  function confirmClose() {
    Alert.alert('Close this vote?', 'Voting will stop immediately. This action cannot be undone.', [
      { text: 'Keep open', style: 'cancel' },
      { text: 'Close vote', style: 'destructive', onPress: () => {
        const mutation = beginOptimisticClose(session, isOwner);
        if (mutation) void mutate(mutation.optimistic, token => closeSharedVotingSession(token, watchlistId, session.id));
      } },
    ]);
  }

  function confirmDelete() {
    Alert.alert('Delete this vote?', 'This removes the vote for every member. Titles will stay in the watchlist.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete vote', style: 'destructive', onPress: () => { setOptionsOpen(false); onDelete(session); } },
    ]);
  }

  return <View style={[styles.content, styles.card, !open && styles.result, !open && !showCandidates && styles.collapsedResult]}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${open ? 'Active vote' : 'Results'}: ${session.title}`}
        accessibilityState={{ expanded: showCandidates }} onPress={toggleExpanded} style={styles.heading}>
        <Text numberOfLines={2} style={styles.title}>{session.title}</Text>
        {open || showCandidates ? <Text style={styles.caption}>{open ? getVoteRemainingLabel(session, now) : leaders.maxVotes === 0 ? 'No votes cast' : `${leaders.isTie ? 'Tie' : 'Winner'}: ${winnerNames || 'Title'}`}</Text> : null}
      </Pressable>
      {open || (showCandidates && session.isCreator) ? <Pressable accessibilityRole="button" accessibilityLabel={`Options for ${session.title}`}
        disabled={busy || pending.current > 0 || session.id.startsWith('pending:')} onPress={() => { setSelected([]); setOptionsOpen(true); }} style={styles.options}>
        <Ellipsis size={23} color={colors.text} />
      </Pressable> : null}
      {!open && showCandidates ? <Pressable accessibilityRole="button" accessibilityLabel="Hide vote result for me"
        disabled={busy} onPress={() => onDismiss(session)} style={styles.options}>
        <Trash2 size={20} color={colors.textMuted} />
      </Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel={`${showCandidates ? 'Collapse' : 'Expand'} ${open ? 'active vote' : 'vote results'}`}
        accessibilityState={{ expanded: showCandidates }} onPress={toggleExpanded} style={styles.options}>
        {showCandidates ? <ChevronUp size={open ? 22 : 18} color={colors.textMuted} /> : <ChevronDown size={open ? 22 : 18} color={colors.textMuted} />}
      </Pressable>
    </View>
    {open && showCandidates ? <View style={styles.tags}>
      <View style={styles.tag}><Text style={styles.tagText}>{session.allowMultipleVotes === false ? 'Single choice' : 'Multiple choice'}</Text></View>
      <View style={styles.tag}><Text style={styles.tagText}>{session.isAnonymous === false ? 'Named votes' : 'Anonymous'}</Text></View>
    </View> : null}
    {error ? <InlineStatusBanner detail={error} tone="error" /> : null}
    {showCandidates ? <View style={styles.candidates}>{session.candidates.map(candidate => {
      const media = items.find(item => voteMediaKey(item) === voteMediaKey(candidate));
      const title = media?.title ?? 'Title';
      const percentage = getVotePercentage(session, candidate.id);
      const voters = candidate.voters ?? [];
      const winner = !open && leaders.leaderIds.includes(candidate.id);
      return <Pressable key={candidate.id} accessibilityRole="button"
        accessibilityLabel={`${open ? candidate.userHasVoted ? 'Remove your vote from ' : 'Vote for ' : winner ? 'Winner: ' : ''}${title}, ${percentage}%, ${candidate.voteCount} votes`}
        accessibilityState={{ selected: candidate.userHasVoted, disabled: !open || busy || session.id.startsWith('pending:') }} disabled={!open || busy || session.id.startsWith('pending:')}
        onPress={() => vote(candidate.id)} style={({ pressed }) => [styles.row, (open && candidate.userHasVoted || winner) && styles.highlightedRow, pressed && styles.pressed]}>
        <MediaPoster posterUrl={media?.posterUrl ?? null} style={styles.poster} />
        <View style={styles.choice}>
          <Text style={styles.candidateTitle} numberOfLines={2}>{title}</Text>
          <View style={styles.voteMeta}>
            <View style={styles.avatars}>{session.isAnonymous === false ? <>
              {voters.slice(0, 4).map(voter => <UserAvatar key={voter.id} size={20} avatarUrl={voter.avatarUrl ?? null} displayName={voter.displayName} style={styles.avatar} />)}
              {voters.length > 4 ? <Text style={styles.caption}>+{voters.length - 4}</Text> : null}
            </> : null}</View>
            <Text style={styles.percentage}>{percentage}%</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percentage }} style={styles.track}>
            <View style={[styles.fill, { width: `${percentage}%` }]} />
          </View>
          <Text style={styles.caption}>{candidate.voteCount} {candidate.voteCount === 1 ? 'vote' : 'votes'}</Text>
        </View>
        {open ? <View style={[styles.circle, candidate.userHasVoted && styles.selected]}>
          {candidate.userHasVoted ? <Check color={colors.textOnAccent} size={16} /> : null}
        </View> : winner ? <Trophy size={20} color={colors.accentText} /> : null}
      </Pressable>;
    })}</View> : null}
    {optionsOpen ? <BottomActionSheet title={session.title} visible onClose={() => setOptionsOpen(false)}
      footer={open && remaining > 0 ? <Button label={`Add ${selected.length || ''} ${selected.length === 1 ? 'title' : 'titles'}`.replace('  ', ' ')}
        fullWidth disabled={busy || !selected.length || selected.length > remaining} onPress={addTitles} /> : undefined}>
      <BottomActionSheetScrollView keyboardShouldPersistTaps="always" contentContainerStyle={styles.content}>
        <Text style={styles.caption}>{getVoteRemainingLabel(session, now)} · {votingMode}</Text>
        {open ? <>
          <Text style={styles.title}>Add titles</Text>
          <Text style={styles.caption}>{remaining > 0 ? 'Any member can add titles from the full catalogue.' : 'This vote already contains the maximum of 10 titles.'}</Text>
          {remaining > 0 ? <VoteTitlePicker items={items} excluded={session.candidates} selected={selected} limit={remaining} disabled={busy} onChange={setSelected} /> : null}
          {isOwner ? <Button label="Close voting early" variant="ghost" disabled={busy} onPress={confirmClose} /> : null}
        </> : null}
        {session.isCreator ? <Button label="Delete vote" variant="ghost" disabled={busy || pending.current > 0} onPress={confirmDelete} /> : null}
      </BottomActionSheetScrollView>
    </BottomActionSheet> : null}
  </View>;
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingBottom: spacing.md },
  card: { padding: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, backgroundColor: colors.interactiveSurface },
  result: { backgroundColor: 'rgba(17, 24, 34, 0.28)', borderColor: 'rgba(255, 255, 255, 0.07)' },
  collapsedResult: { paddingTop: spacing.xs, paddingBottom: spacing.xs, gap: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, heading: { flex: 1, gap: spacing.xs, minHeight: 44, justifyContent: 'center' },
  title: { ...typography.body, color: colors.text, fontWeight: '700' }, caption: { ...typography.meta, color: colors.textMuted },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radii.sm, backgroundColor: colors.panelElevated },
  tagText: { ...typography.meta, color: colors.textMuted, fontWeight: '500' },
  options: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  candidates: { gap: spacing.sm }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.panelSoft },
  highlightedRow: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft },
  pressed: { opacity: 0.76 },
  poster: { width: 48, height: 72, borderRadius: radii.sm }, choice: { flex: 1, minWidth: 0, gap: 4 },
  candidateTitle: { ...typography.meta, color: colors.text, fontWeight: '600' },
  voteMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, minHeight: 22 },
  avatars: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }, avatar: { opacity: 1, backgroundColor: colors.panelElevated },
  percentage: { ...typography.meta, color: colors.text }, track: { height: 7, backgroundColor: colors.panelElevated, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.accent, borderRadius: 4 },
  circle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
