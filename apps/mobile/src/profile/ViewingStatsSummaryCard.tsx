import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { ViewingStats } from '../api/viewings';
import { colors, touchTargets, typography } from '../design/tokens';
import { formatCompactHours } from './viewingStatsModel';

export function ViewingStatsSummaryCard({
  accessibilityHint = 'Opens your complete all-time viewing statistics.',
  onPress,
  stats,
  title = 'YOUR STATS',
}: {
  accessibilityHint?: string;
  onPress: () => void;
  stats: ViewingStats;
  title?: string;
}) {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel="See all viewing statistics"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
    >
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.eyebrow}>{title}</Text>
        <View style={styles.action}>
          <Text style={styles.actionLabel}>SEE ALL</Text>
          <ChevronRight color={colors.accent} size={18} strokeWidth={2.5} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <Stat label="FILMS" value={String(stats.summary.movieCount)} />
        <View pointerEvents="none" style={styles.divider} />
        <Stat label="EPISODES" value={String(stats.summary.episodeCount)} />
        <View pointerEvents="none" style={styles.divider} />
        <Stat
          label="WATCH TIME"
          value={`${stats.summary.watchTimeIsEstimated ? '~' : ''}${formatCompactHours(stats.summary.watchMinutes)}`}
        />
      </View>
    </Pressable>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text adjustsFontSizeToFit numberOfLines={1} style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: touchTargets.min,
  },
  actionLabel: {
    ...typography.meta,
    color: colors.accent,
    letterSpacing: 0.8,
  },
  card: {
    paddingHorizontal: 0,
  },
  divider: {
    backgroundColor: 'rgba(212, 58, 92, 0.32)',
    height: 44,
    width: StyleSheet.hairlineWidth,
  },
  eyebrow: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  label: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  pressed: {
    opacity: 0.78,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 82,
  },
  value: {
    color: colors.accent,
    fontSize: 31,
    fontWeight: '800',
    letterSpacing: -1,
    maxWidth: '100%',
  },
});
