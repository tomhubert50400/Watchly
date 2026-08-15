import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Alert, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { Image as ImageIcon, Settings, Share2 } from 'lucide-react-native';
import { getMovieDetails, type SeriesDetails } from '../api/catalogue';
import {
  getOwnProfileOpinions,
  getProfile,
  removeAvatar,
  updateProfileBackdrop,
  type ProfileBackdropSelection,
} from '../api/profile';
import { getViewingStats, type ViewingStats } from '../api/viewings';
import { useAuthSession, useSocialRevision } from '../auth/AuthSessionContext';
import { ProfileAuthCard } from '../auth/ProfileAuthCard';
import { BrandWordmark } from '../brand/BrandWordmark';
import { useCatalogueCache } from '../catalogue/CatalogueCacheContext';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { SpotlightAtmosphere } from '../components/SpotlightAtmosphere';
import { getPrivateCacheKey } from '../cache/persistedCache';
import { useCachedResource } from '../cache/useCachedResource';
import { colors, spacing, typography } from '../design/tokens';
import { hapticError, hapticSuccess } from '../feedback/haptics';
import type { LibraryMediaItem } from '../library/useLibraryData';
import { useLibraryData } from '../library/useLibraryData';
import { RootStackParamList } from '../navigation/types';
import {
  buildProfileModel,
  type ProfileModel,
} from './profileModel';
import { ProfileBackdropPickerSheet } from './ProfileBackdropPickerSheet';
import { getHydratedProfileOpinionTarget, ProfileBody } from './ProfileBody';
import { ProfileHeaderButton } from './ProfileHeaderButton';
import { hydrateViewingStatsArtwork } from './hydrateViewingStatsArtwork';
import {
  dedupeProfileMediaItems,
  getProfileMediaItems,
  getProfileMediaPreviews,
  isProfileBackdropCandidate,
} from './profileMediaModel';
import { chooseAndUploadProfileAvatar } from './uploadProfileAvatar';
import { useHydratedProfileMediaItems } from './useHydratedProfileMediaItems';
import { useProfileBackdropArtwork } from './useProfileBackdropArtwork';
import {
  hydrateProfileOpinions,
  type HydratedProfileOpinion,
} from './profileOpinionHydration';

type ProfileNavigation = NativeStackNavigationProp<RootStackParamList>;
export type CachedProfile = Omit<ProfileModel, 'opinions'> & {
  opinions: HydratedProfileOpinion[];
  viewingStats: ViewingStats;
};
const EMPTY_PROFILE_MEDIA_ITEMS: LibraryMediaItem[] = [];

export function getProfileResourceKey(userId: string) {
  return getPrivateCacheKey(userId, 'profile:owner-activity:v9');
}

export async function loadProfileData(
  token: string,
  loadSeries: (tmdbId: number) => Promise<SeriesDetails>,
  cached?: CachedProfile,
): Promise<CachedProfile> {
  const [profile, response, viewingStats] = await Promise.all([
    getProfile(token),
    getOwnProfileOpinions(token),
    getViewingStats(token),
  ]);
  const model = buildProfileModel(profile, response);
  const opinions = await hydrateProfileOpinions(model.opinions, loadSeries, cached?.opinions);
  const hydratedViewingStats = await hydrateViewingStatsArtwork(
    viewingStats,
    async (tmdbId) => (await getMovieDetails(tmdbId)).item,
    loadSeries,
  );

  return { ...model, opinions, viewingStats: hydratedViewingStats };
}

export function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigation>();
  const {
    currentUser,
    firebaseIdToken,
    notifySocialChanged,
    trackingRevision,
  } = useAuthSession();
  const socialRevision = useSocialRevision();
  const [avatarOverride, setAvatarOverride] = useState<string | null | undefined>(undefined);
  const [avatarStatus, setAvatarStatus] = useState<'idle' | 'saving'>('idle');
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [backdropOverride, setBackdropOverride] = useState<
    ProfileBackdropSelection | null | undefined
  >(undefined);
  const [backdropPickerOpen, setBackdropPickerOpen] = useState(false);
  const [backdropStatus, setBackdropStatus] = useState<'idle' | 'saving'>('idle');
  const [backdropError, setBackdropError] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const { refreshSeries } = useCatalogueCache();
  const userId = currentUser?.id ?? null;
  const loadProfile = useCallback(async (cached?: CachedProfile): Promise<CachedProfile> => {
    void socialRevision;
    void trackingRevision;
    if (!firebaseIdToken) {
      throw new Error('Your session expired. Sign in again to refresh your profile.');
    }

    return loadProfileData(firebaseIdToken, refreshSeries, cached);
  }, [firebaseIdToken, refreshSeries, socialRevision, trackingRevision]);
  const resource = useCachedResource<CachedProfile>({
    enabled: Boolean(firebaseIdToken && userId),
    key: getProfileResourceKey(userId ?? 'visitor'),
    load: loadProfile,
  });
  const mediaResource = useLibraryData();
  useFocusEffect(useCallback(() => {
    if (firebaseIdToken && userId) {
      resource.revalidate();
      mediaResource.revalidate();
    }
  }, [firebaseIdToken, mediaResource.revalidate, resource.revalidate, userId]));
  const profile = resource.data;
  const mediaItems = mediaResource.data?.items ?? EMPTY_PROFILE_MEDIA_ITEMS;
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
  const backdropCandidates = useMemo(() => dedupeProfileMediaItems([
    ...getProfileMediaItems(mediaItems, 'series'),
    ...getProfileMediaItems(mediaItems, 'movies'),
  ]).filter(isProfileBackdropCandidate), [mediaItems]);
  const backdropPickerSources = backdropPickerOpen
    ? backdropCandidates
    : EMPTY_PROFILE_MEDIA_ITEMS;
  const hydratedBackdropCandidates = useHydratedProfileMediaItems(backdropPickerSources);
  const profileBackdrop = backdropOverride === undefined
    ? profile?.profileBackdrop ?? null
    : backdropOverride;
  const selectedBackdropUrl = useProfileBackdropArtwork(profileBackdrop);
  const atmosphereUrl = selectedBackdropUrl
    ?? profile?.viewingStats.highlights[0]?.artworkUrl
    ?? hydratedPreviewItems[0]?.backdropUrl
    ?? hydratedPreviewItems[0]?.posterUrl
    ?? profile?.opinions[0]?.contentImageUrl
    ?? null;
  const avatarUrl = avatarOverride === undefined ? profile?.avatarUrl ?? null : avatarOverride;

  const changeAvatar = useCallback(async () => {
    if (!firebaseIdToken || avatarStatus === 'saving' || !profile?.avatarUploadsEnabled) return;

    setAvatarStatus('saving');
    setAvatarError(null);
    try {
      const updatedProfile = await chooseAndUploadProfileAvatar(firebaseIdToken);
      if (!updatedProfile) return;

      setAvatarOverride(updatedProfile.avatarUrl);
      notifySocialChanged();
      hapticSuccess();
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Could not update your profile photo.',
      );
      hapticError();
    } finally {
      setAvatarStatus('idle');
    }
  }, [avatarStatus, firebaseIdToken, notifySocialChanged, profile?.avatarUploadsEnabled]);

  const deleteAvatar = useCallback(async () => {
    if (!firebaseIdToken || avatarStatus === 'saving') return;

    setAvatarStatus('saving');
    setAvatarError(null);
    try {
      const updatedProfile = await removeAvatar(firebaseIdToken);
      setAvatarOverride(updatedProfile.avatarUrl);
      notifySocialChanged();
      hapticSuccess();
    } catch (error) {
      setAvatarError(
        error instanceof Error ? error.message : 'Could not remove your profile photo.',
      );
      hapticError();
    } finally {
      setAvatarStatus('idle');
    }
  }, [avatarStatus, firebaseIdToken, notifySocialChanged]);

  const openAvatarActions = useCallback(() => {
    if (!profile?.avatarUploadsEnabled || avatarStatus === 'saving') return;

    if (!avatarUrl) {
      void changeAvatar();
      return;
    }

    Alert.alert('Profile photo', 'Choose a new photo or return to your initials.', [
      { onPress: () => void changeAvatar(), text: 'Choose a new photo' },
      { onPress: () => void deleteAvatar(), style: 'destructive', text: 'Remove photo' },
      { style: 'cancel', text: 'Cancel' },
    ]);
  }, [avatarStatus, avatarUrl, changeAvatar, deleteAvatar, profile?.avatarUploadsEnabled]);

  const shareProfile = useCallback(async () => {
    if (!profile) return;
    setShareError(null);
    try {
      await Share.share({ message: `See ${profile.displayName}'s public ratings and reviews on Watchly.` });
    } catch {
      setShareError('Could not open sharing.');
    }
  }, [profile]);

  const selectProfileBackdrop = useCallback(async (
    selection: ProfileBackdropSelection | null,
  ) => {
    if (!firebaseIdToken || backdropStatus === 'saving') return;

    const previous = profileBackdrop;
    setBackdropOverride(selection);
    setBackdropStatus('saving');
    setBackdropError(null);
    try {
      const updatedProfile = await updateProfileBackdrop(firebaseIdToken, selection);
      setBackdropOverride(updatedProfile.profileBackdrop);
      setBackdropPickerOpen(false);
      hapticSuccess();
    } catch (error) {
      setBackdropOverride(previous);
      setBackdropError(
        error instanceof Error ? error.message : 'Could not update your profile background.',
      );
      hapticError();
    } finally {
      setBackdropStatus('idle');
    }
  }, [backdropStatus, firebaseIdToken, profileBackdrop]);

  if (!firebaseIdToken || !userId) {
    return (
      <Screen horizontalPadding={false} leading={<BrandWordmark height={36} />} tabBarPadding={spacing.md} title="">
        <ProfileAuthCard />
      </Screen>
    );
  }

  return (
    <Screen
      background={atmosphereUrl ? <SpotlightAtmosphere imageUrl={atmosphereUrl} /> : null}
      refreshControl={
        <RefreshControl
          colors={[colors.accent]}
          onRefresh={() => {
            resource.retry();
            mediaResource.retry();
          }}
          refreshing={resource.isRefreshing || mediaResource.isRefreshing}
          tintColor={colors.accent}
        />
      }
      leading={<BrandWordmark height={36} />}
      tabBarPadding
      title=""
      trailing={
        <View style={styles.headerActions}>
          <ProfileHeaderButton
            accessibilityLabel="Choose profile background"
            disabled={!profile}
            onPress={() => {
              setBackdropError(null);
              setBackdropPickerOpen(true);
            }}
          >
            <ImageIcon
              color={profileBackdrop ? colors.accentText : colors.text}
              size={26}
              strokeWidth={1.9}
            />
          </ProfileHeaderButton>
          <ProfileHeaderButton
            accessibilityLabel="Share profile"
            disabled={!profile}
            onPress={shareProfile}
          >
            <Share2 color={colors.text} size={27} strokeWidth={1.9} />
          </ProfileHeaderButton>
          <ProfileHeaderButton
            accessibilityLabel="Open settings"
            onPress={() => navigation.navigate('Settings')}
          >
            <Settings color={colors.text} size={28} strokeWidth={1.9} />
          </ProfileHeaderButton>
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
        <ProfileBody
          avatarLoading={avatarStatus === 'saving'}
          avatarUrl={avatarUrl}
          displayName={profile.displayName}
          emptyActivityAction={(
            <Button
              compact
              label="Manage privacy"
              onPress={() => navigation.navigate('Settings')}
              variant="secondary"
            />
          )}
          emptyActivityBody="Ratings and reviews stay visible to you here, whatever your privacy setting."
          emptyActivityTitle="Your first rating will live here."
          followersCount={profile.stats.followersCount}
          followingCount={profile.stats.followingCount}
          handle={profile.handle}
          mediaEmptyLabels={{
            favorites: 'No favorites yet.',
            movies: 'No movies to show yet.',
            series: 'No series to show yet.',
          }}
          mediaPreviews={hydratedPreviews}
          notice={(
            <>
              {avatarError ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{avatarError}</Text> : null}
              {backdropError && !backdropPickerOpen ? (
                <Text accessibilityLiveRegion="polite" style={styles.errorText}>{backdropError}</Text>
              ) : null}
              {shareError ? <Text accessibilityLiveRegion="polite" style={styles.errorText}>{shareError}</Text> : null}
            </>
          )}
          onAvatarPress={profile.avatarUploadsEnabled ? openAvatarActions : undefined}
          onFollowersPress={() => navigation.navigate('ProfileConnections', {
            kind: 'followers',
            userId: profile.userId,
          })}
          onFollowingPress={() => navigation.navigate('ProfileConnections', {
            kind: 'following',
            userId: profile.userId,
          })}
          onOpenMediaItem={(item) => openProfileMediaItem(navigation, item)}
          onOpenOpinion={(item) => openOpinion(navigation, item)}
          onOpenStats={() => navigation.navigate('AllTimeStats', { profileBackdropUrl: atmosphereUrl })}
          onViewAllMedia={(filter) => navigation.navigate('ProfileMedia', { filter })}
          opinions={profile.opinions}
          showMediaRails={Boolean(mediaResource.data)}
          stats={profile.viewingStats}
        />
      ) : null}
      <ProfileBackdropPickerSheet
        busy={backdropStatus === 'saving'}
        error={backdropError}
        items={hydratedBackdropCandidates}
        onClose={() => setBackdropPickerOpen(false)}
        onSelect={(selection) => void selectProfileBackdrop(selection)}
        selected={profileBackdrop}
        visible={backdropPickerOpen}
      />
    </Screen>
  );
}

function openProfileMediaItem(navigation: ProfileNavigation, item: LibraryMediaItem) {
  if (item.contentType === 'movie') {
    navigation.navigate('FilmDetail', { title: item.title, tmdbId: item.tmdbId });
  } else {
    navigation.navigate('SeriesDetail', { title: item.title, tmdbId: item.tmdbId });
  }
}

function openOpinion(
  navigation: ProfileNavigation,
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
  errorText: {
    ...typography.meta,
    color: colors.danger,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
});
