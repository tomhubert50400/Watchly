import { useEffect, useState } from 'react';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { ListVideo } from 'lucide-react-native';
import {
  blockUser,
  BlockState,
  getBlockState,
  unblockUser,
} from '../api/blocks';
import { ApiError } from '../api/client';
import {
  followUser,
  FollowState,
  getFollowState,
  unfollowUser,
} from '../api/follows';
import {
  getOwnPublicProfilePreview,
  getPublicProfile,
  PublicProfile,
} from '../api/profile';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { Screen } from '../components/Screen';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';
import { RootStackParamList } from '../navigation/types';
import { useAuthSession } from '../auth/AuthSessionContext';
import { SignInRequiredCard } from '../auth/SignInRequired';
import { ProfileSummaryCard } from './ProfileSummaryCard';

type PublicProfileRoute = RouteProp<RootStackParamList, 'PublicProfile'>;
type LoadStatus = 'blocked' | 'error' | 'loading' | 'ready' | 'unavailable';

export function PublicProfileScreen() {
  const { firebaseIdToken, notifySocialChanged } = useAuthSession();
  const route = useRoute<PublicProfileRoute>();
  const isOwnPreview = Boolean(route.params.previewOwnProfile);
  const [blockState, setBlockState] = useState<BlockState | null>(null);
  const [followState, setFollowState] = useState<FollowState | null>(null);
  const [isUpdatingBlock, setIsUpdatingBlock] = useState(false);
  const [isUpdatingFollow, setIsUpdatingFollow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let isMounted = true;

    if (!firebaseIdToken) {
      setStatus('error');
      setMessage('Sign in before viewing profiles.');
      return;
    }

    setStatus('loading');
    setMessage(null);

    async function loadProfile() {
      if (!firebaseIdToken) {
        return;
      }

      if (!isOwnPreview) {
        const nextBlockState = await getBlockState(firebaseIdToken, route.params.userId);

        if (!isMounted) {
          return;
        }

        setBlockState(nextBlockState);

        if (nextBlockState.blocked) {
          setFollowState({
            followedAt: null,
            following: false,
            status: 'none',
            userId: route.params.userId,
          });
          setStatus('blocked');
          return;
        }
      }

      const nextProfile = isOwnPreview
        ? await getOwnPublicProfilePreview(firebaseIdToken)
        : await getPublicProfile(firebaseIdToken, route.params.userId);

      if (!isMounted) {
        return;
      }

      setProfile(nextProfile);
      setStatus('ready');

      if (!isOwnPreview) {
        try {
          const nextFollowState = await getFollowState(firebaseIdToken, route.params.userId);

          if (!isMounted) {
            return;
          }

          setFollowState(nextFollowState);
        } catch {
          if (isMounted) {
            setMessage('Follow state could not load.');
          }
        }
      }
    }

    void loadProfile()
      .catch((error) => {
        if (!isMounted) {
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
  }, [firebaseIdToken, isOwnPreview, route.params.userId]);

  async function toggleBlock() {
    if (!firebaseIdToken || isOwnPreview || isUpdatingBlock) {
      return;
    }

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
        setStatus('blocked');
        return;
      }

      const nextProfile = await getPublicProfile(firebaseIdToken, route.params.userId);
      const nextFollowState = await getFollowState(firebaseIdToken, route.params.userId);

      setFollowState(nextFollowState);
      setProfile(nextProfile);
      setStatus('ready');
    } catch {
      setMessage('Could not update blocking.');
    } finally {
      setIsUpdatingBlock(false);
    }
  }

  async function toggleFollow() {
    if (!firebaseIdToken || isOwnPreview || isUpdatingFollow) {
      return;
    }

    setIsUpdatingFollow(true);
    setMessage(null);

    try {
      const nextFollowState = followState?.status === 'following' || followState?.status === 'pending'
        ? await unfollowUser(firebaseIdToken, route.params.userId)
        : await followUser(firebaseIdToken, route.params.userId);

      setFollowState(nextFollowState);
      notifySocialChanged();
    } catch {
      setMessage('Could not update follow state.');
    } finally {
      setIsUpdatingFollow(false);
    }
  }

  if (!firebaseIdToken) {
    return (
      <Screen eyebrow="Profile" title="">
        <SignInRequiredCard
          body="You need to be signed in to view profiles and follow people. Sign in here to continue."
          title="Sign in to view profiles"
        />
      </Screen>
    );
  }

  return (
    <Screen eyebrow="Profile" title="">
      {status === 'loading' ? (
        <LoadingState label="Loading profile" />
      ) : null}

      {status === 'unavailable' ? (
        <EmptyState
          body={message ?? 'A safety rule prevents this profile from being shown.'}
          title="Profile unavailable"
        />
      ) : null}

      {status === 'blocked' ? (
        <View style={styles.card}>
          <Chip label="Hidden" tone="neutral" />
          <Text style={styles.name}>Blocked profile</Text>
          <Text style={styles.body}>
            This profile is hidden because you blocked this user.
          </Text>
          <Button
            disabled={isUpdatingBlock}
            label={isUpdatingBlock ? 'Updating...' : 'Unblock profile'}
            onPress={toggleBlock}
            variant="secondary"
          />
          {message ? <Text style={styles.errorText}>{message}</Text> : null}
        </View>
      ) : null}

      {status === 'error' ? (
        <EmptyState body={message ?? 'Try again later.'} title="Profile unavailable" />
      ) : null}

      {status === 'ready' && profile ? (
        <View style={styles.stack}>
          {!profile.canViewContent ? (
            <View style={styles.privateState}>
              <Text style={styles.privateTitle}>This profile is private</Text>
              <Text style={styles.body}>
                {isOwnPreview
                  ? 'Other members need to send a follow request before you can choose to let them see your profile.'
                  : 'This user needs to accept your follow request before you can see their profile.'}
              </Text>
              {!isOwnPreview ? (
                <Button
                  accessibilityHint={followState?.status === 'pending' ? 'Cancels your follow request.' : undefined}
                  disabled={isUpdatingFollow || isUpdatingBlock}
                  label={
                    isUpdatingFollow
                      ? 'Updating...'
                      : followState?.status === 'pending'
                        ? 'Request sent'
                        : 'Request to follow'
                  }
                  onPress={toggleFollow}
                  variant={followState?.status === 'pending' ? 'secondary' : 'primary'}
                />
              ) : null}
            </View>
          ) : (
            <ProfileSummaryCard
              displayName={profile.displayName}
              followersCount={profile.stats.followersCount}
              postsCount={profile.stats.postsCount}
              reviewsCount={profile.stats.reviewsCount}
            />
          )}
          {profile.canViewContent && profile.watchlists.length > 0 ? (
            <View style={styles.watchlistsPanel}>
              <View style={styles.watchlistsHeading}>
                <Text style={styles.socialTitle}>Watchlists</Text>
                <Text style={styles.watchlistsCount}>{profile.watchlists.length}</Text>
              </View>
              {profile.watchlists.map((watchlist, index) => (
                <View
                  key={watchlist.id}
                  style={[
                    styles.watchlistRow,
                    index === profile.watchlists.length - 1 ? styles.watchlistRowLast : null,
                  ]}
                >
                  <View style={styles.watchlistIcon}>
                    <ListVideo color={colors.textMuted} size={18} strokeWidth={2} />
                  </View>
                  <View style={styles.watchlistCopy}>
                    <Text numberOfLines={1} style={styles.watchlistName}>{watchlist.name}</Text>
                    <Text style={styles.watchlistMeta}>
                      {watchlist.itemCount === 1 ? '1 title' : `${watchlist.itemCount} titles`}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {!isOwnPreview && profile.canViewContent ? (
            <>
              <Button
                disabled={isUpdatingFollow || isUpdatingBlock}
                label={
                  isUpdatingFollow
                    ? 'Updating...'
                    : followState?.status === 'following'
                      ? 'Following'
                      : 'Follow profile'
                }
                onPress={toggleFollow}
                variant={followState?.status === 'following' ? 'secondary' : 'primary'}
              />
              <Button
                disabled={isUpdatingBlock || isUpdatingFollow}
                label={
                  isUpdatingBlock
                    ? 'Updating...'
                    : blockState?.blocked
                      ? 'Unblock profile'
                      : 'Block profile'
                }
                onPress={toggleBlock}
                variant={blockState?.blocked ? 'secondary' : 'danger'}
              />
              {message ? <Text style={styles.errorText}>{message}</Text> : null}
            </>
          ) : null}
          {!isOwnPreview && !profile.canViewContent ? (
            <>
              <Button
                disabled={isUpdatingBlock || isUpdatingFollow}
                label={isUpdatingBlock ? 'Updating...' : 'Block profile'}
                onPress={toggleBlock}
                variant="danger"
              />
              {message ? <Text style={styles.errorText}>{message}</Text> : null}
            </>
          ) : null}
        </View>
      ) : null}

    </Screen>
  );
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
  },
  mutedText: {
    ...typography.body,
    color: colors.muted,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  privateState: {
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  privateTitle: {
    ...typography.title,
    color: colors.text,
  },
  socialTitle: {
    ...typography.title,
    color: colors.text,
  },
  stack: {
    gap: spacing.md,
  },
  userId: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0,
  },
  watchlistCopy: {
    flex: 1,
    minWidth: 0,
  },
  watchlistIcon: {
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.sm,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  watchlistMeta: {
    ...typography.meta,
    color: colors.textSubtle,
    marginTop: 2,
  },
  watchlistName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  watchlistRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    paddingVertical: spacing.sm,
  },
  watchlistRowLast: {
    borderBottomWidth: 0,
  },
  watchlistsCount: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '800',
  },
  watchlistsHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  watchlistsPanel: {
    backgroundColor: colors.panelSoft,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
});
