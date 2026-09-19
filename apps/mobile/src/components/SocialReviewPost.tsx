import { memo, useEffect, useRef, useState } from 'react';
import { Flag, Heart, MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError } from '../feedback/haptics';
import {
  applyLikeMutation,
  beginLikeMutation,
  type FeedLikeState,
} from '../feed/feedLikeModel';
import { useToast } from '../notifications/ToastContext';
import { ExpandableReviewText } from './ExpandableReviewText';
import { MediaPoster } from './MediaPoster';
import { StarRatingDisplay } from './StarRatingDisplay';
import { UserAvatar } from './UserAvatar';
import { SpoilerGuard } from './SpoilerGuard';

type SocialReviewPostProps = {
  authorAvatarUrl: string | null;
  authorDisplayName: string | null;
  body: string;
  contentContext?: string | null;
  contentImageUrl: string | null;
  contentMeta: string;
  contentTitle: string;
  likeCount: number;
  likedByViewer: boolean;
  onOpenContent: () => void;
  onOpenReplies?: () => void;
  onReport?: () => void;
  onSetLiked?: (liked: boolean) => Promise<FeedLikeState>;
  onOpenAuthor?: () => void;
  spoilerReason?: string | null;
  spoilerKey?: string;
  spoilerContextLabel?: string;
  canReveal?: boolean;
  rating: number | null;
  replyCount?: number;
  updatedAt: string;
  variant?: 'community' | 'default';
};

export const SocialReviewPost = memo(function SocialReviewPost({
  authorAvatarUrl,
  authorDisplayName,
  body,
  contentContext,
  contentImageUrl,
  contentMeta,
  contentTitle,
  likeCount,
  likedByViewer,
  onOpenContent,
  onOpenReplies,
  onReport,
  onSetLiked,
  onOpenAuthor,
  spoilerReason,
  spoilerKey,
  spoilerContextLabel,
  canReveal,
  rating,
  replyCount = 0,
  updatedAt,
  variant = 'default',
}: SocialReviewPostProps) {
  const visibleAuthor = authorDisplayName?.trim() || 'Watchly member';
  const visibleContentLabel = contentContext ? `${contentContext}, ${contentTitle}` : contentTitle;
  const { showToast } = useToast();
  const [likeState, setLikeState] = useState<FeedLikeState>({ likeCount, likedByViewer });
  const confirmedLikeStateRef = useRef(likeState);
  const likeMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const likeStateRef = useRef(likeState);
  const pendingLikeCountRef = useRef(0);
  likeStateRef.current = likeState;

  useEffect(() => {
    if (pendingLikeCountRef.current === 0) {
      const next = { likeCount, likedByViewer };
      setLikeState(next);
      likeStateRef.current = next;
      confirmedLikeStateRef.current = next;
    }
  }, [likeCount, likedByViewer]);

  const toggleLike = async () => {
    if (!onSetLiked) return;
    const mutation = beginLikeMutation(likeStateRef.current);
    if (pendingLikeCountRef.current === 0) {
      confirmedLikeStateRef.current = likeStateRef.current;
    }
    pendingLikeCountRef.current += 1;
    setLikeState(mutation.optimistic);
    likeStateRef.current = mutation.optimistic;

    const commitMutation = async () => {
      try {
        confirmedLikeStateRef.current = applyLikeMutation(
          await onSetLiked(mutation.optimistic.likedByViewer),
        );
      } catch (error) {
        hapticError();
        showToast(error instanceof Error ? error.message : 'Could not update this like.');
      } finally {
        pendingLikeCountRef.current -= 1;
        if (pendingLikeCountRef.current === 0) {
          setLikeState(confirmedLikeStateRef.current);
          likeStateRef.current = confirmedLikeStateRef.current;
        }
      }
    };
    const queuedMutation = likeMutationQueueRef.current.then(commitMutation, commitMutation);
    likeMutationQueueRef.current = queuedMutation.catch(() => undefined);
    await queuedMutation;
  };

  const reportButton = onReport ? (
    <Pressable
      accessibilityLabel={`Report ${visibleAuthor}'s review`}
      accessibilityRole="button"
      onPress={onReport}
      style={({ pressed }) => [
        styles.actionButton,
        pressed ? styles.actionButtonPressed : null,
      ]}
    >
      <Flag color={colors.textMuted} size={18} strokeWidth={2} />
    </Pressable>
  ) : null;

  return (
    <View style={[styles.post, variant === 'community' ? styles.communityPost : null]}>
      <View style={styles.byline}>
        {onOpenAuthor ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${visibleAuthor}'s profile`} onPress={onOpenAuthor} style={styles.authorLink}>
          <UserAvatar avatarUrl={authorAvatarUrl} displayName={visibleAuthor} size={42} />
          <Text numberOfLines={1} style={styles.author}>{visibleAuthor}</Text>
        </Pressable> : <>
          <UserAvatar avatarUrl={authorAvatarUrl} displayName={visibleAuthor} size={42} />
          <Text numberOfLines={1} style={styles.author}>{visibleAuthor}</Text>
        </>}
        {variant !== 'community' ? <Text style={styles.date}>{formatDate(updatedAt)}</Text> : null}
      </View>
      <SpoilerGuard reason={spoilerReason} contextLabel={spoilerContextLabel} revealKey={`${spoilerKey ?? ''}:${body}:${visibleContentLabel}`} canReveal={canReveal}>
        <Pressable
          accessibilityLabel={`Open ${visibleContentLabel}`}
          accessibilityRole="button"
          onPress={onOpenContent}
          style={({ pressed }) => [
            styles.mediaLink,
            variant === 'community' ? styles.communityMediaLink : null,
            pressed ? styles.mediaLinkPressed : null,
          ]}
        >
          {variant !== 'community' ? (
            <MediaPoster
              accessibilityLabel={`${contentTitle} artwork`}
              posterUrl={contentImageUrl}
              style={styles.poster}
            />
          ) : null}
          <View style={[styles.mediaCopy, variant === 'community' ? styles.communityMediaCopy : null]}>
            <View>
              {variant !== 'community' ? (
                <Text style={styles.mediaMeta}>{contentMeta}</Text>
              ) : null}
              {contentContext ? <Text numberOfLines={2} style={styles.mediaContext}>{contentContext}</Text> : null}
              <Text numberOfLines={2} style={[styles.mediaTitle, contentContext ? styles.episodeTitle : null]}>{contentTitle}</Text>
              {variant !== 'community' ? (
                <Text style={styles.openLabel}>Open content</Text>
              ) : null}
            </View>
            {variant === 'community' && rating !== null ? (
              <View style={styles.communityRating}>
                <StarRatingDisplay rating={rating} showValue size={22} />
              </View>
            ) : null}
          </View>
          {variant === 'community' ? (
            <MediaPoster
              accessibilityLabel={`${contentTitle} artwork`}
              posterUrl={contentImageUrl}
              style={styles.communityPoster}
            />
          ) : null}
        </Pressable>
        {variant !== 'community' && rating !== null ? (
          <View style={styles.rating}>
            <StarRatingDisplay rating={rating} showValue size={17} />
          </View>
        ) : null}
        {body ? <ExpandableReviewText body={body} style={[styles.review, variant === 'community' ? styles.communityReview : null]} /> : null}
      </SpoilerGuard>
      {variant === 'community' || onReport || onSetLiked ? (
        <View style={[styles.actions, variant === 'community' ? styles.communityActions : null]}>
          {variant === 'community' ? (
            <Text style={styles.communityFooterMeta}>
              {formatDate(updatedAt)} · {contentMeta}
            </Text>
          ) : null}
          {reportButton}
          {onOpenReplies ? <Pressable
            accessibilityLabel={`Open ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'} to ${visibleAuthor}'s review`}
            accessibilityRole="button"
            onPress={onOpenReplies}
            style={({ pressed }) => [styles.likeButton, pressed ? styles.likeButtonPressed : null]}
          >
            {replyCount > 0 ? <Text style={styles.likeCount}>{replyCount}</Text> : null}
            <MessageCircle color={colors.textMuted} size={19} strokeWidth={2.2} />
          </Pressable> : null}
          {onSetLiked ? <Pressable
            accessibilityLabel={`${likeState.likedByViewer ? 'Unlike' : 'Like'} ${visibleAuthor}'s review, ${likeState.likeCount} ${likeState.likeCount === 1 ? 'like' : 'likes'}`}
            accessibilityRole="button"
            accessibilityState={{
              selected: likeState.likedByViewer,
            }}
            onPress={() => {
              void toggleLike();
            }}
            style={({ pressed }) => [
              styles.likeButton,
              pressed ? styles.likeButtonPressed : null,
            ]}
          >
            {likeState.likeCount > 0 ? (
              <Text
                accessibilityLiveRegion="polite"
                style={[styles.likeCount, likeState.likedByViewer ? styles.likeCountActive : null]}
              >
                {likeState.likeCount}
              </Text>
            ) : null}
            <Heart
              color={likeState.likedByViewer ? colors.accentText : colors.textMuted}
              fill={likeState.likedByViewer ? colors.accent : 'transparent'}
              size={19}
              strokeWidth={2.2}
            />
          </Pressable> : null}
        </View>
      ) : null}
    </View>
  );
});

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  authorLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minHeight: touchTargets.min,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    minWidth: touchTargets.min,
  },
  actionButtonPressed: {
    opacity: 0.72,
  },
  author: {
    color: colors.text,
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  byline: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  communityMediaLink: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  communityActions: {
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  communityFooterMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    flex: 1,
  },
  communityMediaCopy: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  communityPost: {
    ...shadows.panel,
    backgroundColor: 'rgba(15, 19, 29, 0.62)',
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  communityPoster: {
    height: 112,
    width: 75,
  },
  communityRating: {
    alignItems: 'flex-start',
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
  communityReview: {
    marginTop: spacing.xs,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  likeButton: {
    alignItems: 'center',
    borderRadius: radii.md,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.sm,
  },
  likeButtonPressed: {
    opacity: 0.72,
  },
  likeCount: {
    ...typography.meta,
    color: colors.textMuted,
  },
  likeCountActive: {
    color: colors.accentText,
  },
  mediaCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  mediaContext: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  mediaLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  mediaLinkPressed: {
    opacity: 0.72,
  },
  mediaMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  mediaTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  episodeTitle: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 2,
  },
  openLabel: {
    ...typography.meta,
    color: colors.accentText,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
  },
  post: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
  },
  poster: {
    height: 81,
    width: 54,
  },
  review: {
    marginTop: spacing.md,
  },
  rating: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
});
