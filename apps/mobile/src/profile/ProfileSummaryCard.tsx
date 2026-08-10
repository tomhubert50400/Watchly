import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera } from 'lucide-react-native';
import { colors, spacing } from '../design/tokens';
import { UserAvatar } from '../components/UserAvatar';
import { formatProfileHandle } from './profileHandle';

type ProfileSummaryCardProps = {
  avatarLoading?: boolean;
  avatarUrl: string | null;
  displayName: string | null;
  followersCount: number;
  followingCount?: number;
  handle: string | null;
  onAvatarPress?: () => void;
  postsCount?: number;
  ratingsCount?: number;
  reviewsCount: number;
  socialStatsLoading?: boolean;
};

export function ProfileSummaryCard({
  avatarLoading = false,
  avatarUrl,
  displayName,
  followersCount,
  followingCount,
  handle,
  onAvatarPress,
  reviewsCount,
  socialStatsLoading = false,
}: ProfileSummaryCardProps) {
  const formattedHandle = formatProfileHandle(handle);
  const name = displayName?.trim() || formattedHandle || 'Watchly member';
  const secondaryLabel = followingCount === undefined ? 'reviews' : 'following';
  const secondaryValue = followingCount ?? reviewsCount;

  return (
    <View style={styles.identityRow}>
      {onAvatarPress ? (
        <Pressable
          accessibilityHint="Opens profile photo actions."
          accessibilityLabel={avatarUrl ? 'Change profile photo' : 'Add profile photo'}
          accessibilityRole="button"
          disabled={avatarLoading}
          onPress={onAvatarPress}
          style={({ pressed }) => [
            styles.avatarButton,
            pressed ? styles.avatarButtonPressed : null,
          ]}
        >
          <UserAvatar avatarUrl={avatarUrl} displayName={name} size={84} style={styles.avatar} />
          {avatarLoading ? (
            <View style={styles.avatarLoading}>
              <ActivityIndicator color={colors.text} size="small" />
            </View>
          ) : (
            <View style={styles.avatarNotch}>
              <Camera color={colors.textMuted} size={13} strokeWidth={2.2} />
            </View>
          )}
        </Pressable>
      ) : (
        <UserAvatar avatarUrl={avatarUrl} displayName={name} size={84} style={styles.avatar} />
      )}
      <View style={styles.identityCopy}>
        <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{name}</Text>
        {formattedHandle ? (
          <Text numberOfLines={1} style={styles.handle}>{formattedHandle}</Text>
        ) : null}
        {socialStatsLoading ? (
          <View
            accessibilityLabel="Loading profile counts"
            accessibilityRole="progressbar"
            style={styles.socialSkeletonRow}
          >
            <View style={[styles.socialSkeleton, styles.socialSkeletonWide]} />
            <View style={styles.socialSkeleton} />
          </View>
        ) : (
          <View style={styles.socialRow}>
            <SocialStat label="followers" value={followersCount} />
            <Text style={styles.dot}>·</Text>
            <SocialStat label={secondaryLabel} value={secondaryValue} />
          </View>
        )}
      </View>
    </View>
  );
}

function SocialStat({ label, value }: { label: string; value: number }) {
  return (
    <Text style={styles.socialStat}>
      <Text style={styles.socialValue}>{value}</Text>
      {` ${label}`}
    </Text>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: '#1B1017',
    borderWidth: 0,
  },
  avatarNotch: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    bottom: -1,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: -1,
    width: 24,
  },
  avatarButton: {
    borderRadius: 42,
  },
  avatarButtonPressed: {
    opacity: 0.72,
  },
  avatarLoading: {
    alignItems: 'center',
    backgroundColor: 'rgba(9, 12, 19, 0.68)',
    borderRadius: 42,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dot: {
    color: colors.textSubtle,
    fontSize: 15,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  handle: {
    color: colors.textSubtle,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  name: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  socialRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  socialSkeleton: {
    backgroundColor: colors.borderStrong,
    borderRadius: 4,
    height: 12,
    width: 68,
  },
  socialSkeletonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  socialSkeletonWide: {
    width: 82,
  },
  socialStat: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  socialValue: {
    color: colors.accent,
    fontWeight: '900',
  },
});
