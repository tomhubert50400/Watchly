import { memo, useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RefreshControl, Share, StyleSheet, Text, View, Pressable } from 'react-native';
import { Settings, Share2 } from 'lucide-react-native';
import { getEpisodeDetails, getMovieDetails } from '../api/catalogue';
import {
  getOwnProfileOpinions,
  getProfile,
  type ProfileOpinion,
} from '../api/profile';
import { useAuthSession } from '../auth/AuthSessionContext';
import { ProfileAuthCard } from '../auth/ProfileAuthCard';
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
import { colors, spacing, typography } from '../design/tokens';
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
    const opinions = await Promise.all(model.opinions.map((opinion, index) => {
      const previous = cached?.opinions.find((candidate) => isSameOpinion(candidate, opinion));
      return index < MAX_PROFILE_OPINION_HYDRATIONS
        ? hydrateProfileOpinion(opinion, previous)
        : Promise.resolve(previous ? { ...previous, ...opinion } : fallbackOpinion(opinion));
    }));

    return { ...model, opinions };
  }, [getFirebaseIdToken, socialRevision, trackingRevision]);
  const resource = useCachedResource<CachedProfile>({
    enabled: Boolean(firebaseIdToken && userId),
    key: userId ? getPrivateCacheKey(userId, 'profile:public-activity:v2') : 'watchly:user:disabled:profile',
    load: loadProfile,
  });
  const profile = resource.data;

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
      <Screen horizontalPadding={false} tabBarPadding title="Profile">
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
      tabBarPadding
      title="Profile"
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
        <LoadingState label="Loading your public profile" />
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
            isPublic={profile.isPublic}
            onEdit={() => navigation.navigate('Settings')}
            onShare={shareProfile}
            ratingsCount={profile.stats.ratingsCount}
            reviewsCount={profile.stats.reviewsCount}
          />
          {shareError ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{shareError}</Text> : null}
          <View style={styles.opinionsSection}>
            <SectionHeader
              subtitle="Ratings use raspberry; written reviews stay neutral."
              title="Public opinions"
            />
            {profile.opinions.length === 0 ? (
              <EmptyState
                body="Publish a rating or review from your privacy settings to see it here. Your Journal remains in Library."
                title="No public opinions yet"
              >
                <Button label="Review privacy settings" onPress={() => navigation.navigate('Settings')} variant="secondary" />
              </EmptyState>
            ) : (
              <View style={styles.opinionList}>
                {profile.opinions.map((item) => (
                  <ProfileOpinionCard
                    item={item}
                    key={`${item.type}-${item.id}`}
                    onOpenContent={(opinion) => openOpinion(navigation, opinion)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const ProfileOpinionCard = memo(function ProfileOpinionCard({ item, onOpenContent }: {
  item: HydratedProfileOpinion;
  onOpenContent: (item: HydratedProfileOpinion) => void;
}) {
  const review = isReview(item);
  const contentTitle = item.content.contentType === 'episode'
    ? item.seriesTitle ?? `Series ${item.content.seriesTmdbId}`
    : item.contentTitle;

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Open ${item.contentTitle}`}
        accessibilityRole="button"
        onPress={() => onOpenContent(item)}
        style={({ pressed }) => [styles.mediaLink, pressed ? styles.cardPressed : null]}
      >
        <MediaPoster
          accessibilityLabel={`${item.contentTitle} artwork`}
          posterUrl={item.contentImageUrl}
          style={styles.poster}
        />
        <View style={styles.cardCopy}>
          <View style={styles.metaRow}>
            <Text style={[styles.kind, review ? styles.reviewKind : styles.ratingKind]}>
              {review ? 'Review' : 'Rating'}
            </Text>
            <Text style={styles.date}>{formatDate(item.updatedAt)}</Text>
          </View>
          <Text numberOfLines={2} style={styles.contentTitle}>{contentTitle}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{item.contentSubtitle}</Text>
          <StarRatingDisplay rating={item.score} showValue size={17} />
        </View>
      </Pressable>
      {review ? <ExpandableReviewText body={item.body} style={styles.review} /> : null}
    </View>
  );
});

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
  previous?: HydratedProfileOpinion,
): Promise<HydratedProfileOpinion> {
  if (item.content.contentType === 'movie') {
    try {
      const response = await withTimeout(getMovieDetails(item.content.tmdbId), 2500);
      return { ...item, contentImageUrl: response.item.posterUrl, contentSubtitle: 'Movie', contentTitle: response.item.title, seriesTitle: null };
    } catch {
      return previous ? { ...previous, ...item } : fallbackOpinion(item);
    }
  }
  try {
    const response = await withTimeout(
      getEpisodeDetails(item.content.seriesTmdbId, item.content.seasonNumber, item.content.episodeNumber),
      2500,
    );
    return {
      ...item,
      contentImageUrl: response.item.stillUrl,
      contentSubtitle: `Season ${item.content.seasonNumber} · Episode ${item.content.episodeNumber}`,
      contentTitle: response.item.title,
      seriesTitle: `Series ${item.content.seriesTmdbId}`,
    };
  } catch {
    return previous ? { ...previous, ...item } : fallbackOpinion(item);
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
    seriesTitle: `Series ${item.content.seriesTmdbId}`,
  };
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
  card: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  cardCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  cardPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  contentTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  date: {
    ...typography.meta,
    color: colors.textSubtle,
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
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  kind: {
    ...typography.meta,
    textTransform: 'uppercase',
  },
  mediaLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  opinionList: {
    gap: 0,
  },
  opinionsSection: {
    gap: spacing.sm,
  },
  poster: {
    height: 102,
    width: 68,
  },
  ratingKind: {
    color: colors.ratingText,
  },
  review: {
    marginTop: spacing.xs,
  },
  reviewKind: {
    color: colors.textSubtle,
  },
  stack: {
    gap: spacing.lg,
  },
  subtitle: {
    ...typography.meta,
    color: colors.textSubtle,
    marginBottom: spacing.sm,
    marginTop: 2,
  },
});
