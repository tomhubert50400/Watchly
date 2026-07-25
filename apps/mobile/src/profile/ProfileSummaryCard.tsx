import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../design/tokens';

type ProfileSummaryCardProps = {
  displayName: string | null;
  followersCount: number;
  followingCount?: number;
  postsCount?: number;
  ratingsCount?: number;
  reviewsCount: number;
};

export function ProfileSummaryCard({
  displayName,
  followersCount,
  followingCount,
  postsCount,
  ratingsCount,
  reviewsCount,
}: ProfileSummaryCardProps) {
  const name = displayName?.trim() || 'Watchly member';
  const visibleRatingsCount = ratingsCount ?? postsCount ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.identityRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(name)}</Text>
        </View>
        <View style={styles.identityCopy}>
          <Text accessibilityRole="header" numberOfLines={2} style={styles.name}>{name}</Text>
          <View style={styles.statsRow}>
            <Stat label="ratings" value={visibleRatingsCount} />
            <Stat label="reviews" value={reviewsCount} />
            <Stat label="followers" value={followersCount} />
            {followingCount !== undefined ? <Stat label="following" value={followingCount} /> : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'W';
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 18,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 24,
    fontWeight: '900',
  },
  container: {
    alignItems: 'stretch',
    paddingTop: spacing.xs,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  identityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  name: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    letterSpacing: -0.7,
    lineHeight: 33,
  },
  stat: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    columnGap: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    rowGap: 3,
  },
  statValue: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
});
