import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Ban, ChevronLeft, Ellipsis, Flag, Lock, Share2 } from 'lucide-react-native';
import {
  blockUser,
  type BlockState,
  getBlockState,
  unblockUser,
} from '../api/blocks';
import { ApiError } from '../api/client';
import {
  followUser,
  type FollowState,
  getFollowState,
  unfollowUser,
} from '../api/follows';
import {
  getOwnPublicProfilePreview,
  getPublicProfile,
  type PublicProfile,
} from '../api/profile';
import type { ReportTarget } from '../api/reports';
import type { ViewingStats } from '../api/viewings';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { BottomActionSheet } from '../components/BottomActionSheet';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { Screen } from '../components/Screen';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { mergeLibraryItems, shouldShowTrackedTitle } from '../library/libraryModel';
import type { RootStackParamList } from '../navigation/types';
import { ReportSheet } from '../reports/ReportSheet';
import { getHydratedProfileOpinionTarget, ProfileBody } from './ProfileBody';
import { ProfileHeaderButton } from './ProfileHeaderButton';
import { ProfileSummaryCard } from './ProfileSummaryCard';
import {
  dedupeProfileMediaItems,
  getProfileMediaPreviews,
} from './profileMediaModel';
import {
  hydrateProfileOpinions,
  type HydratedProfileOpinion,
} from './profileOpinionHydration';
import { hydrateViewingStatsArtwork } from './hydrateViewingStatsArtwork';
import { useHydratedProfileMediaItems } from './useHydratedProfileMediaItems';
import { useProfileBackdropArtwork } from './useProfileBackdropArtwork';

type PublicProfileRoute = RouteProp<RootStackParamList, 'PublicProfile'>;
type PublicProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
type LoadStatus = 'blocked' | 'error' | 'loading' | 'ready' | 'unavailable';
type HydratedPublicProfile = Omit<PublicProfile, 'opinions' | 'viewingStats'> & {
  opinions: HydratedProfileOpinion[];
  viewingStats: ViewingStats | null;
};
type PublicProfilePreview = NonNullable<RootStackParamList['PublicProfile']['profilePreview']>;

const EMPTY_MEDIA_ITEMS: LibraryMediaItem[] = [];

export function PublicProfileScreen() {
  const { firebaseIdToken, notifySocialChanged } = useAuthSession();
  const { refreshMovie, refreshSeries } = useCatalogueCache();
  const navigation = useNavigation<PublicProfileNavigation>();
  const route = useRoute<PublicProfileRoute>();
  const isOwnPreview = Boolean(route.params.previewOwnProfile);
  const [blockState, setBlockState] = useState<BlockState | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [followersCountOverride, setFollowersCountOverride] = useState<number | null>(null);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<HydratedPublicProfile | null>(null);
  const [profileSnapshot, setProfileSnapshot] = useState<PublicProfile | null>(null);
  const [profileActionsOpen, setProfileActionsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const firebaseIdTokenRef = useRef(firebaseIdToken);
  const followMutationRef = useRef(false);
  const profileRef = useRef<HydratedPublicProfile | null>(null);
  firebaseIdTokenRef.current = firebaseIdToken;
  profileRef.current = profile;
  const isSignedIn = Boolean(firebaseIdToken);

  const hydrateLoadedProfile = useCallback(async (
    loadedProfile: PublicProfile,
  ): Promise<HydratedPublicProfile> => {
    if (!loadedProfile.canViewContent || !loadedProfile.viewingStats) {
      return { ...loadedProfile, opinions: [], viewingStats: null };
    }

    const [opinions, viewingStats] = await Promise.all([
      hydrateProfileOpinions(loadedProfile.opinions, refreshSeries),
      hydrateViewingStatsArtwork(loadedProfile.viewingStats, refreshMovie, refreshSeries),
    ]);

    return { ...loadedProfile, opinions, viewingStats };
  }, [refreshMovie, refreshSeries]);

  useEffect(() => {
    let isMounted = true;

    if (!isSignedIn) {
      setStatus('error');
      setMessage('Sign in before viewing profiles.');
      return;
    }

    const expectedUserId = route.params.userId;
    const hasVisibleProfile = profileRef.current?.id === expectedUserId;

    if (!hasVisibleProfile) {
      profileRef.current = null;
      setProfile(null);
      setProfileSnapshot(null);
      setBlockState(null);
      setFollowState(null);
      setStatus('loading');
      setMessage(null);
    }

    async function loadProfile() {
      const requestToken = firebaseIdTokenRef.current;
      if (!requestToken) return;

      const blockStatePromise = isOwnPreview
        ? Promise.resolve(null)
        : getBlockState(requestToken, expectedUserId);
      const followStatePromise = isOwnPreview
        ? Promise.resolve(null)
        : getFollowState(requestToken, expectedUserId);
      const profilePromise = isOwnPreview
        ? getOwnPublicProfilePreview(requestToken)
        : getPublicProfile(requestToken, expectedUserId);
      const [blockResult, followResult, profileResult] = await Promise.allSettled([
        blockStatePromise,
        followStatePromise,
        profilePromise,
      ] as const);

      if (!isMounted) return;
      const nextBlockState = blockResult.status === 'fulfilled' ? blockResult.value : null;
      if (nextBlockState) {
        setBlockState(nextBlockState);
      }
      if (nextBlockState?.blocked) {
        setFollowState({
          followedAt: null,
          following: false,
          status: 'none',
          userId: expectedUserId,
        });
        profileRef.current = null;
        setProfile(null);
        setProfileSnapshot(null);
        setStatus('blocked');
        return;
      }
      if (profileResult.status === 'rejected') {
        throw profileResult.reason;
      }

      const loadedProfile = profileResult.value;
      setProfileSnapshot(loadedProfile);
      setFollowersCountOverride(null);
      if (followResult.status === 'fulfilled' && followResult.value) {
        setFollowState(followResult.value);
      }

      const nextProfile = await hydrateLoadedProfile(loadedProfile);
      if (!isMounted) return;
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      setStatus('ready');
    }

    void loadProfile().catch((error) => {
      if (!isMounted) return;

      if (profileRef.current?.id === expectedUserId) {
        return;
      }

      if (error instanceof ApiError && error.status === 403) {
        setStatus('unavailable');
        setMessage(error.serverMessage ?? 'A blocking rule prevents this profile from being shown.');
        return;
      }

      setStatus('error');
      setMessage(error instanceof ApiError ? error.message : 'Could not load this profile.');
    });

    return () => {
      isMounted = false;
    };
  }, [hydrateLoadedProfile, isOwnPreview, isSignedIn, route.params.userId]);

  const mediaItems = useMemo(() => {
    if (!profile?.canViewContent) return EMPTY_MEDIA_ITEMS;

    return mergeLibraryItems(
      profile.media.trackingStates,
      profile.media.movieRatings,
      profile.media.seriesProgress,
      profile.media.releaseAlerts,
    )
      .filter(shouldShowTrackedTitle)
      .map(toLibraryMediaFallback);
  }, [profile]);
  const previews = useMemo(() => getProfileMediaPreviews(mediaItems), [mediaItems]);
  const previewSources = useMemo(() => dedupeProfileMediaItems([
    ...previews.series,
    ...previews.movies,
    ...previews.favorites,
  ]), [previews]);
  const hydratedPreviewItems = useHydratedProfileMediaItems(previewSources);
  const hydratedPreviewByKey = useMemo(
    () => new Map(hydratedPreviewItems.map((item) => [item.key, item])),
    [hydratedPreviewItems],
  );
  const hydratedPreviews = useMemo(() => ({
    favorites: previews.favorites.map((item) => hydratedPreviewByKey.get(item.key) ?? item),
    movies: previews.movies.map((item) => hydratedPreviewByKey.get(item.key) ?? item),
    series: previews.series.map((item) => hydratedPreviewByKey.get(item.key) ?? item),
  }), [hydratedPreviewByKey, previews]);
  const selectedBackdropUrl = useProfileBackdropArtwork(profile?.profileBackdrop ?? null);
  const automaticBackdropItem = hydratedPreviews.series[0]
    ?? hydratedPreviews.movies[0]
    ?? hydratedPreviews.favorites[0];
  const atmosphereUrl = selectedBackdropUrl
    ?? profile?.viewingStats?.highlights[0]?.artworkUrl
    ?? automaticBackdropItem?.backdropUrl
    ?? automaticBackdropItem?.posterUrl
    ?? profile?.opinions[0]?.contentImageUrl
    ?? null;
  const activeProfile = profile ?? profileSnapshot;
  const followersCount = followersCountOverride ?? activeProfile?.stats.followersCount ?? 0;

  async function toggleBlock() {
    if (!firebaseIdToken || isOwnPreview || isUpdatingBlock || followMutationRef.current) return;

    setIsUpdatingBlock(true);
    setMessage(null);

    try {
      const nextBlockState = blockState?.blocked
        ? await unblockUser(firebaseIdToken, route.params.userId)
        : await blockUser(firebaseIdToken, route.params.userId);

      setBlockState(nextBlockState);
      notifySocialChanged();

      if (nextBlockState.blocked) {
        setFollowState({
          followedAt: null,
          following: false,
          status: 'none',
          userId: route.params.userId,
        });
        setFollowersCountOverride(null);
        profileRef.current = null;
        setProfile(null);
        setProfileSnapshot(null);
        setStatus('blocked');
        return;
      }

      const [loadedProfile, nextFollowState] = await Promise.all([
        getPublicProfile(firebaseIdToken, route.params.userId),
        getFollowState(firebaseIdToken, route.params.userId),
      ]);

      setFollowState(nextFollowState);
      setProfileSnapshot(loadedProfile);
      const nextProfile = await hydrateLoadedProfile(loadedProfile);
      profileRef.current = nextProfile;
      setProfile(nextProfile);
      setFollowersCountOverride(null);
      setStatus('ready');
    } catch {
      setMessage('Could not update blocking.');
    } finally {
      setIsUpdatingBlock(false);
    }
  }

  async function toggleFollow() {
    if (
      !firebaseIdToken
      || !followState
      || isOwnPreview
      || isUpdatingBlock
      || followMutationRef.current
    ) return;

    const previousFollowState = followState;
    const previousProfile = profile;
    const previousFollowersCountOverride = followersCountOverride;
    const isRemovingFollow = followState.status === 'following' || followState.status === 'pending';
    const optimisticStatus = isRemovingFollow
      ? 'none'
      : activeProfile?.profileVisibility === 'private'
        ? 'pending'
        : 'following';
    const optimisticFollowState: FollowState = {
      followedAt: optimisticStatus === 'none' ? null : new Date().toISOString(),
      following: optimisticStatus === 'following',
      status: optimisticStatus,
      userId: route.params.userId,
    };
    const followerCountDelta = Number(optimisticStatus === 'following')
      - Number(followState.status === 'following');

    followMutationRef.current = true;
    setMessage(null);
    setFollowState(optimisticFollowState);
    if (followerCountDelta !== 0) {
      setFollowersCountOverride(Math.max(0, followersCount + followerCountDelta));
    }

    if (
      isRemovingFollow
      && followState.status === 'following'
      && profile?.profileVisibility === 'private'
    ) {
      const restrictedProfile: HydratedPublicProfile = {
        ...profile,
        canViewContent: false,
        media: {
          movieRatings: [],
          releaseAlerts: [],
          seriesProgress: [],
          trackingStates: [],
        },
        opinions: [],
        profileBackdrop: null,
        stats: { ...profile.stats, postsCount: 0, reviewsCount: 0 },
        viewingStats: null,
        watchlists: [],
      };
      profileRef.current = restrictedProfile;
      setProfile(restrictedProfile);
    }

    try {
      const nextFollowState = isRemovingFollow
        ? await unfollowUser(firebaseIdToken, route.params.userId)
        : await followUser(firebaseIdToken, route.params.userId);

      if (nextFollowState.status !== optimisticStatus) {
        setFollowState(nextFollowState);
        setFollowersCountOverride(null);
      }
      notifySocialChanged();
    } catch {
      setFollowState(previousFollowState);
      setFollowersCountOverride(previousFollowersCountOverride);
      profileRef.current = previousProfile;
      setProfile(previousProfile);
      setMessage('Could not update follow state.');
    } finally {
      followMutationRef.current = false;
    }
  }

  const shareProfile = useCallback(async () => {
    if (!profile) return;

    setShareError(null);

    try {
      await Share.share({
        message: `See ${profile.displayName?.trim() || 'this member'}'s profile on Watchly.`,
      });
    } catch (error) {
      setShareError(error instanceof Error ? error.message : 'Could not share this profile.');
    }
  }, [profile]);

  const followButton = !isOwnPreview && followState ? (
    <Button
      accessibilityHint={followState.status === 'pending' ? 'Cancels your follow request.' : undefined}
      disabled={isUpdatingBlock}
      fullWidth
      label={
        followState.status === 'following'
          ? 'Following'
          : followState.status === 'pending'
            ? 'Request sent'
            : 'Follow profile'
      }
      onPress={toggleFollow}
      variant={followState.status === 'none' ? 'primary' : 'secondary'}
    />
  ) : null;

  const backButton = (
    <ProfileHeaderButton accessibilityLabel="Back to Explore" onPress={() => navigation.goBack()}>
      <ChevronLeft color={colors.text} size={30} strokeWidth={2} />
    </ProfileHeaderButton>
  );

  if (!firebaseIdToken) {
    return (
      <Screen leading={backButton} tabBarPadding title="">
        <SignInRequiredCard
          body="You need to be signed in to view profiles and follow people. Sign in here to continue."
          title="Sign in to view profiles"
        />
      </Screen>
    );
  }

  return (
    <Screen
      background={atmosphereUrl ? <SpotlightAtmosphere fadeIn imageUrl={atmosphereUrl} /> : null}
      leading={backButton}
      tabBarPadding
      title=""
      trailing={profile ? (
        <View style={styles.headerActions}>
          {profile.canViewContent ? (
            <ProfileHeaderButton accessibilityLabel="Share profile" onPress={shareProfile}>
              <Share2 color={colors.text} size={27} strokeWidth={1.9} />
            </ProfileHeaderButton>
          ) : null}
          {!isOwnPreview ? (
            <ProfileHeaderButton
              accessibilityLabel="More profile actions"
              disabled={isUpdatingBlock}
              onPress={() => setProfileActionsOpen(true)}
            >
              <Ellipsis color={colors.text} size={28} strokeWidth={2} />
            </ProfileHeaderButton>
          ) : null}
        </View>
      ) : undefined}
    >
      {status === 'loading' && !profile ? (
        <PublicProfileLoadingState
          identityAction={followButton}
          isOwnPreview={isOwnPreview}
          preview={route.params.profilePreview}
          profile={profileSnapshot}
        />
      ) : null}

      {status === 'unavailable' ? (
        <EmptyState
          body={message ?? 'A safety rule prevents this profile from being shown.'}
          title="Profile unavailable"
        />
      ) : null}

      {status === 'blocked' ? (
        <View style={styles.card}>
          <Text style={styles.name}>Blocked profile</Text>
          <Text style={styles.body}>This profile is hidden because you blocked this user.</Text>
          <Button
            disabled={isUpdatingBlock}
            label={isUpdatingBlock ? 'Updating...' : 'Unblock profile'}
            onPress={toggleBlock}
            variant="secondary"
          />
          <Button
            icon={<Flag color={colors.textMuted} size={17} strokeWidth={2} />}
            label="Report profile"
            onPress={() => setReportTarget({
              id: route.params.userId,
              label: 'Blocked profile',
              type: 'profile',
            })}
            variant="ghost"
          />
          {message ? <Text style={styles.errorText}>{message}</Text> : null}
        </View>
      ) : null}

      {status === 'error' && !profile ? (
        <EmptyState body={message ?? 'Try again later.'} title="Profile unavailable" />
      ) : null}

      {profile && status !== 'blocked' && status !== 'unavailable' ? (
        !profile.canViewContent ? (
          <View style={styles.privateState}>
            <View style={styles.privateIdentity}>
              <ProfileSummaryCard
                avatarUrl={profile.avatarUrl}
                displayName={profile.displayName}
                followersCount={followersCount}
                followingCount={profile.stats.followingCount}
                handle={profile.handle}
                reviewsCount={0}
              />
              {followButton}
            </View>
            <View style={styles.privateNotice}>
              <View style={styles.privateNoticeHeader}>
                <Lock color={colors.accent} size={20} strokeWidth={2} />
                <Text style={styles.privateTitle}>This profile is private</Text>
              </View>
              <Text style={styles.body}>
                {isOwnPreview
                  ? 'Other members can see this profile header and send a follow request. You choose who can see the rest.'
                  : 'Follow this member to request access to their series, movies, ratings, and viewing activity.'}
              </Text>
            </View>
            {message ? <Text style={styles.errorText}>{message}</Text> : null}
          </View>
        ) : profile.viewingStats ? (
          <View style={styles.stack}>
            <ProfileBody
              avatarUrl={profile.avatarUrl}
              displayName={profile.displayName}
              emptyActivityBody="Ratings and reviews will appear here when this member shares them."
              emptyActivityTitle="No public activity yet."
              followersCount={followersCount}
              followingCount={profile.stats.followingCount}
              handle={profile.handle}
              identityAction={followButton}
              mediaEmptyLabels={{
                favorites: 'No favorites yet.',
                movies: 'No movies to show yet.',
                series: 'No series to show yet.',
              }}
              mediaPreviews={hydratedPreviews}
              notice={message || shareError ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>
                  {message ?? shareError}
                </Text>
              ) : undefined}
              onOpenMediaItem={(item) => openProfileMediaItem(navigation, item)}
              onOpenOpinion={(item) => openOpinion(navigation, item)}
              onOpenStats={() => navigation.navigate('AllTimeStats', {
                profileBackdropUrl: atmosphereUrl,
                stats: profile.viewingStats ?? undefined,
              })}
              onViewAllMedia={(filter) => navigation.navigate('ProfileMedia', {
                filter,
                items: mediaItems,
                profileBackdropUrl: atmosphereUrl,
              })}
              opinions={profile.opinions}
              stats={profile.viewingStats}
              statsAccessibilityHint="Opens this member's complete all-time viewing statistics."
            />
          </View>
        ) : null
      ) : null}

      <BottomActionSheet
        onClose={() => setProfileActionsOpen(false)}
        title="Profile actions"
        visible={profileActionsOpen}
      >
        <View style={styles.profileActions}>
          <Button
            accessibilityHint="Blocks this member and hides their profile."
            disabled={isUpdatingBlock}
            fullWidth
            icon={<Ban color={colors.danger} size={19} strokeWidth={2} />}
            label={isUpdatingBlock ? 'Updating...' : 'Block profile'}
            onPress={() => {
              setProfileActionsOpen(false);
              void toggleBlock();
            }}
            variant="danger"
          />
          <Button
            accessibilityHint="Opens the private profile report form."
            fullWidth
            icon={<Flag color={colors.textMuted} size={19} strokeWidth={2} />}
            label="Report profile"
            onPress={() => {
              setProfileActionsOpen(false);
              setReportTarget({
                id: route.params.userId,
                label: profile?.displayName?.trim() || 'Watchly member',
                type: 'profile',
              });
            }}
            variant="secondary"
          />
        </View>
      </BottomActionSheet>
      <ReportSheet onClose={() => setReportTarget(null)} target={reportTarget} />
    </Screen>
  );
}

function PublicProfileLoadingState({
  identityAction,
  isOwnPreview,
  preview,
  profile,
}: {
  identityAction: ReactNode;
  isOwnPreview: boolean;
  preview?: PublicProfilePreview;
  profile: PublicProfile | null;
}) {
  const identity = profile ?? preview;

  return (
    <View style={styles.loadingStack}>
      {identity ? (
        <ProfileSummaryCard
          avatarUrl={identity.avatarUrl}
          displayName={identity.displayName}
          followersCount={profile?.stats.followersCount ?? 0}
          followingCount={profile?.stats.followingCount ?? 0}
          handle={identity.handle}
          reviewsCount={0}
          socialStatsLoading={!profile}
        />
      ) : (
        <View importantForAccessibility="no-hide-descendants" style={styles.skeletonIdentity}>
          <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
          <View style={styles.skeletonIdentityCopy}>
            <View style={[styles.skeletonBlock, styles.skeletonName]} />
            <View style={[styles.skeletonBlock, styles.skeletonHandle]} />
            <View style={[styles.skeletonBlock, styles.skeletonSocial]} />
          </View>
        </View>
      )}

      {identityAction ?? (!isOwnPreview ? (
        <View
          importantForAccessibility="no-hide-descendants"
          style={[styles.skeletonBlock, styles.skeletonButton]}
        />
      ) : null)}

      <View
        accessibilityLabel="Loading profile details"
        accessibilityLiveRegion="polite"
        accessibilityRole="progressbar"
      >
        <View importantForAccessibility="no-hide-descendants" style={styles.skeletonDetails}>
          <View style={styles.skeletonDivider} />
          <View style={styles.skeletonStatsRow}>
            {[0, 1, 2].map((item) => (
              <View key={item} style={styles.skeletonStat}>
                <View style={[styles.skeletonBlock, styles.skeletonStatValue]} />
                <View style={[styles.skeletonBlock, styles.skeletonStatLabel]} />
              </View>
            ))}
          </View>
          <View style={styles.skeletonDivider} />
          {['Series', 'Movies', 'Favorites'].map((title) => (
            <View key={title} style={styles.skeletonRailSection}>
              <View style={styles.skeletonRailHeader}>
                <Text style={styles.skeletonRailTitle}>{title}</Text>
                <View style={[styles.skeletonBlock, styles.skeletonViewAll]} />
              </View>
              <View style={styles.skeletonPosterRail}>
                {[0, 1, 2].map((item) => (
                  <View key={item} style={styles.skeletonPosterCard}>
                    <View style={[styles.skeletonBlock, styles.skeletonPoster]} />
                    <View style={[styles.skeletonBlock, styles.skeletonPosterTitle]} />
                    <View style={[styles.skeletonBlock, styles.skeletonPosterMeta]} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function toLibraryMediaFallback(item: ReturnType<typeof mergeLibraryItems>[number]): LibraryMediaItem {
  return {
    ...item,
    backdropUrl: null,
    numberOfEpisodes: null,
    posterUrl: null,
    title: `TMDB ${item.tmdbId}`,
  };
}

function openProfileMediaItem(
  navigation: PublicProfileNavigation,
  item: LibraryMediaItem,
) {
  if (item.contentType === 'movie') {
    navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
  } else {
    navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  }
}

function openOpinion(
  navigation: PublicProfileNavigation,
  item: HydratedProfileOpinion,
) {
  const target = getHydratedProfileOpinionTarget(item);

  if (target.name === 'FilmDetail') {
    navigation.navigate(target.name, target.params);
  } else {
    navigation.navigate(target.name, target.params);
  }
}

const styles = StyleSheet.create({
  body: {
    ...typography.body,
    color: colors.muted,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  errorText: {
    ...typography.body,
    color: colors.danger,
    textAlign: 'center',
  },
  headerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loadingStack: {
    gap: spacing.xl,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  privateState: {
    gap: spacing.xxl,
    paddingTop: spacing.xl,
  },
  privateIdentity: {
    gap: spacing.xl,
  },
  privateNotice: {
    borderBottomColor: colors.borderStrong,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  privateNoticeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  privateTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  profileActions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  stack: {
    gap: spacing.xxl,
  },
  skeletonAvatar: {
    borderRadius: 42,
    height: 84,
    width: 84,
  },
  skeletonBlock: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skeletonButton: {
    borderRadius: radii.md,
    height: 48,
    width: '100%',
  },
  skeletonDetails: {
    gap: spacing.xl,
  },
  skeletonDivider: {
    backgroundColor: colors.accentBorder,
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  skeletonHandle: {
    borderRadius: 4,
    height: 12,
    width: '42%',
  },
  skeletonIdentity: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  skeletonIdentityCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  skeletonName: {
    borderRadius: radii.xs,
    height: 28,
    width: '72%',
  },
  skeletonPoster: {
    borderRadius: radii.md,
    height: 156,
    width: 104,
  },
  skeletonPosterCard: {
    gap: spacing.xs,
    width: 104,
  },
  skeletonPosterMeta: {
    borderRadius: 3,
    height: 9,
    width: 60,
  },
  skeletonPosterRail: {
    flexDirection: 'row',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  skeletonPosterTitle: {
    borderRadius: 3,
    height: 12,
    width: 88,
  },
  skeletonRailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonRailSection: {
    gap: spacing.sm,
  },
  skeletonRailTitle: {
    ...typography.title,
    color: colors.text,
  },
  skeletonSocial: {
    borderRadius: 4,
    height: 12,
    width: '58%',
  },
  skeletonStat: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  skeletonStatLabel: {
    borderRadius: 3,
    height: 9,
    width: 62,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  skeletonStatValue: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.xs,
    height: 22,
    width: 46,
  },
  skeletonViewAll: {
    borderRadius: 4,
    height: 11,
    width: 50,
  },
});
