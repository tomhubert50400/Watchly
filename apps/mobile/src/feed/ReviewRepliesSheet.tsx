import { EyeOff, Flag, Send, Trash2 } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  createReviewReply,
  deleteReviewReply,
  FeedReviewTarget,
  listReviewReplies,
  ReviewReply,
} from '../api/feed';
import type { ReportTarget } from '../api/reports';
import { useAuthSession } from '../auth/AuthSessionContext';
import { BottomActionSheet, BottomActionSheetScrollView } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { SpoilerGuard } from '../components/SpoilerGuard';
import { UserAvatar } from '../components/UserAvatar';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import { useToast } from '../notifications/ToastContext';

export type ReviewRepliesTarget = FeedReviewTarget & {
  authorDisplayName: string;
  contentTitle: string;
  spoilerReason: string | null;
};

type Props = {
  onClose: () => void;
  onOpenAuthor: (userId: string) => void;
  onReport: (target: ReportTarget) => void;
  target: ReviewRepliesTarget | null;
};

export function ReviewRepliesSheet({ onClose, onOpenAuthor, onReport, target }: Props) {
  const { getFirebaseIdToken } = useAuthSession();
  const { showToast } = useToast();
  const [body, setBody] = useState('');
  const [containsSpoilers, setContainsSpoilers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ReviewReply[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [reviewAuthor, setReviewAuthor] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [threadRevealed, setThreadRevealed] = useState(false);
  const requestVersion = useRef(0);
  const pagePending = useRef(false);

  useEffect(() => {
    requestVersion.current += 1;
    const version = requestVersion.current;
    pagePending.current = false;
    setBody('');
    setContainsSpoilers(false);
    setError(null);
    setItems([]);
    setNextCursor(null);
    setReviewAuthor(null);
    setSending(false);
    setThreadRevealed(false);

    if (!target) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void getFirebaseIdToken().then(async (token) => {
      if (!token) throw new Error('Sign in again to view replies.');
      return listReviewReplies(token, target);
    }).then((response) => {
      if (requestVersion.current !== version) return;
      setItems(response.items);
      setNextCursor(response.nextCursor);
      setReviewAuthor(response.review.author.displayName?.trim() || 'Watchly member');
    }).catch((loadError) => {
      if (requestVersion.current === version) {
        setError(loadError instanceof Error ? loadError.message : 'Replies could not load.');
      }
    }).finally(() => {
      if (requestVersion.current === version) setLoading(false);
    });
  }, [getFirebaseIdToken, reloadVersion, target]);

  async function loadMore() {
    if (!target || !nextCursor || pagePending.current) return;
    const version = requestVersion.current;
    pagePending.current = true;
    setLoadingMore(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again to view replies.');
      const response = await listReviewReplies(token, target, nextCursor);
      if (requestVersion.current !== version) return;
      const existing = new Set(items.map((item) => item.id));
      setItems((current) => [...current, ...response.items.filter((item) => !existing.has(item.id))]);
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
    if (!target || !normalized || sending) return;
    setSending(true);
    setError(null);
    try {
      const token = await getFirebaseIdToken();
      if (!token) throw new Error('Sign in again before replying.');
      const reply = await createReviewReply(token, target, normalized, containsSpoilers);
      setItems((current) => [...current, reply]);
      setBody('');
      setContainsSpoilers(false);
      hapticSuccess();
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
      hapticSuccess();
    } catch (deleteError) {
      hapticError();
      showToast(deleteError instanceof Error ? deleteError.message : 'The reply could not be deleted.');
    }
  }

  const discussionVisible = Boolean(target && (!target.spoilerReason || threadRevealed));
  const visibleReviewAuthor = reviewAuthor ?? target?.authorDisplayName ?? 'Watchly member';
  const footer = discussionVisible && target ? <View style={styles.composer}>
    <TextInput
      accessibilityLabel="Write a reply"
      editable={!sending}
      maxLength={1000}
      multiline
      onChangeText={setBody}
      placeholder={`Reply to ${visibleReviewAuthor}`}
      placeholderTextColor={colors.textSubtle}
      style={styles.input}
      value={body}
    />
    <View style={styles.composerActions}>
      <View style={styles.spoilerToggle}>
        <Switch
          accessibilityLabel="Mark reply as containing spoilers"
          disabled={sending}
          onValueChange={setContainsSpoilers}
          thumbColor={containsSpoilers ? colors.accentText : colors.textMuted}
          trackColor={{ false: colors.borderStrong, true: colors.accentSoft }}
          value={containsSpoilers}
        />
        <Text style={styles.spoilerLabel}>Contains spoilers</Text>
      </View>
      <Button compact disabled={!body.trim()} icon={<Send color={colors.textOnAccent} size={17} />} label="Reply" loading={sending} onPress={() => void sendReply()} />
    </View>
  </View> : null;

  return <BottomActionSheet footer={footer} onClose={onClose} title="Replies" visible={target !== null}>
    <BottomActionSheetScrollView
      contentContainerStyle={styles.content}
      onScroll={({ nativeEvent }) => {
        const remaining = nativeEvent.contentSize.height - nativeEvent.contentOffset.y - nativeEvent.layoutMeasurement.height;
        if (!error && remaining <= nativeEvent.layoutMeasurement.height) void loadMore();
      }}
      scrollEventThrottle={100}
    >
      {target ? <View style={styles.context}>
        <Text style={styles.contextTitle}>Discussion on {visibleReviewAuthor}&apos;s review</Text>
        <Text numberOfLines={2} style={styles.contextBody}>{target.contentTitle}</Text>
      </View> : null}
      {target?.spoilerReason && !threadRevealed ? <View style={styles.threadGuard}>
        <EyeOff color={colors.accentText} size={24} />
        <Text style={styles.threadGuardTitle}>Spoiler-protected discussion</Text>
        <Text style={styles.threadGuardBody}>{target.spoilerReason}</Text>
        <Button label="Reveal discussion" onPress={() => setThreadRevealed(true)} variant="secondary" />
      </View> : null}
      {discussionVisible && loading ? <ActivityIndicator accessibilityLabel="Loading replies" color={colors.accent} style={styles.loader} /> : null}
      {discussionVisible && !loading && items.length === 0 && !error ? <Text style={styles.empty}>Start the conversation.</Text> : null}
      {discussionVisible ? items.map((reply) => {
        const author = reply.author.displayName?.trim() || 'Watchly member';
        return <View key={reply.id} style={styles.reply}>
          <View style={styles.replyHeader}>
            <Pressable accessibilityRole="button" onPress={() => onOpenAuthor(reply.author.id)} style={styles.authorButton}>
              <UserAvatar avatarUrl={reply.author.avatarUrl} displayName={author} size={34} />
              <View style={styles.authorCopy}>
                <Text numberOfLines={1} style={styles.author}>{author}</Text>
                <Text style={styles.date}>{formatReplyDate(reply.createdAt)}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityLabel={reply.ownedByViewer ? 'Delete your reply' : `Report ${author}'s reply`}
              accessibilityRole="button"
              onPress={() => reply.ownedByViewer ? confirmDelete(reply) : onReport({ id: reply.id, label: `Reply by ${author}`, type: 'reviewReply' })}
              style={styles.iconButton}
            >
              {reply.ownedByViewer ? <Trash2 color={colors.danger} size={17} /> : <Flag color={colors.textMuted} size={17} />}
            </Pressable>
          </View>
          <SpoilerGuard
            contextLabel={`Reply by ${author}`}
            reason={reply.containsSpoilers ? 'This reply contains spoilers' : null}
            revealKey={reply.id}
          >
            <Text style={styles.replyBody}>{reply.body}</Text>
          </SpoilerGuard>
        </View>;
      }) : null}
      {discussionVisible && loadingMore ? <ActivityIndicator accessibilityLabel="Loading more replies" color={colors.accent} style={styles.loader} /> : null}
      {discussionVisible && error ? <View style={styles.errorBlock}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Button compact label="Retry" onPress={() => nextCursor ? void loadMore() : setReloadVersion((value) => value + 1)} variant="secondary" /></View> : null}
    </BottomActionSheetScrollView>
  </BottomActionSheet>;
}

function formatReplyDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  author: { color: colors.text, fontSize: 14, fontWeight: '800' },
  authorButton: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: touchTargets.min },
  authorCopy: { flex: 1 },
  composer: { gap: spacing.sm },
  composerActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  content: { gap: spacing.md, paddingBottom: spacing.lg },
  context: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: spacing.xs, paddingBottom: spacing.md },
  contextBody: { ...typography.body, color: colors.textMuted },
  contextTitle: { ...typography.title, color: colors.text },
  date: { ...typography.meta, color: colors.textSubtle },
  empty: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.xl, textAlign: 'center' },
  error: { ...typography.body, color: colors.danger },
  errorBlock: { gap: spacing.sm },
  iconButton: { alignItems: 'center', height: touchTargets.min, justifyContent: 'center', width: touchTargets.min },
  input: { ...typography.body, backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.text, maxHeight: 96, minHeight: touchTargets.min, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  loader: { marginVertical: spacing.lg },
  reply: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  replyBody: { ...typography.body, color: colors.text },
  replyHeader: { alignItems: 'center', flexDirection: 'row' },
  spoilerLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
  spoilerToggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  threadGuard: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  threadGuardBody: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  threadGuardTitle: { ...typography.title, color: colors.text, textAlign: 'center' },
});
