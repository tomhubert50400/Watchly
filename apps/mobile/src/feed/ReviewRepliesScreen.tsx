import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { EyeOff, Flag, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEpisodeDetails } from '../api/catalogue';
import {
  createReviewReply,
  deleteReviewReply,
  listReviewReplies,
  ReviewReply,
  ReviewThreadPreview,
  ReviewThreadReview,
  setFeedItemLiked,
} from '../api/feed';
import type { ReportTarget } from '../api/reports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { SocialReviewPost } from '../components/SocialReviewPost';
import { SpoilerGuard } from '../components/SpoilerGuard';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import type { RootStackParamList } from '../navigation/types';
import { useToast } from '../notifications/ToastContext';
import { ReportSheet } from '../reports/ReportSheet';
import { notifyUserDataChanged } from '../sync/userDataEvents';
import { flattenReviewReplies, ThreadedReply } from './reviewThreadModel';

type Props = NativeStackScreenProps<RootStackParamList, 'ReviewReplies'>;

export function ReviewRepliesScreen({ navigation, route }: Props) {
  const { currentUser, getFirebaseIdToken } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<ThreadedReply>>(null);
  const requestVersion = useRef(0);
  const pagePending = useRef(false);
  const [body, setBody] = useState('');
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ author: string; id: string } | null>(null);
  const [review, setReview] = useState<ReviewThreadPreview | null>(route.params.preview ?? null);
  const [sending, setSending] = useState(false);
  const [threadRevealed, setThreadRevealed] = useState(!route.params.preview?.spoilerReason);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: 'transparent' },
      headerTransparent: true,
      headerTintColor: colors.text,
      title: 'Discussion',
    });
  }, [navigation]);

  useEffect(() => {
    const version = ++requestVersion.current;
    pagePending.current = false;
    setBody('');
    setContainsSpoilers(false);
    setError(null);
    setItems([]);
    setLoading(true);
    setNextCursor(null);
    setReview(route.params.preview ?? null);
    setReplyingTo(null);
    setSending(false);
    setThreadRevealed(!route.params.preview?.spoilerReason);

    void getFirebaseIdToken().then(async (token) => {
      if (!token) throw new Error('Sign in again to view this discussion.');
      return listReviewReplies(token, route.params.target);
    }).then((response) => {
      if (requestVersion.current !== version) return;
      setItems(response.items);
      setNextCursor(response.nextCursor);
      setReview((current) => previewFromResponse(response.review, current));
      void hydrateReview(response.review, refreshMovie, refreshSeries).then((hydrated) => {
        if (requestVersion.current === version) setReview((current) => current ? { ...current, ...hydrated } : null);
      });
    }).catch((loadError) => {
      if (requestVersion.current === version) {
        setError(loadError instanceof Error ? loadError.message : 'This discussion could not load.');
      }
    }).finally(() => {
      if (requestVersion.current === version) setLoading(false);
    });
  }, [getFirebaseIdToken, refreshMovie, refreshSeries, reloadVersion, route.params.preview, route.params.target]);

  async function loadMore() {
    if (!nextCursor || pagePending.current) return;
    const version = requestVersion.current;
    pagePending.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to view replies.');
      const response = await listReviewReplies(token, route.params.target, nextCursor);
      if (requestVersion.current !== version) return;
      setItems((current) => {
        const existing = new Set(current.map((item) => item.id));
        return [...current, ...response.items.filter((item) => !existing.has(item.id))];
      });
      setNextCursor(response.nextCursor);
    } catch (loadError) {
      if (requestVersion.current === version) {
        setError(loadError instanceof Error ? loadError.message : 'More replies could not load.');
      }
    } finally {
      if (requestVersion.current === version) {
        pagePending.current = false;
        setLoadingMore(false);
      }
    }
  }

  async function sendReply() {
    const normalized = body.trim();
    if (!normalized || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again before replying.');
      const reply = await createReviewReply(token, route.params.target, normalized, containsSpoilers, replyingTo?.id);
      setItems((current) => [...current, reply]);
      setBody('');
      setContainsSpoilers(false);
      setReplyingTo(null);
      notifyUserDataChanged('feed');
      hapticSuccess();
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (sendError) {
      hapticError();
      setError(sendError instanceof Error ? sendError.message : 'Your reply could not be sent.');
    } finally {
      setSending(false);
    }
  }

  function confirmDelete(reply: ReviewReply) {
    Alert.alert('Delete reply?', 'This reply will be removed permanently.', [
      { style: 'cancel', text: 'Cancel' },
      { style: 'destructive', text: 'Delete', onPress: () => void removeReply(reply) },
    ]);
  }

  async function removeReply(reply: ReviewReply) {
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again before deleting this reply.');
      await deleteReviewReply(token, reply.id);
      setItems((current) => current.filter((item) => item.id !== reply.id));
      notifyUserDataChanged('feed');
      hapticSuccess();
    } catch (deleteError) {
      hapticError();
      showToast(deleteError instanceof Error ? deleteError.message : 'The reply could not be deleted.');
    }
  }

  function openContent() {
    if (!review) return;
    if (review.content.contentType === 'movie') {
      navigation.navigate('FilmDetail', { title: review.contentTitle, tmdbId: review.content.tmdbId });
      return;
    }
    navigation.navigate('EpisodeDetail', {
      episodeNumber: review.content.episodeNumber,
      seasonNumber: review.content.seasonNumber,
      seriesTitle: review.contentContext?.split(' · ')[0] ?? 'Series',
      title: review.contentTitle,
      tmdbId: review.content.seriesTmdbId,
    });
  }

  const discussionVisible = Boolean(review && (!review.spoilerReason || threadRevealed));
  const reviewAuthor = review?.author.displayName?.trim() || 'Watchly member';
  const threadedReplies = useMemo(() => flattenReviewReplies(items), [items]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      {review?.backgroundUrl ? <SpotlightAtmosphere blurRadius={24} imageUrl={review.backgroundUrl} /> : null}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.layout}>
        <FlatList
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 58 }]}
          data={discussionVisible ? threadedReplies : []}
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.reply.id}
          ListEmptyComponent={discussionVisible && !loading && !error ? <Text style={styles.empty}>Start the conversation.</Text> : null}
          ListFooterComponent={discussionVisible ? <>
            {loadingMore ? <ActivityIndicator accessibilityLabel="Loading more replies" color={colors.accent} style={styles.loader} /> : null}
            {error ? <View style={styles.errorBlock}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Button compact label="Retry" onPress={() => nextCursor ? void loadMore() : setReloadVersion((value) => value + 1)} variant="secondary" />
            </View> : null}
          </> : null}
          ListHeaderComponent={<View style={styles.threadHeader}>
            {loading && !review ? <ActivityIndicator accessibilityLabel="Loading discussion" color={colors.accent} style={styles.loader} /> : null}
            {!review && error ? <View style={styles.errorBlock}>
              <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
              <Button label="Retry" onPress={() => setReloadVersion((value) => value + 1)} variant="secondary" />
            </View> : null}
            {review?.spoilerReason && !threadRevealed ? <View style={styles.threadGuard}>
              <EyeOff color={colors.accentText} size={26} />
              <Text style={styles.threadGuardTitle}>Spoiler-protected discussion</Text>
              <Text style={styles.threadGuardBody}>{review.spoilerReason}</Text>
              <Button label="Reveal review and replies" onPress={() => setThreadRevealed(true)} variant="secondary" />
            </View> : review ? <>
              <SocialReviewPost
                authorAvatarUrl={review.author.avatarUrl}
                authorDisplayName={review.author.displayName}
                body={review.body}
                contentContext={review.contentContext}
                contentImageUrl={review.contentImageUrl}
                contentMeta={review.contentMeta}
                contentTitle={review.contentTitle}
                likeCount={review.likeCount}
                likedByViewer={review.likedByViewer}
                onOpenAuthor={() => navigation.navigate('PublicProfile', { userId: review.author.id })}
                onOpenContent={openContent}
                onReport={currentUser?.id === review.author.id ? undefined : () => setReportTarget({ id: review.id, label: `Review by ${reviewAuthor}`, type: review.type })}
                onSetLiked={(liked) => getFirebaseIdToken().then((token) => {
                  if (!token) throw new Error('Sign in again before liking this review.');
                  return setFeedItemLiked(token, route.params.target, liked);
                }).then((result) => {
                  notifyUserDataChanged('feed');
                  return result;
                })}
                rating={review.score}
                updatedAt={review.updatedAt}
                variant="thread"
              />
              <Text style={styles.repliesTitle}>Replies</Text>
            </> : null}
          </View>}
          onEndReached={() => { if (!error) void loadMore(); }}
          onEndReachedThreshold={0.8}
          ref={listRef}
          renderItem={({ item: row }) => {
            const { reply: item } = row;
            const author = item.author.displayName?.trim() || 'Watchly member';
            const visualDepth = Math.min(row.depth, 4);
            return <View style={styles.threadedReply}>
              {visualDepth > 0 ? <View style={[styles.threadRails, { width: visualDepth * 14 }]}>
                {Array.from({ length: visualDepth }, (_, index) => <View key={index} style={styles.threadLineSlot}><View style={styles.threadLine} /></View>)}
              </View> : null}
              <View style={styles.reply}>
                <View style={styles.replyHeader}>
                  <Pressable accessibilityRole="button" onPress={() => navigation.navigate('PublicProfile', { userId: item.author.id })} style={styles.authorButton}>
                    <UserAvatar avatarUrl={item.author.avatarUrl} displayName={author} size={38} />
                    <View style={styles.authorCopy}>
                      <Text numberOfLines={1} style={styles.author}>{author}</Text>
                      <Text style={styles.date}>{formatReplyDate(item.createdAt)}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={item.ownedByViewer ? 'Delete your reply' : `Report ${author}'s reply`}
                    accessibilityRole="button"
                    onPress={() => item.ownedByViewer ? confirmDelete(item) : setReportTarget({ id: item.id, label: `Reply by ${author}`, type: 'reviewReply' })}
                    style={styles.iconButton}
                  >
                    {item.ownedByViewer ? <Trash2 color={colors.danger} size={17} /> : <Flag color={colors.textMuted} size={17} />}
                  </Pressable>
                </View>
                <SpoilerGuard contextLabel={`Reply by ${author}`} reason={item.containsSpoilers ? 'This reply contains spoilers' : null} revealKey={item.id}>
                  <Text style={styles.replyBody}>{item.body}</Text>
                </SpoilerGuard>
                <Pressable
                  accessibilityLabel={`Reply to ${author}`}
                  accessibilityRole="button"
                  onPress={() => {
                    setReplyingTo({ author, id: item.id });
                    requestAnimationFrame(() => inputRef.current?.focus());
                  }}
                  style={styles.replyAction}
                >
                  <Text style={styles.replyActionLabel}>Reply</Text>
                </Pressable>
              </View>
            </View>;
          }}
          showsVerticalScrollIndicator={false}
        />
        {discussionVisible ? <View style={styles.composer}>
          {replyingTo ? <View style={styles.replyingTo}>
            <Text numberOfLines={1} style={styles.replyingToLabel}>Replying to {replyingTo.author}</Text>
            <Pressable accessibilityRole="button" onPress={() => setReplyingTo(null)}><Text style={styles.cancelReply}>Cancel</Text></Pressable>
          </View> : null}
          <View style={styles.composerRow}>
            <Pressable
              accessibilityLabel={containsSpoilers ? 'Remove spoiler warning' : 'Mark reply as containing spoilers'}
              accessibilityRole="button"
              accessibilityState={{ selected: containsSpoilers }}
              disabled={sending}
              onPress={() => setContainsSpoilers((current) => !current)}
              style={[styles.composerIcon, containsSpoilers ? styles.composerIconSelected : null]}
            >
              <EyeOff color={containsSpoilers ? colors.accentText : colors.textMuted} size={18} />
              <Text style={[styles.spoilerLabel, containsSpoilers ? styles.spoilerLabelSelected : null]}>Spoiler</Text>
            </Pressable>
            <TextInput
              accessibilityLabel="Write a reply"
              editable={!sending}
              maxLength={1000}
              multiline
              onChangeText={setBody}
              placeholder={`Reply to ${replyingTo?.author ?? reviewAuthor}`}
              placeholderTextColor={colors.textSubtle}
              ref={inputRef}
              style={styles.input}
              value={body}
            />
            <Pressable
              accessibilityLabel="Send reply"
              accessibilityRole="button"
              disabled={!body.trim() || sending}
              onPress={() => void sendReply()}
              style={({ pressed }) => [styles.sendButton, (!body.trim() || sending) ? styles.sendButtonDisabled : null, pressed ? styles.sendButtonPressed : null]}
            >
              {sending ? <ActivityIndicator color={colors.textOnAccent} size="small" /> : <Send color={colors.textOnAccent} size={18} />}
            </Pressable>
          </View>
        </View> : null}
      </KeyboardAvoidingView>
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
    </SafeAreaView>
  );
}

function previewFromResponse(review: ReviewThreadReview, current: ReviewThreadPreview | null): ReviewThreadPreview {
  const sameReview = current?.id === review.id;
  const episodeContext = review.content.contentType === 'episode'
    ? `Series · S${review.content.seasonNumber} E${review.content.episodeNumber}`
    : null;
  return {
    ...review,
    backgroundUrl: sameReview ? current.backgroundUrl : null,
    contentContext: sameReview ? current.contentContext : episodeContext,
    contentImageUrl: sameReview ? current.contentImageUrl : null,
    contentMeta: sameReview ? current.contentMeta : review.content.contentType === 'episode' ? 'Series' : 'Movie',
    contentTitle: sameReview ? current.contentTitle : review.content.contentType === 'episode' ? 'Episode' : 'Movie',
    spoilerReason: sameReview ? current.spoilerReason : null,
  };
}

async function hydrateReview(
  review: ReviewThreadReview,
  refreshMovie: ReturnType<typeof useCatalogueCache>['refreshMovie'],
  refreshSeries: ReturnType<typeof useCatalogueCache>['refreshSeries'],
): Promise<Partial<ReviewThreadPreview>> {
  try {
    if (review.content.contentType === 'movie') {
      const movie = await refreshMovie(review.content.tmdbId);
      return {
        backgroundUrl: movie.backdropUrl ?? movie.posterUrl,
        contentContext: null,
        contentImageUrl: movie.posterUrl,
        contentMeta: 'Movie',
        contentTitle: movie.title,
      };
    }
    const [series, episode] = await Promise.all([
      refreshSeries(review.content.seriesTmdbId),
      getEpisodeDetails(review.content.seriesTmdbId, review.content.seasonNumber, review.content.episodeNumber),
    ]);
    return {
      backgroundUrl: series.backdropUrl ?? episode.item.stillUrl ?? series.posterUrl,
      contentContext: `${series.title} · S${review.content.seasonNumber} E${review.content.episodeNumber}`,
      contentImageUrl: episode.item.stillUrl,
      contentMeta: 'Series',
      contentTitle: episode.item.title,
    };
  } catch {
    return {};
  }
}

function formatReplyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  author: { color: colors.text, fontSize: 14, fontWeight: '800' },
  authorButton: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: touchTargets.min },
  authorCopy: { flex: 1 },
  cancelReply: { ...typography.meta, color: colors.accentText },
  composer: { backgroundColor: 'rgba(9, 12, 19, 0.92)', borderTopColor: colors.borderStrong, borderTopWidth: StyleSheet.hairlineWidth, gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  composerIcon: { alignItems: 'center', borderRadius: radii.md, flexDirection: 'row', gap: 4, height: touchTargets.min, justifyContent: 'center', paddingHorizontal: spacing.sm },
  composerIconSelected: { backgroundColor: colors.accentSoft },
  composerRow: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.sm },
  content: { flexGrow: 1, paddingBottom: spacing.xl, paddingHorizontal: spacing.md },
  date: { ...typography.meta, color: colors.textSubtle },
  empty: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.xl, textAlign: 'center' },
  error: { ...typography.body, color: colors.danger, textAlign: 'center' },
  errorBlock: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  iconButton: { alignItems: 'center', height: touchTargets.min, justifyContent: 'center', width: touchTargets.min },
  input: { ...typography.body, backgroundColor: colors.panelElevated, borderColor: colors.borderStrong, borderRadius: radii.xl, borderWidth: 1, color: colors.text, flex: 1, maxHeight: 112, minHeight: touchTargets.min, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  layout: { flex: 1 },
  loader: { marginVertical: spacing.lg },
  repliesTitle: { ...typography.title, borderBottomColor: colors.borderStrong, borderBottomWidth: StyleSheet.hairlineWidth, color: colors.text, paddingBottom: spacing.md, paddingTop: spacing.xl },
  reply: { flex: 1, gap: spacing.sm, minWidth: 0, paddingVertical: spacing.md },
  replyAction: { alignItems: 'flex-start', alignSelf: 'flex-start', justifyContent: 'center', minHeight: 32, paddingRight: spacing.md },
  replyActionLabel: { ...typography.meta, color: colors.textMuted },
  replyBody: { ...typography.body, color: colors.text },
  replyHeader: { alignItems: 'center', flexDirection: 'row' },
  replyingTo: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  replyingToLabel: { ...typography.meta, color: colors.textMuted, flex: 1 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  sendButton: { alignItems: 'center', backgroundColor: colors.accent, borderRadius: 22, height: touchTargets.min, justifyContent: 'center', width: touchTargets.min },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonPressed: { backgroundColor: colors.accentPressed, transform: [{ scale: 0.96 }] },
  spoilerLabel: { ...typography.meta, color: colors.textMuted },
  spoilerLabelSelected: { color: colors.accentText },
  threadGuard: { alignItems: 'center', borderBottomColor: colors.borderStrong, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm, marginTop: spacing.md, padding: spacing.xl },
  threadGuardBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  threadGuardTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
  threadHeader: { gap: spacing.md },
  threadedReply: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row' },
  threadLine: { backgroundColor: colors.borderStrong, flex: 1, width: StyleSheet.hairlineWidth },
  threadLineSlot: { alignItems: 'center', width: 14 },
  threadRails: { alignSelf: 'stretch', flexDirection: 'row' },
});
