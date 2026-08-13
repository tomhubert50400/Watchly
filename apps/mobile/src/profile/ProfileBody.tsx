import { memo, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ViewingStats } from '../api/viewings';
import { ExpandableReviewText } from '../components/ExpandableReviewText';
import { MediaPoster } from '../components/MediaPoster';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { colors, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { getProfileOpinionTarget, isReview } from './profileModel';
import type { ProfileMediaFilter } from './profileMediaModel';
import { ProfileMediaRail } from './ProfileMediaRail';
import type { HydratedProfileOpinion } from './profileOpinionHydration';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import { ViewingStatsSummaryCard } from './ViewingStatsSummaryCard';

type HydratedProfileReview = Extract<HydratedProfileOpinion, { body: string }>;

type ProfileMediaPreviews = {
  favorites: readonly LibraryMediaItem[];
  movies: readonly LibraryMediaItem[];
  series: readonly LibraryMediaItem[];
};

export function ProfileBody({
  avatarLoading = false,
  avatarUrl,
  displayName,
  emptyActivityAction,
  emptyActivityBody,
  emptyActivityTitle,
  followersCount,
  followingCount,
  handle,
  identityAction,
  mediaEmptyLabels,
  mediaPreviews,
  notice,
  onAvatarPress,
  onFollowersPress,
  onFollowingPress,
  onOpenMediaItem,
  onOpenOpinion,
  onOpenStats,
  onViewAllMedia,
  opinions,
  showMediaRails = true,
  stats,
  statsAccessibilityHint,
  statsTitle,
}: {
  avatarLoading?: boolean;
  avatarUrl: string | null;
  displayName: string | null;
  emptyActivityAction?: ReactNode;
  emptyActivityBody: string;
  emptyActivityTitle: string;
  followersCount: number;
  followingCount: number;
  handle: string | null;
  identityAction?: ReactNode;
  mediaEmptyLabels: {
    favorites: string;
    movies: string;
    series: string;
  };
  mediaPreviews: ProfileMediaPreviews;
  notice?: ReactNode;
  onAvatarPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onOpenMediaItem: (item: LibraryMediaItem) => void;
  onOpenOpinion: (item: HydratedProfileOpinion) => void;
  onOpenStats: () => void;
  onViewAllMedia: (filter: ProfileMediaFilter) => void;
  opinions: readonly HydratedProfileOpinion[];
  showMediaRails?: boolean;
  stats: ViewingStats;
  statsAccessibilityHint?: string;
  statsTitle?: string;
}) {
  const profileReviews = opinions.filter(isHydratedProfileReview);
  const recentOpinions = getRecentProfileOpinions(opinions);

  return (
    <View style={styles.stack}>
      <View style={styles.profileIntro}>
        <ProfileSummaryCard
          avatarLoading={avatarLoading}
          avatarUrl={avatarUrl}
          displayName={displayName}
          followersCount={followersCount}
          followingCount={followingCount}
          handle={handle}
          onAvatarPress={onAvatarPress}
          onFollowersPress={onFollowersPress}
          onFollowingPress={onFollowingPress}
          reviewsCount={profileReviews.length}
        />
        {identityAction}
        <View pointerEvents="none" style={styles.statsDivider} />
        <ViewingStatsSummaryCard
          accessibilityHint={statsAccessibilityHint}
          onPress={onOpenStats}
          stats={stats}
          title={statsTitle}
        />
        <View pointerEvents="none" style={styles.statsDivider} />
      </View>
      {notice}
      {showMediaRails ? (
        <>
          <ProfileMediaRail
            emptyLabel={mediaEmptyLabels.series}
            items={mediaPreviews.series}
            onOpen={onOpenMediaItem}
            onViewAll={() => onViewAllMedia('series')}
            title="Series"
          />
          <ProfileMediaRail
            emptyLabel={mediaEmptyLabels.movies}
            items={mediaPreviews.movies}
            onOpen={onOpenMediaItem}
            onViewAll={() => onViewAllMedia('movies')}
            title="Movies"
          />
          <ProfileMediaRail
            emptyLabel={mediaEmptyLabels.favorites}
            items={mediaPreviews.favorites}
            onOpen={onOpenMediaItem}
            onViewAll={() => onViewAllMedia('favorites')}
            title="Favorites"
          />
        </>
      ) : null}
      {opinions.length === 0 ? (
        <View style={styles.emptyActivity}>
          <Text style={styles.emptyActivityTitle}>{emptyActivityTitle}</Text>
          <Text style={styles.emptyActivityBody}>{emptyActivityBody}</Text>
          {emptyActivityAction}
        </View>
      ) : (
        <>
          <View style={styles.opinionsSection}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <ScrollView
              contentContainerStyle={styles.recentRail}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {recentOpinions.map((item) => (
                <ProfileRecentPoster
                  item={item}
                  key={`${item.type}-${item.id}`}
                  onOpenContent={onOpenOpinion}
                />
              ))}
            </ScrollView>
          </View>
          {profileReviews.length > 0 ? (
            <View style={styles.opinionsSection}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>LATEST REVIEWS</Text>
              <View style={styles.opinionList}>
                {profileReviews.map((item) => (
                  <ProfileReviewCard
                    item={item}
                    key={`${item.type}-${item.id}`}
                    onOpenContent={onOpenOpinion}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const ProfileRecentPoster = memo(function ProfileRecentPoster({
  item,
  onOpenContent,
}: {
  item: HydratedProfileOpinion;
  onOpenContent: (item: HydratedProfileOpinion) => void;
}) {
  const contentTitle = getOpinionDisplayTitle(item);

  return (
    <Pressable
      accessibilityLabel={`Open ${contentTitle}`}
      accessibilityRole="button"
      onPress={() => onOpenContent(item)}
      style={({ pressed }) => [styles.recentPosterCard, pressed ? styles.cardPressed : null]}
    >
      <MediaPoster
        accessibilityLabel={`${contentTitle} artwork`}
        posterUrl={item.contentImageUrl}
        style={styles.recentPosterArtwork}
      />
    </Pressable>
  );
});

const ProfileReviewCard = memo(function ProfileReviewCard({
  item,
  onOpenContent,
}: {
  item: HydratedProfileReview;
  onOpenContent: (item: HydratedProfileOpinion) => void;
}) {
  const contentTitle = getOpinionDisplayTitle(item);
  const contentMeta = item.content.contentType === 'episode'
    ? `${item.contentTitle} · ${item.contentSubtitle}`
    : item.contentSubtitle;

  return (
    <View style={styles.reviewCard}>
      <Pressable
        accessibilityLabel={`Open review for ${contentTitle}`}
        accessibilityRole="button"
        onPress={() => onOpenContent(item)}
        style={({ pressed }) => [styles.reviewHeader, pressed ? styles.cardPressed : null]}
      >
        <MediaPoster
          accessibilityLabel={`${contentTitle} artwork`}
          posterUrl={item.contentImageUrl}
          style={styles.reviewPoster}
        />
        <View style={styles.reviewHeaderCopy}>
          <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
          <Text numberOfLines={2} style={styles.reviewTitle}>{contentTitle}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{contentMeta}</Text>
          {item.score !== null ? <StarRatingDisplay rating={item.score} size={15} /> : null}
        </View>
      </Pressable>
      <ExpandableReviewText body={item.body} style={styles.reviewBody} textStyle={styles.reviewText} />
    </View>
  );
});

function getRecentProfileOpinions(items: readonly HydratedProfileOpinion[]) {
  const seenContent = new Set<string>();

  return items.filter((item) => {
    const key = item.content.contentType === 'movie'
      ? `movie:${item.content.tmdbId}`
      : `episode:${item.content.seriesTmdbId}:${item.content.seasonNumber}:${item.content.episodeNumber}`;

    if (seenContent.has(key)) return false;
    seenContent.add(key);
    return true;
  }).slice(0, 8);
}

function getOpinionDisplayTitle(item: HydratedProfileOpinion) {
  return item.content.contentType === 'episode'
    ? item.seriesTitle ?? item.contentTitle
    : item.contentTitle;
}

function isHydratedProfileReview(
  item: HydratedProfileOpinion,
): item is HydratedProfileReview {
  return isReview(item);
}

export function getHydratedProfileOpinionTarget(item: HydratedProfileOpinion) {
  return getProfileOpinionTarget(item, {
    contentTitle: item.contentTitle,
    seriesTitle: item.seriesTitle,
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US');
}

const styles = StyleSheet.create({
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
  },
  emptyActivity: {
    alignItems: 'flex-start',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  emptyActivityBody: {
    ...typography.body,
    color: colors.textMuted,
    maxWidth: 320,
  },
  emptyActivityTitle: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 33,
    maxWidth: 300,
  },
  opinionList: {
    gap: 0,
  },
  opinionsSection: {
    gap: spacing.sm,
  },
  profileIntro: {
    gap: spacing.xxl,
  },
  recentPosterArtwork: {
    height: 126,
    width: 84,
  },
  recentPosterCard: {
    width: 84,
  },
  recentRail: {
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  reviewBody: {
    marginTop: spacing.xs,
  },
  reviewCard: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  reviewHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  reviewHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  reviewPoster: {
    height: 87,
    width: 58,
  },
  reviewText: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 25,
  },
  reviewTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
    lineHeight: 22,
    marginTop: 3,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  stack: {
    gap: spacing.xxl,
  },
  statsDivider: {
    backgroundColor: colors.borderStrong,
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  subtitle: {
    ...typography.meta,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
});
