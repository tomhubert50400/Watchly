import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, touchTargets, typography } from '../design/tokens';

type ProfileSummaryCardProps = {
  displayName: string | null;
  followersCount: number;
  followingCount?: number;
  isPublic?: boolean;
  onEdit?: () => void;
  onShare?: () => void;
  postsCount?: number;
  ratingsCount?: number;
  reviewsCount: number;
};

export function ProfileSummaryCard({
  displayName,
  followersCount,
  followingCount,
  isPublic,
  onEdit,
  onShare,
  postsCount,
  ratingsCount,
  reviewsCount,
}: ProfileSummaryCardProps) {
  const name = displayName?.trim() || 'Watchly member';
  const visibleRatingsCount = ratingsCount ?? postsCount ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitials(name)}</Text>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.name}>{name}</Text>
      <Text style={styles.caption}>
        {isPublic === false
          ? 'Your identity is private. Only activity allowed by your settings appears below.'
          : 'Public ratings, reviews, and connections — without your private viewing history.'}
      </Text>
      {onEdit && onShare ? (
        <View style={styles.actions}>
          <ProfileAction label="Edit profile" onPress={onEdit} primary />
          <ProfileAction label="Share" onPress={onShare} />
        </View>
      ) : null}
      <View style={styles.statsRow}>
        <StatBlock label="Ratings" value={visibleRatingsCount} />
        <StatBlock label="Reviews" value={reviewsCount} />
        <StatBlock label="Followers" value={followersCount} />
        {followingCount !== undefined ? <StatBlock label="Following" value={followingCount} /> : null}
      </View>
    </View>
  );
}

function ProfileAction({ label, onPress, primary = false }: { label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary ? styles.actionPrimary : styles.actionSecondary,
        pressed ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.actionLabel, primary ? styles.actionLabelPrimary : null]}>{label}</Text>
    </Pressable>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'W';
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    borderRadius: radii.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: touchTargets.min,
    paddingHorizontal: spacing.md,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionLabelPrimary: {
    color: colors.textOnAccent,
  },
  actionPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    width: '100%',
  },
  actionSecondary: {
    backgroundColor: colors.panelElevated,
    borderColor: colors.borderStrong,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: 40,
    borderWidth: 1,
    height: 76,
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    width: 76,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 24,
    fontWeight: '900',
  },
  caption: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.xs,
    maxWidth: 330,
    textAlign: 'center',
  },
  container: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  name: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 31,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  statBlock: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  statsRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
});
