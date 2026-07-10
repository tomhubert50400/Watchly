import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../design/tokens';
import type { LibrarySummary as Summary } from './libraryModel';

export function LibrarySummary({ summary }: { summary: Summary }) {
  const cells = [
    [String(summary.trackedTitleCount), 'tracked titles'],
    [String(summary.watchedEpisodeCount), 'episodes watched'],
    [summary.averageRating === null ? '—' : summary.averageRating.toFixed(1), 'average rating'],
  ];
  return <View accessibilityLabel={`${summary.trackedTitleCount} tracked titles, ${summary.watchedEpisodeCount} episodes watched`} style={styles.row}>
    {cells.map(([value, label], index) => <View key={label} style={[styles.cell, index < cells.length - 1 && styles.bordered]}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>)}
  </View>;
}
const styles = StyleSheet.create({ row: { borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', paddingVertical: spacing.md }, cell: { alignItems: 'center', flex: 1, paddingHorizontal: spacing.xs }, bordered: { borderRightColor: colors.border, borderRightWidth: 1 }, value: { color: colors.text, fontSize: 21, fontWeight: '800' }, label: { color: colors.textSubtle, fontSize: 11, marginTop: 2, textAlign: 'center' } });
