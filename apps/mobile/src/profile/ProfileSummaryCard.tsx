import { StyleSheet, Text, View } from 'react-native';
import { Chip } from '../components/Chip';
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
      <View style={styles.heroRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitial(name)}</Text>
        </View>
        <View style={styles.copy}>
          <Chip label="Cinephile profile" tone="accent" />
          <Text numberOfLines={1} style={styles.name}>
            {name}
          </Text>
          <Text style={styles.caption}>Public reviews, followers, and film notes.</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <StatBlock label="Posts" value={postsCount} />
        <StatBlock label="Reviews" value={reviewsCount} />
        <StatBlock label="Followers" value={followersCount} />
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
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentBorder,
    borderRadius: radii.lg,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  avatarText: {
    color: colors.accentText,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0,
  },
  caption: {
    ...typography.body,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  card: {
    ...shadows.panel,
    backgroundColor: colors.panelSoft,
    borderColor: colors.borderStrong,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...typography.heading,
    color: colors.text,
    marginTop: spacing.md,
  },
  statBlock: {
    flex: 1,
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
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
});
