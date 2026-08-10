import { memo, useEffect, useRef, useState } from 'react';
import { Flag, Heart } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';
import { hapticError, hapticSelection } from '../feedback/haptics';
import {
  applyLikeMutation,
  beginLikeMutation,
  rollbackLikeMutation,
  type FeedLikeState,
} from '../feed/feedLikeModel';
import { useToast } from '../notifications/ToastContext';
import { ExpandableReviewText } from './ExpandableReviewText';
import { MediaPoster } from './MediaPoster';
import { StarRatingDisplay } from './StarRatingDisplay';
import { UserAvatar } from './UserAvatar';

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
  onSetLiked: (liked: boolean) => Promise<FeedLikeState>;
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
  rating,
  updatedAt,
}: SocialReviewPostProps) {
  const visibleAuthor = authorDisplayName?.trim() || 'Watchly member';
  const { showToast } = useToast();
  const [likeState, setLikeState] = useState<FeedLikeState>({ likeCount, likedByViewer });
  const [isLikePending, setIsLikePending] = useState(false);
  const isLikePendingRef = useRef(false);

  useEffect(() => {
    if (!isLikePendingRef.current) {
      setLikeState({ likeCount, likedByViewer });
    }
  }, [likeCount, likedByViewer]);

  const toggleLike = async () => {
    if (isLikePendingRef.current) return;

    const mutation = beginLikeMutation(likeState);
    isLikePendingRef.current = true;
    setIsLikePending(true);
    setLikeState(mutation.optimistic);
    hapticSelection();

    try {
      const confirmed = await onSetLiked(mutation.optimistic.likedByViewer);
      setLikeState(applyLikeMutation(confirmed));
    } catch (error) {
      setLikeState(rollbackLikeMutation(mutation));
      hapticError();
      showToast(error instanceof Error ? error.message : 'Could not update this like.');
    } finally {
      isLikePendingRef.current = false;
      setIsLikePending(false);
    }
  };

  return (
    <View style={styles.post}>
      <View style={styles.byline}>
        <UserAvatar avatarUrl={authorAvatarUrl} displayName={visibleAuthor} size={42} />
        <Text numberOfLines={1} style={styles.author}>{visibleAuthor}</Text>
        <Text style={styles.date}>{formatDate(updatedAt)}</Text>
      </View>
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
      <ExpandableReviewText body={body} style={styles.review} />
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
        <Pressable
          accessibilityLabel={`${likeState.likedByViewer ? 'Unlike' : 'Like'} ${visibleAuthor}'s review, ${likeState.likeCount} ${likeState.likeCount === 1 ? 'like' : 'likes'}`}
          accessibilityRole="button"
          accessibilityState={{
            busy: isLikePending,
            disabled: isLikePending,
            selected: likeState.likedByViewer,
          }}
          disabled={isLikePending}
          onPress={() => {
            void toggleLike();
          }}
          style={({ pressed }) => [
            styles.likeButton,
            pressed ? styles.likeButtonPressed : null,
            isLikePending ? styles.likeButtonPending : null,
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
        </Pressable>
      </View>
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
  likeButtonPending: {
    opacity: 0.58,
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
