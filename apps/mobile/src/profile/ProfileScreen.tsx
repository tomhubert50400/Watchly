import { memo, useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Settings, Share2 } from 'lucide-react-native';
import { getEpisodeDetails, getMovieDetails } from '../api/catalogue';
import {
  getOwnProfileOpinions,
  getProfile,
  type ProfileOpinion,
} from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ProfileAuthCard } from '../auth/ProfileAuthCard';
import { BrandWordmark } from '../brand/BrandWordmark';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ExpandableReviewText } from '../components/ExpandableReviewText';
import { IconButton } from '../components/IconButton';
import { LoadingState } from '../components/LoadingState';
import { MediaPoster } from '../components/MediaPoster';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StarRatingDisplay } from '../components/StarRatingDisplay';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { colors, radii, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import {
  buildProfileModel,
  getProfileOpinionTarget,
  isReview,
  type ProfileModel,
} from './profileModel';
import { ProfileSummaryCard } from './ProfileSummaryCard';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
type HydratedProfileOpinion = ProfileOpinion & {
  contentImageUrl: string | null;
  contentSubtitle: string;
  contentTitle: string;
  seriesTitle: string | null;
};
type HydratedProfileReview = Extract<HydratedProfileOpinion, { body: string }>;
type CachedProfile = Omit<ProfileModel, 'opinions'> & { opinions: HydratedProfileOpinion[] };
const MAX_PROFILE_OPINION_HYDRATIONS = 24;

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const {
    currentUser,
    firebaseIdToken,
    getFirebaseIdToken,
    socialRevision,
    trackingRevision,
  } = useAuthSession();
  const [shareError, setShareError] = useState<string | null>(null);
  const { refreshSeries } = useCatalogueCache();
  const userId = currentUser?.id ?? null;
  const loadProfile = useCallback(async (cached?: CachedProfile): Promise<CachedProfile> => {
    void socialRevision;
    void trackingRevision;
    const token = await getFirebaseIdToken();
    if (!token) {
      throw new Error('Your session expired. Sign in again to refresh your profile.');
    }

    const [profile, response] = await Promise.all([
      getProfile(token),
      getOwnProfileOpinions(token),
    ]);
    const model = buildProfileModel(profile, response);
    const hydratedOpinions = await Promise.all(model.opinions.map((opinion, index) => {
      const previous = cached?.opinions.find((candidate) => isSameOpinion(candidate, opinion));
      return index < MAX_PROFILE_OPINION_HYDRATIONS
        ? hydrateProfileOpinion(opinion, refreshSeries, previous)
        : hydrateProfileOpinionTitle(opinion, previous, refreshSeries);
    }));
    const opinions = hydratedOpinions.filter(
      (opinion): opinion is HydratedProfileOpinion => opinion !== null,
    );

    return { ...model, opinions };
  }, [getFirebaseIdToken, refreshSeries, socialRevision, trackingRevision]);
  const resource = useCachedResource<CachedProfile>({
    enabled: Boolean(firebaseIdToken && userId),
    key: userId ? getPrivateCacheKey(userId, 'profile:owner-activity:v4') : 'watchly:user:disabled:profile',
    load: loadProfile,
  });
  useFocusEffect(useCallback(() => {
    if (firebaseIdToken && userId) resource.revalidate();
  }, [firebaseIdToken, resource.revalidate, userId]));
  const profile = resource.data;
  const profileReviews = profile?.opinions.filter(isHydratedProfileReview) ?? [];
  const recentOpinions = profile ? getRecentProfileOpinions(profile.opinions) : [];

  const shareProfile = useCallback(async () => {
    if (!profile) return;
    setShareError(null);
    try {
      await Share.share({ message: `See ${profile.displayName}'s public ratings and reviews on Watchly.` });
    } catch {
      setShareError('Could not open sharing.');
    }
  }, [profile]);

  if (!firebaseIdToken || !userId) {
    return (
      <Screen horizontalPadding={false} leading={<BrandWordmark height={36} />} tabBarPadding={spacing.md} title="">
        <ProfileAuthCard />
      </Screen>
    );
  }

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={resource.retry}
          refreshing={resource.isRefreshing}
          tintColor={colors.accent}
        />
      }
      leading={<BrandWordmark height={36} />}
      tabBarPadding={spacing.md}
      title=""
      trailing={
        <View style={styles.headerActions}>
          <IconButton
            accessibilityLabel="Share profile"
            disabled={!profile}
            icon={<Share2 color={colors.text} size={21} strokeWidth={2} />}
            onPress={shareProfile}
          />
          <IconButton
            accessibilityLabel="Open settings"
            icon={<Settings color={colors.text} size={21} strokeWidth={2} />}
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      }
    >
      {resource.isInitialLoading && !profile ? (
        <LoadingState label="Loading your profile" />
      ) : resource.error && !profile ? (
        <EmptyState body={resource.error} title="Profile unavailable">
          <Button label="Retry" onPress={resource.retry} />
        </EmptyState>
      ) : profile ? (
        <View style={styles.stack}>
          <ProfileSummaryCard
            displayName={profile.displayName}
            followersCount={profile.stats.followersCount}
            followingCount={profile.stats.followingCount}
            ratingsCount={profile.stats.ratingsCount}
            reviewsCount={profile.stats.reviewsCount}
          />
          {shareError ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{shareError}</Text> : null}
          {profile.opinions.length === 0 ? (
            <View style={styles.emptyActivity}>
              <Text style={styles.emptyActivityTitle}>Your first rating will live here.</Text>
              <Text style={styles.emptyActivityBody}>
                Ratings and reviews stay visible to you here, whatever your privacy setting.
              </Text>
              <Button compact label="Manage privacy" onPress={() => navigation.navigate('Settings')} variant="secondary" />
            </View>
          ) : (
            <>
              <View style={styles.opinionsSection}>
                <SectionHeader title="Recently on your profile" />
                <ScrollView
                  contentContainerStyle={styles.recentRail}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  {recentOpinions.map((item) => (
                    <ProfileRecentPoster
                      item={item}
                      key={`${item.type}-${item.id}`}
                      onOpenContent={(opinion) => openOpinion(navigation, opinion)}
                    />
                  ))}
                </ScrollView>
              </View>
              {profileReviews.length > 0 ? (
                <View style={styles.opinionsSection}>
                  <SectionHeader title="Latest reviews" />
                  <View style={styles.opinionList}>
                    {profileReviews.map((item) => (
                      <ProfileReviewCard
                        item={item}
                        key={`${item.type}-${item.id}`}
                        onOpenContent={(opinion) => openOpinion(navigation, opinion)}
                      />
                    ))}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </Screen>
  );
}

const ProfileRecentPoster = memo(function ProfileRecentPoster({ item, onOpenContent }: {
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
      <Text numberOfLines={2} style={styles.recentPosterTitle}>{contentTitle}</Text>
      <View style={styles.recentPosterMeta}>
        <StarRatingDisplay rating={item.score} size={13} />
        <Text style={styles.recentPosterKind}>{isReview(item) ? 'Review' : 'Rating'}</Text>
      </View>
    </Pressable>
  );
});

const ProfileReviewCard = memo(function ProfileReviewCard({ item, onOpenContent }: {
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
          <StarRatingDisplay rating={item.score} size={15} />
        </View>
      </Pressable>
      <ExpandableReviewText body={item.body} style={styles.reviewBody} textStyle={styles.reviewText} />
    </View>
  );
});

function getRecentProfileOpinions(items: HydratedProfileOpinion[]) {
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

function isHydratedProfileReview(item: HydratedProfileOpinion): item is HydratedProfileReview {
  return isReview(item);
}

function openOpinion(
  navigation: ProfileNavigation,
  item: HydratedProfileOpinion,
) {
  const target = getProfileOpinionTarget(item, {
    contentTitle: item.contentTitle,
    seriesTitle: item.seriesTitle,
  });

  if (target.name === 'FilmDetail') {
    navigation.navigate(target.name, target.params);
  } else {
    navigation.navigate(target.name, target.params);
  }
}

async function hydrateProfileOpinion(
  item: ProfileOpinion,
  loadSeries: (tmdbId: number) => Promise<{ title: string }>,
  previous?: HydratedProfileOpinion,
): Promise<HydratedProfileOpinion | null> {
  if (item.content.contentType === 'movie') {
    try {
      const response = await withTimeout(getMovieDetails(item.content.tmdbId), 2500);
      return { ...item, contentImageUrl: response.item.posterUrl, contentSubtitle: 'Movie', contentTitle: response.item.title, seriesTitle: null };
    } catch {
      return previous ? { ...previous, ...item } : fallbackOpinion(item);
    }
  }
  try {
    const [episodeResponse, series] = await Promise.all([
      withTimeout(
        getEpisodeDetails(item.content.seriesTmdbId, item.content.seasonNumber, item.content.episodeNumber),
        2500,
      ),
      loadSeries(item.content.seriesTmdbId),
    ]);
    return {
      ...item,
      contentImageUrl: episodeResponse.item.stillUrl,
      contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
      contentTitle: episodeResponse.item.title,
      seriesTitle: series.title,
    };
  } catch {
    return hasRealSeriesTitle(previous) ? { ...previous, ...item } : null;
  }
}

async function hydrateProfileOpinionTitle(
  item: ProfileOpinion,
  previous: HydratedProfileOpinion | undefined,
  loadSeries: (tmdbId: number) => Promise<{ title: string }>,
): Promise<HydratedProfileOpinion | null> {
  if (item.content.contentType === 'movie') {
    return previous ? { ...previous, ...item } : fallbackOpinion(item);
  }

  try {
    const series = await loadSeries(item.content.seriesTmdbId);
    return {
      ...item,
      contentImageUrl: previous?.contentImageUrl ?? null,
      contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
      contentTitle: previous?.contentTitle ?? `Episode ${item.content.episodeNumber}`,
      seriesTitle: series.title,
    };
  } catch {
    return hasRealSeriesTitle(previous) ? { ...previous, ...item } : null;
  }
}

function isSameOpinion(previous: HydratedProfileOpinion, current: ProfileOpinion) {
  return previous.id === current.id;
}

function fallbackOpinion(item: ProfileOpinion): HydratedProfileOpinion {
  if (item.content.contentType === 'movie') {
    return { ...item, contentImageUrl: null, contentSubtitle: 'Movie', contentTitle: `Movie ${item.content.tmdbId}`, seriesTitle: null };
  }
  return {
    ...item,
    contentImageUrl: null,
    contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
    contentTitle: `Episode ${item.content.episodeNumber}`,
    seriesTitle: null,
  };
}

function hasRealSeriesTitle(
  item: HydratedProfileOpinion | undefined,
): item is HydratedProfileOpinion & { seriesTitle: string } {
  return Boolean(
    item?.seriesTitle?.trim() && !/^Series\s+\d+$/i.test(item.seriesTitle.trim()),
  );
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Catalogue enrichment timed out.')), timeoutMs);
    promise.then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
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
  errorText: {
    ...typography.meta,
    color: colors.danger,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  opinionList: {
    gap: 0,
  },
  opinionsSection: {
    gap: spacing.md,
  },
  recentPosterArtwork: {
    height: 174,
    width: 116,
  },
  recentPosterCard: {
    width: 116,
  },
  recentPosterKind: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
  },
  recentPosterMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  recentPosterTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: spacing.sm,
    minHeight: 36,
  },
  recentRail: {
    gap: spacing.md,
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
  stack: {
    gap: spacing.xxxl,
  },
  subtitle: {
    ...typography.meta,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
});
