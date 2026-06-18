import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, shadows, spacing, typography } from '../design/tokens';

type ProfileSummaryCardProps = {
  displayName: string | null;
  followersCount: number;
  postsCount: number;
  reviewsCount: number;
};

export function ProfileSummaryCard({
  displayName,
  followersCount,
  postsCount,
  reviewsCount,
}: ProfileSummaryCardProps) {
  const name = displayName?.trim() || 'Unnamed profile';

  return (
    <View style={styles.card}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{getInitial(name)}</Text>
      </View>
      <View style={styles.copy}>
        <Text numberOfLines={1} style={styles.name}>
          {name}
        </Text>
        <View style={styles.statsRow}>
          <StatBlock label="Posts" value={postsCount} />
          <StatBlock label="Reviews" value={reviewsCount} />
          <StatBlock label="Followers" value={followersCount} />
        </View>
      </View>
    </View>
  );
}

function StatBlock({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.statBlock}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase();
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderColor: colors.accentPressed,
    borderRadius: radii.md,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  avatarText: {
    color: colors.textOnAccent,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  card: {
    ...shadows.panel,
    alignItems: 'center',
    backgroundColor: colors.panelElevated,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.title,
    color: colors.text,
  },
  statBlock: {
    minWidth: 64,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
});
