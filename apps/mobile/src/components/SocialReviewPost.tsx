import { memo, useEffect, useRef, useState } from 'react';
import { Flag, Heart } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
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
  contentImageUrl: string | null;
  contentMeta: string;
  contentTitle: string;
  likeCount: number;
  likedByViewer: boolean;
  onOpenContent: () => void;
  onReport?: () => void;
  onSetLiked?: (liked: boolean) => Promise<FeedLikeState>;
  onOpenAuthor?: () => void;
  spoilerReason?: string | null;
  spoilerKey?: string;
  spoilerContextLabel?: string;
  canReveal?: boolean;
  rating: number | null;
  updatedAt: string;
};

export const SocialReviewPost = memo(function SocialReviewPost({
  authorAvatarUrl,
  authorDisplayName,
  body,
  contentImageUrl,
  contentMeta,
  contentTitle,
  likeCount,
  likedByViewer,
  onOpenContent,
  onReport,
  onSetLiked,
  onOpenAuthor,
  spoilerReason,
  spoilerKey,
  spoilerContextLabel,
  canReveal,
  rating,
  updatedAt,
}: SocialReviewPostProps) {
  const visibleAuthor = authorDisplayName?.trim() || 'Watchly member';
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

  return (
    <View style={styles.post}>
      <View style={styles.byline}>
        {onOpenAuthor ? <Pressable accessibilityRole="button" accessibilityLabel={`Open ${visibleAuthor}'s profile`} onPress={onOpenAuthor} style={styles.authorLink}>
          <UserAvatar avatarUrl={authorAvatarUrl} displayName={visibleAuthor} size={42} />
          <Text numberOfLines={1} style={styles.author}>{visibleAuthor}</Text>
        </Pressable> : <>
          <UserAvatar avatarUrl={authorAvatarUrl} displayName={visibleAuthor} size={42} />
          <Text numberOfLines={1} style={styles.author}>{visibleAuthor}</Text>
        </>}
        <Text style={styles.date}>{formatDate(updatedAt)}</Text>
      </View>
      <SpoilerGuard reason={spoilerReason} contextLabel={spoilerContextLabel} revealKey={`${spoilerKey ?? ''}:${body}:${contentTitle}`} canReveal={canReveal}>
        <Pressable
          accessibilityLabel={`Open ${contentTitle}`}
          accessibilityRole="button"
          onPress={onOpenContent}
          style={({ pressed }) => [styles.mediaLink, pressed ? styles.mediaLinkPressed : null]}
        >
          <MediaPoster
            accessibilityLabel={`${contentTitle} artwork`}
            posterUrl={contentImageUrl}
            style={styles.poster}
          />
          <View style={styles.mediaCopy}>
            <Text style={styles.mediaMeta}>{contentMeta}</Text>
            <Text numberOfLines={2} style={styles.mediaTitle}>{contentTitle}</Text>
            <Text style={styles.openLabel}>Open content</Text>
          </View>
        </Pressable>
        {rating !== null ? (
          <View style={styles.rating}>
            <StarRatingDisplay rating={rating} showValue size={17} />
          </View>
        ) : null}
        {body ? <ExpandableReviewText body={body} style={styles.review} /> : null}
      </SpoilerGuard>
      {onReport || onSetLiked ? (
        <View style={styles.actions}>
          {onReport ? (
            <Pressable
              accessibilityLabel={`Report ${visibleAuthor}'s review`}
              accessibilityRole="button"
              onPress={onReport}
              style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null]}
            >
              <Flag color={colors.textMuted} size={18} strokeWidth={2} />
            </Pressable>
          ) : null}
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
