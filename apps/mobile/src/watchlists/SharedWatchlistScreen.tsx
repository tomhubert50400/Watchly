import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CheckCircle2, Circle, RefreshCw } from 'lucide-react-native';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  addSharedWatchlistMember,
  createSharedVotingSession,
  removeSharedCandidateVote,
  SharedVotingCandidate,
  SharedVotingSession,
  SharedWatchlist,
  voteForSharedCandidate,
} from '../api/sharedWatchlists';
import { useAuthSession } from '../auth/AuthSessionContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { TextInput } from '../components/TextInput';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { HydratedSharedWatchlistItem, useWatchlistCache } from './WatchlistCacheContext';

type SharedWatchlistScreenProps = NativeStackScreenProps<RootStackParamList, 'SharedWatchlist'>;

export function SharedWatchlistScreen({ route }: SharedWatchlistScreenProps) {
  const { firebaseIdToken, getFirebaseIdToken } = useAuthSession();
  const { getCachedSharedWatchlist, refreshSharedWatchlist } = useWatchlistCache();
  const { watchlistId } = route.params;
  const [error, setError] = useState<string | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isLoading, setIsLoading] = useState(() => !getCachedSharedWatchlist(watchlistId));
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [sessionTitle, setSessionTitle] = useState('Tonight');
  const [memberUserId, setMemberUserId] = useState('');
  const [watchlist, setWatchlist] = useState<SharedWatchlist | null>(
    () => getCachedSharedWatchlist(watchlistId)?.watchlist ?? null,
  );
  const [hydratedItems, setHydratedItems] = useState<HydratedSharedWatchlistItem[]>(
    () => getCachedSharedWatchlist(watchlistId)?.hydratedItems ?? [],
  );
  const hasVisibleWatchlistRef = useRef(Boolean(watchlist));

  const itemTitleById = useMemo(() => {
    const titles = new Map<string, HydratedSharedWatchlistItem>();

    hydratedItems.forEach((item) => titles.set(item.id, item));

    return titles;
  }, [hydratedItems]);

  const loadWatchlist = useCallback(async (showLoading = false) => {
    if (!firebaseIdToken) {
      setWatchlist(null);
      setHydratedItems([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    setError(null);
    setIsLoading(showLoading || !hasVisibleWatchlistRef.current);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to load this shared list.');
      }

      const cached = await refreshSharedWatchlist(watchlistId);

      setWatchlist(cached.watchlist);
      setHydratedItems(cached.hydratedItems);
      hasVisibleWatchlistRef.current = true;
    } catch (loadError) {
      if (!hasVisibleWatchlistRef.current) {
        setWatchlist(null);
        setHydratedItems([]);
      }
      setError(loadError instanceof Error ? loadError.message : 'Could not load the shared list.');
    } finally {
      setIsLoading(false);
    }
  }, [firebaseIdToken, getFirebaseIdToken, refreshSharedWatchlist, watchlistId]);

  useEffect(() => {
    const cached = getCachedSharedWatchlist(watchlistId);

    if (cached) {
      setWatchlist(cached.watchlist);
      setHydratedItems(cached.hydratedItems);
      hasVisibleWatchlistRef.current = true;
      setIsLoading(false);
      void loadWatchlist(false);
      return;
    }

    hasVisibleWatchlistRef.current = false;
    void loadWatchlist(true);
  }, [loadWatchlist, watchlistId]);

  async function handleCreateSession() {
    const title = sessionTitle.trim();

    if (!firebaseIdToken || !watchlist || title.length === 0 || watchlist.items.length === 0) {
      return;
    }

    setIsSavingSession(true);
    setError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to create a voting session.');
      }

      const session = await createSharedVotingSession(token, watchlist.id, {
        itemIds: watchlist.items.map((item) => item.id),
        title,
      });

      setWatchlist({
        ...watchlist,
        votingSessions: [session, ...watchlist.votingSessions],
      });
      setSessionTitle('Tonight');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create the voting session.');
    } finally {
      setIsSavingSession(false);
    }
  }

  async function handleAddMember() {
    const cleanUserId = memberUserId.trim();

    if (!firebaseIdToken || !watchlist || !watchlist.isOwner || cleanUserId.length === 0 || isAddingMember) {
      return;
    }

    setIsAddingMember(true);
    setError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to add a member.');
      }

      await addSharedWatchlistMember(token, watchlist.id, cleanUserId);
      setMemberUserId('');
      await loadWatchlist(false);
    } catch (memberError) {
      setError(memberError instanceof Error ? memberError.message : 'Could not add this member.');
    } finally {
      setIsAddingMember(false);
    }
  }

  async function toggleVote(session: SharedVotingSession, candidate: SharedVotingCandidate) {
    if (!firebaseIdToken || !watchlist) {
      return;
    }

    setError(null);

    try {
      const token = await getFirebaseIdToken();

      if (!token) {
        throw new Error('Sign in again to vote.');
      }

      const updatedSession = candidate.userHasVoted
        ? await removeSharedCandidateVote(token, watchlist.id, session.id, candidate.id)
        : await voteForSharedCandidate(token, watchlist.id, session.id, candidate.id);

      setWatchlist({
        ...watchlist,
        votingSessions: watchlist.votingSessions.map((item) =>
          item.id === updatedSession.id ? updatedSession : item,
        ),
      });
    } catch (voteError) {
      setError(voteError instanceof Error ? voteError.message : 'Could not save this vote.');
    }
  }

  if (!firebaseIdToken) {
    return (
      <View style={styles.page}>
        <EmptyState body="Sign in from Profile to open member-only shared lists." title="Sign in required" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      {isLoading ? (
        <View style={styles.loadingPanel}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.loadingText}>Loading shared list</Text>
        </View>
      ) : error && !watchlist ? (
        <EmptyState body={error} title="Shared list failed">
          <Button label="Retry" onPress={() => loadWatchlist(true)} />
        </EmptyState>
      ) : watchlist ? (
        <>
          {error ? <Text style={styles.warning}>{error}</Text> : null}
          <View style={styles.panel}>
            <View style={styles.headerRow}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>Member-only shared list</Text>
                <Text style={styles.title}>{watchlist.name}</Text>
                <Text style={styles.body}>
                  {watchlist.memberCount === 1 ? '1 member' : `${watchlist.memberCount} members`} /{' '}
                  {watchlist.items.length === 1 ? '1 title' : `${watchlist.items.length} titles`}
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Refresh shared list"
                accessibilityRole="button"
                onPress={() => loadWatchlist(true)}
                style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
              >
                <RefreshCw color={colors.text} size={18} strokeWidth={2} />
              </Pressable>
            </View>
          </View>

          {watchlist.isOwner ? (
            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.body}>
                Invite someone by profile code, then choose what to watch together.
              </Text>
              <TextInput
                label="Profile code"
                onChangeText={setMemberUserId}
                onSubmitEditing={memberUserId.trim().length > 0 && !isAddingMember ? handleAddMember : undefined}
                placeholder="Paste profile code"
                returnKeyType="done"
                value={memberUserId}
              />
              <Button
                disabled={memberUserId.trim().length === 0 || isAddingMember}
                label={isAddingMember ? 'Adding...' : 'Add member'}
                onPress={handleAddMember}
              />
              <View style={styles.memberRows}>
                {watchlist.members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <Text numberOfLines={1} style={styles.memberName}>
                      {member.displayName ?? 'Unnamed user'}
                    </Text>
                    <Text numberOfLines={1} style={styles.memberRole}>
                      Member
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Titles</Text>
            {hydratedItems.length === 0 ? (
              <Text style={styles.body}>Add films or series from detail pages before starting a vote.</Text>
            ) : (
              <View style={styles.itemRows}>
                {hydratedItems.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    {item.posterUrl ? (
                      <Image
                        accessibilityIgnoresInvertColors
                        accessibilityLabel={`${item.title} poster`}
                        source={{ uri: item.posterUrl }}
                        style={styles.poster}
                      />
                    ) : (
                      <View style={styles.posterPlaceholder} />
                    )}
                    <View style={styles.rowCopy}>
                      <Text numberOfLines={2} style={styles.itemTitle}>
                        {item.title}
                      </Text>
                      <Text style={styles.meta}>{item.contentType === 'movie' ? 'Film' : 'Series'}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Voting sessions</Text>
            <Text style={styles.body}>Create a simple vote from every title in this shared list.</Text>
            <TextInput
              label="Session title"
              maxLength={80}
              onChangeText={setSessionTitle}
              onSubmitEditing={!isSavingSession && hydratedItems.length > 0 ? handleCreateSession : undefined}
              placeholder="Tonight"
              returnKeyType="done"
              value={sessionTitle}
            />
            <Button
              disabled={isSavingSession || sessionTitle.trim().length === 0 || hydratedItems.length === 0}
              label={isSavingSession ? 'Creating...' : 'Create session'}
              onPress={handleCreateSession}
            />
            {watchlist.votingSessions.length === 0 ? (
              <Text style={styles.emptyInline}>No voting sessions yet.</Text>
            ) : (
              <View style={styles.sessionRows}>
                {watchlist.votingSessions.map((session) => (
                  <View key={session.id} style={styles.sessionPanel}>
                    <Text style={styles.sessionTitle}>{session.title}</Text>
                    {session.candidates.map((candidate) => (
                      <VoteCandidateRow
                        candidate={candidate}
                        item={itemTitleById.get(candidate.itemId)}
                        key={candidate.id}
                        onPress={() => toggleVote(session, candidate)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function VoteCandidateRow({
  candidate,
  item,
  onPress,
}: {
  candidate: SharedVotingCandidate;
  item: HydratedSharedWatchlistItem | undefined;
  onPress: () => void;
}) {
  const Icon = candidate.userHasVoted ? CheckCircle2 : Circle;

  return (
    <Pressable
      accessibilityLabel={`${candidate.userHasVoted ? 'Remove vote from' : 'Vote for'} ${item?.title ?? `TMDB ${candidate.tmdbId}`}`}
      accessibilityRole="button"
      accessibilityState={{ selected: candidate.userHasVoted }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.voteRow,
        candidate.userHasVoted && styles.voteRowSelected,
        pressed && styles.pressed,
      ]}
    >
      <Icon
        color={candidate.userHasVoted ? colors.textOnAccent : colors.accent}
        size={20}
        strokeWidth={2}
      />
      <View style={styles.rowCopy}>
        <Text numberOfLines={1} style={[styles.voteTitle, candidate.userHasVoted && styles.voteTitleSelected]}>
          {item?.title ?? `TMDB ${candidate.tmdbId}`}
        </Text>
        <Text style={[styles.voteMeta, candidate.userHasVoted && styles.voteMetaSelected]}>
          {candidate.voteCount === 1 ? '1 vote' : `${candidate.voteCount} votes`}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.sm,
  },
  emptyInline: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.md,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.accent,
    marginBottom: spacing.xs,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  itemRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  itemRows: {
    marginTop: spacing.sm,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0,
  },
  loadingPanel: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  loadingText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '700',
  },
  memberRole: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0,
    marginTop: 3,
  },
  memberName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0,
  },
  memberRow: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberRows: {
    gap: spacing.sm,
  },
  meta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  page: {
    backgroundColor: colors.background,
    flexGrow: 1,
    paddingBottom: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxxl,
  },
  panel: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  poster: {
    backgroundColor: colors.panelSoft,
    borderRadius: radii.md,
    height: 78,
    width: 52,
  },
  posterPlaceholder: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 78,
    width: 52,
  },
  pressed: {
    opacity: 0.78,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
  },
  sessionPanel: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  sessionRows: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  sessionTitle: {
    ...typography.title,
    color: colors.text,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0,
    lineHeight: 32,
  },
  voteMeta: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  voteMetaSelected: {
    color: colors.textOnAccent,
  },
  voteRow: {
    alignItems: 'center',
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  voteRowSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  voteTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0,
  },
  voteTitleSelected: {
    color: colors.textOnAccent,
  },
  warning: {
    ...typography.body,
    color: colors.danger,
    marginBottom: spacing.md,
  },
});
